/**
 * SharePoint Storage Details Viewer - Bookmarklet (サイト・ライブラリ選択対応版)
 *
 * SharePoint のストレージ使用状況を詳細表示する Bookmarklet
 *
 * 機能:
 * - サイトとドキュメントライブラリの選択（自動/手動）
 * - Search API で全ファイルを一括取得（API呼び出し数を大幅削減）
 * - ファイルサイズを集計して階層表示
 * - ソート可能なテーブルで表示
 * - フォルダごとのサイズ集計
 *
 * 使用方法:
 * 1. SharePoint サイトのページで実行
 * 2. 自動的に利用可能なサイトを検出
 * 3. サイトが複数ある場合は選択ダイアログを表示
 * 4. 選択されたサイトのドキュメントライブラリを表示
 * 5. ライブラリが複数ある場合は選択ダイアログを表示
 * 6. 選択されたライブラリの解析を開始
 * 7. モーダルウィンドウで結果を表示
 *
 * 注意: Search API はクロールベースのため、直前の変更が反映されない場合があります
 */

(function () {
  'use strict';

  // グローバル変数
  let storageData = {
    totalSize: 0,
    totalFiles: 0,
    totalFolders: 0,
    items: []
  };
  // バージョン情報キャッシュ（セッション単位）
  const versionsCache = new Map(); // key: serverRelativePath -> { versions: [], totalSize: number, fetchedAt: Date }
  // 現在選択されたサイト情報（main() 実行時に設定される）
  const currentSiteInfo = { absoluteUrl: '', serverRelativeUrl: '' };

  // SharePoint コンテキスト情報の取得（堅牢版）
  function getSiteContext() {
    // まず _spPageContextInfo を試す
    if (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo) {
      return {
        webAbsoluteUrl: _spPageContextInfo.webAbsoluteUrl,
        webServerRelativeUrl: _spPageContextInfo.webServerRelativeUrl,
        siteServerRelativeUrl: _spPageContextInfo.siteServerRelativeUrl,
        siteAbsoluteUrl: _spPageContextInfo.siteAbsoluteUrl,
        source: '_spPageContextInfo'
      };
    }

    // フォールバック: URL から SharePoint サイト情報を抽出
    const currentUrl = window.location.href;
    const urlMatch = currentUrl.match(/^https:\/\/([^\/]+)\/sites\/([^\/]+)/);

    if (urlMatch) {
      const tenant = urlMatch[1];
      const siteName = urlMatch[2];
      const siteUrl = `https://${tenant}/sites/${siteName}`;

      return {
        webAbsoluteUrl: siteUrl,
        webServerRelativeUrl: `/sites/${siteName}`,
        siteServerRelativeUrl: `/sites/${siteName}`,
        siteAbsoluteUrl: siteUrl,
        source: 'url-parsing'
      };
    }

    // さらにフォールバック: 一般的な SharePoint URL パターン
    const generalMatch = currentUrl.match(/^https:\/\/([^\/]+)\.sharepoint\.com/);
    if (generalMatch) {
      const tenant = generalMatch[1];
      const siteUrl = `https://${tenant}.sharepoint.com`;

      return {
        webAbsoluteUrl: siteUrl,
        webServerRelativeUrl: '/',
        siteServerRelativeUrl: '/',
        siteAbsoluteUrl: siteUrl,
        source: 'general-sharepoint'
      };
    }

    throw new Error('SharePoint コンテキストが見つかりません。このページは SharePoint サイトのページではありません。');
  }

  // 利用可能なサイトを取得（現在のサイトと子サイト）
  async function getAvailableSites() {
    const context = getSiteContext();
    const sites = [];

    // 現在のサイトを追加
    sites.push({
      title: '現在のサイト',
      url: context.webAbsoluteUrl,
      serverRelativeUrl: context.webServerRelativeUrl,
      isCurrent: true
    });

    try {
      // 子サイトを取得
      const endpoint = `/_api/web/webs?$select=Title,Url,ServerRelativeUrl`;
      const data = await spRestRequest(endpoint);
      const subSites = data.d.results || [];

      for (const subSite of subSites) {
        sites.push({
          title: subSite.Title,
          url: subSite.Url,
          serverRelativeUrl: subSite.ServerRelativeUrl,
          isCurrent: false
        });
      }
    } catch (error) {
      console.warn('子サイトの取得に失敗:', error);
      // 子サイト取得失敗しても現在のサイトは使える
    }

    return sites;
  }

  // 指定サイトのドキュメントライブラリを取得
  async function getDocumentLibraries(siteUrl) {
    // 一時的にコンテキストを変更して指定サイトのライブラリを取得
    const originalUrl = getSiteContext().webAbsoluteUrl;
    const tempContext = { ...getSiteContext(), webAbsoluteUrl: siteUrl };

    const endpoint = `/_api/web/lists?$filter=BaseTemplate eq 101&$select=Title,RootFolder/ServerRelativeUrl&$expand=RootFolder`;

    try {
      const url = `${siteUrl}${endpoint}`;
      const headers = {
        'Accept': 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose'
      };

      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`API エラー: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.d.results || [];
    } catch (error) {
      console.error(`サイト ${siteUrl} のライブラリ取得に失敗:`, error);
      throw error;
    }
  }

  // サイト選択ダイアログを表示
  function showSiteSelectionDialog(sites) {
    return new Promise((resolve) => {
      const modalHtml = `
        <div id="sp-site-selection-modal" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          z-index: 10001;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          <div style="
            background: white;
            width: 500px;
            max-height: 80%;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          ">
            <div style="
              padding: 20px;
              border-bottom: 1px solid #ddd;
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <h2 style="margin: 0; font-size: 20px;">対象サイトを選択</h2>
              <button id="sp-site-close" style="
                background: #d32f2f;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
              ">✕</button>
            </div>

            <div style="padding: 20px; flex: 1; overflow-y: auto;">
              <p style="margin-bottom: 15px; color: #666;">ストレージ解析を行うサイトを選択してください：</p>
              <div id="site-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${sites.map((site, index) => `
                  <label style="
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: border-color 0.2s;
                    ${site.isCurrent ? 'border-color: #0078d4; background: #f0f8ff;' : ''}
                  " onmouseover="this.style.borderColor='#0078d4'" onmouseout="this.style.borderColor='${site.isCurrent ? '#0078d4' : '#e0e0e0'}'">
                    <input type="radio" name="selected-site" value="${index}" style="margin-right: 12px;" ${index === 0 ? 'checked' : ''}>
                    <div>
                      <div style="font-weight: bold; color: #333;">${escapeHtml(site.title)}</div>
                      <div style="font-size: 12px; color: #666; word-break: break-all;">${escapeHtml(site.url)}</div>
                      ${site.isCurrent ? '<div style="font-size: 11px; color: #0078d4; font-weight: bold;">現在のサイト</div>' : ''}
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <div style="padding: 20px; border-top: 1px solid #ddd; display: flex; justify-content: flex-end; gap: 10px;">
              <button id="site-cancel" style="
                background: #666;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
              ">キャンセル</button>
              <button id="site-select" style="
                background: #0078d4;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
              ">選択</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      document.getElementById('sp-site-close').addEventListener('click', () => {
        document.getElementById('sp-site-selection-modal').remove();
        resolve(null);
      });

      document.getElementById('site-cancel').addEventListener('click', () => {
        document.getElementById('sp-site-selection-modal').remove();
        resolve(null);
      });

      document.getElementById('site-select').addEventListener('click', () => {
        const selectedRadio = document.querySelector('input[name="selected-site"]:checked');
        if (selectedRadio) {
          const selectedIndex = parseInt(selectedRadio.value);
          document.getElementById('sp-site-selection-modal').remove();
          resolve(sites[selectedIndex]);
        }
      });
    });
  }

  // ライブラリ選択ダイアログを表示
  function showLibrarySelectionDialog(site, libraries) {
    return new Promise((resolve) => {
      const modalHtml = `
        <div id="sp-library-selection-modal" style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          z-index: 10001;
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          <div style="
            background: white;
            width: 600px;
            max-height: 80%;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          ">
            <div style="
              padding: 20px;
              border-bottom: 1px solid #ddd;
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <h2 style="margin: 0; font-size: 20px;">ドキュメントライブラリを選択</h2>
              <button id="sp-library-close" style="
                background: #d32f2f;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                cursor: pointer;
              ">✕</button>
            </div>

            <div style="padding: 20px; flex: 1; overflow-y: auto;">
              <p style="margin-bottom: 15px; color: #666;">
                <strong>${escapeHtml(site.title)}</strong> のドキュメントライブラリを選択してください：
              </p>
              <div id="library-list" style="display: flex; flex-direction: column; gap: 10px;">
                ${libraries.map((library, index) => `
                  <label style="
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    border: 2px solid #e0e0e0;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: border-color 0.2s;
                  " onmouseover="this.style.borderColor='#0078d4'" onmouseout="this.style.borderColor='#e0e0e0'">
                    <input type="radio" name="selected-library" value="${index}" style="margin-right: 12px;" ${index === 0 ? 'checked' : ''}>
                    <div style="flex: 1;">
                      <div style="font-weight: bold; color: #333;">${escapeHtml(library.Title)}</div>
                      <div style="font-size: 12px; color: #666; word-break: break-all;">${escapeHtml(library.RootFolder.ServerRelativeUrl)}</div>
                    </div>
                  </label>
                `).join('')}
              </div>
            </div>

            <div style="padding: 20px; border-top: 1px solid #ddd; display: flex; justify-content: flex-end; gap: 10px;">
              <button id="library-cancel" style="
                background: #666;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
              ">キャンセル</button>
              <button id="library-select" style="
                background: #0078d4;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
              ">解析開始</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      document.getElementById('sp-library-close').addEventListener('click', () => {
        document.getElementById('sp-library-selection-modal').remove();
        resolve(null);
      });

      document.getElementById('library-cancel').addEventListener('click', () => {
        document.getElementById('sp-library-selection-modal').remove();
        resolve(null);
      });

      document.getElementById('library-select').addEventListener('click', () => {
        const selectedRadio = document.querySelector('input[name="selected-library"]:checked');
        if (selectedRadio) {
          const selectedIndex = parseInt(selectedRadio.value);
          document.getElementById('sp-library-selection-modal').remove();
          resolve(libraries[selectedIndex]);
        }
      });
    });
  }

  // Search API で全ファイルを取得（ページネーション対応）
  async function getAllFilesBySearch(siteUrl, libraryPath = null) {
    const rowLimit = 500; // 1回のリクエストで取得する件数
    let startRow = 0;
    const allFiles = [];
    let totalRetrieved = 0;

    updateProgress('Search API でファイル情報を取得中...');

    while (true) {
      // クエリ構築: サイト内の全アイテムを検索（ドキュメント、フォルダ、リストアイテムを含む）
      let queryText = `Path:"${siteUrl}"`;

      // 特定のライブラリが指定されている場合はサーバー相対パスから絶対URLを作成してプレフィックス検索
      if (libraryPath) {
        try {
          // libraryPath はサーバー相対パス (例: /sites/TestForTeams/Shared Documents)
          // siteUrl はサイトの絶対URL (例: https://tenant.sharepoint.com/sites/TestForTeams)
          const origin = new URL(siteUrl).origin;
          const fullLibUrl = origin + (libraryPath.startsWith('/') ? libraryPath : ('/' + libraryPath));
          // 検索クエリではプレフィックスで一致させるためワイルドカード形式を併用
          // 例: Path:"https://tenant.sharepoint.com/sites/TestForTeams/Shared Documents" OR Path:"https://.../Shared Documents/*"
          queryText += ` AND (Path:\"${fullLibUrl}\" OR Path:\"${fullLibUrl}/*\")`;
        } catch (e) {
          // URL構築に失敗したらフォールバックしてライブラリパスをそのまま使う
          queryText += ` AND Path:"${libraryPath}"`;
        }
      }

      const selectProperties = 'Path,Size,Title,LastModifiedTime,FileExtension,DocIcon,FileType,IsContainer,ParentLink';

      // エンコードしてエンドポイント構築
      const encodedQuery = encodeURIComponent(queryText);
      const encodedSelect = encodeURIComponent(selectProperties);
      const endpoint = `/_api/search/query?querytext='${encodedQuery}'&selectproperties='${encodedSelect}'&rowlimit=${rowLimit}&startrow=${startRow}&trimduplicates=false`;

      try {
        // 選択されたサイトに対してAPIリクエスト
        const url = `${siteUrl}${endpoint}`;
        const headers = {
          'Accept': 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose'
        };

        const response = await fetch(url, {
          method: 'GET',
          headers: headers,
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`API エラー: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // レスポンスからデータを抽出
        const queryResult = data?.d?.query?.PrimaryQueryResult?.RelevantResults;
        const rows = queryResult?.Table?.Rows?.results || [];
        const totalRows = queryResult?.TotalRows || 0;

        if (rows.length === 0) {
          break; // データがなければ終了
        }

        // 各行からファイル情報を抽出
        for (const row of rows) {
          const cells = row.Cells.results;
          const fileInfo = {};

          // Cells から Key-Value ペアを抽出（キーを小文字正規化して保存）
          cells.forEach(cell => {
            if (!cell || !cell.Key) return;
            const key = String(cell.Key);
            const lower = key.toLowerCase();
            // オリジナルキーと小文字キーの両方を保持（互換性のため）
            fileInfo[key] = cell.Value;
            fileInfo[lower] = cell.Value;
          });

          const path = fileInfo.Path || '';
          const size = parseInt(fileInfo.Size, 10) || 0;
          const modified = fileInfo.LastModifiedTime ? new Date(fileInfo.LastModifiedTime) : null;
          const title = fileInfo.Title || '';
          const parentLink = fileInfo.ParentLink || fileInfo.parentlink || '';

          // IsContainerの早期チェック（文字列"true"も含む）
          const isContainerValue = fileInfo.IsContainer || fileInfo.iscontainer || fileInfo['IsContainer'];
          const isContainer = isContainerValue === true || isContainerValue === 'true' || String(isContainerValue).toLowerCase() === 'true';

          // フォルダの場合は早期にスキップ
          if (isContainer) {
            console.log('フォルダをスキップ:', { title, isContainerValue, path });
            continue;
          }

          // サーバー相対パスに変換（フルURLの場合）
          let serverRelativePath = path;
          let name = title;
          let ext = '';

          if (path.startsWith('http')) {
            try {
              const url = new URL(path);
              serverRelativePath = url.pathname;

              // DispForm.aspxの場合は実際のファイルパスを再構築
              if (serverRelativePath.includes('/Forms/DispForm.aspx')) {
                // ParentLinkからライブラリパスを取得
                if (parentLink) {
                  try {
                    const parentUrl = new URL(parentLink);
                    let libraryPath = parentUrl.pathname;
                    // AllItems.aspxの場合は除去
                    libraryPath = libraryPath.replace(/\/Forms\/AllItems\.aspx$/, '');
                    // 拡張子を先に取得（後で使用）
                    const tempFileType = fileInfo.FileType || fileInfo.filetype || '';
                    const tempExt = tempFileType ? String(tempFileType).replace(/^\./, '') : '';
                    // ファイルパスを再構築: LibraryPath / Title.ext
                    if (tempExt) {
                      serverRelativePath = libraryPath + '/' + title + '.' + tempExt;
                    } else {
                      serverRelativePath = libraryPath + '/' + title;
                    }
                    console.log('DispForm.aspx パス再構築:', { original: path, reconstructed: serverRelativePath });
                  } catch (e) {
                    console.warn('ParentLink パース失敗:', e);
                  }
                } else {
                  // ParentLinkがない場合はスキップ
                  console.warn('DispForm.aspx だが ParentLink なし:', path);
                  continue;
                }
              }
            } catch (e) {
              console.warn('URL パース失敗:', path, e);
            }
          }

          // 拡張子を取得
          const fileExt = fileInfo.FileExtension || fileInfo.fileextension || fileInfo['FileExtension'];
          const fileType = fileInfo.FileType || fileInfo.filetype || fileInfo['FileType'];

          if (fileExt && String(fileExt).toLowerCase() !== 'aspx') {
            ext = String(fileExt).replace(/^\./, '').toLowerCase();
          } else if (fileType) {
            ext = String(fileType).replace(/^\./, '').toLowerCase();
          }

          // それでも拡張子が取れない場合はファイル名から
          if (!ext) {
            const extMatch = name.match(/\.([^.]+)$/);
            ext = extMatch ? extMatch[1].toLowerCase() : '';
          }

          // DocIcon が null の場合は拡張子ベースでフォールバックアイコンURLを作成
          let docIcon = null;
          const docIconCandidates = [fileInfo.DocIcon, fileInfo.docicon, fileInfo['DocIcon'], fileInfo['docicon']];
          for (const c of docIconCandidates) {
            if (c != null && String(c).trim() !== '') {
              docIcon = String(c);
              break;
            }
          }
          // 注意: フォールバックアイコンは大量の404を発生させるため行わない

          // デバッグ: パス情報をコンソールに出力
          console.log('ファイル情報:', {
            name: name,
            path: serverRelativePath,
            ext: ext,
            size: size
          });

          allFiles.push({
            path: serverRelativePath,
            name: name,
            size: size,
            modified: modified,
            type: 'file',
            ext: ext,
            docIcon: docIcon
          });

          totalRetrieved++;
        }

        updateProgress(`ファイル情報取得中: ${totalRetrieved} / ${totalRows} 件`);

        // 次のページへ
        if (rows.length < rowLimit || totalRetrieved >= totalRows) {
          break; // 全件取得完了
        }
        startRow += rowLimit;

      } catch (error) {
        console.error('Search API エラー:', error);
        throw new Error(`Search API でのファイル取得に失敗しました: ${error.message}`);
      }
    }

    updateProgress(`全 ${allFiles.length} 件のファイル情報を取得完了`);
    return allFiles;
  }

  // ファイル一覧からフォルダ階層を構築
  function buildFolderHierarchy(files) {
    updateProgress('フォルダ階層を構築中...');

    // フォルダごとの情報を保持する Map
    const folderMap = new Map();

    // ルートフォルダのセット
    const rootFolders = new Set();

    // 各ファイルを処理
    for (const file of files) {
      storageData.totalFiles++;
      storageData.totalSize += file.size;

      const filePath = file.path;
      const pathSegments = filePath.split('/').filter(s => s);

      // ファイルの親フォルダパスを取得
      const parentPath = filePath.substring(0, filePath.lastIndexOf('/')) || '/';

      // 親フォルダとその上位フォルダすべてに累積
      let currentPath = '';
      for (let i = 0; i < pathSegments.length - 1; i++) {
        currentPath += '/' + pathSegments[i];

        if (!folderMap.has(currentPath)) {
          folderMap.set(currentPath, {
            path: currentPath,
            name: pathSegments[i],
            type: 'folder',
            size: 0,
            fileCount: 0,
            folderCount: 0,
            children: [],
            childFolders: new Set(),
            parentPath: i > 0 ? '/' + pathSegments.slice(0, i).join('/') : '/'
          });

          // ルートレベルのフォルダを記録
          if (i === 0) {
            rootFolders.add(currentPath);
          }
        }

        // サイズとファイル数を累積
        const folderInfo = folderMap.get(currentPath);
        folderInfo.size += file.size;
        folderInfo.fileCount++;
      }

      // 直接の親フォルダに子ファイルを追加
      if (folderMap.has(parentPath)) {
        folderMap.get(parentPath).children.push(file);
      }
    }

    // 親子関係を構築
    for (const [path, folder] of folderMap) {
      const parentPath = folder.parentPath;
      if (parentPath !== '/' && folderMap.has(parentPath)) {
        const parent = folderMap.get(parentPath);
        if (!parent.childFolders.has(path)) {
          parent.children.push(folder);
          parent.childFolders.add(path);
          parent.folderCount++;
        }
      }
    }

    // 各フォルダの子フォルダ数を再帰的に計算
    function calculateFolderCount(folder) {
      let count = 0;
      for (const child of folder.children) {
        if (child.type === 'folder') {
          count++;
          count += calculateFolderCount(child);
        }
      }
      folder.folderCount = count;
      return count;
    }

    // ルートフォルダを storageData.items に追加
    const rootItems = [];
    for (const rootPath of rootFolders) {
      if (folderMap.has(rootPath)) {
        const rootFolder = folderMap.get(rootPath);
        calculateFolderCount(rootFolder);

        // システムフォルダをスキップ
        if (rootFolder.name === 'Forms' || rootFolder.name === '_catalogs') {
          continue;
        }

        rootItems.push(rootFolder);
        storageData.totalFolders++;
      }
    }

    // フォルダ数をカウント
    storageData.totalFolders = folderMap.size;

    // 深さ情報を付与（表示用）
    function assignDepth(items, depth = 0) {
      for (const item of items) {
        item.depth = depth;
        if (item.children && item.children.length > 0) {
          assignDepth(item.children, depth + 1);
        }
      }
    }
    assignDepth(rootItems);

    updateProgress('フォルダ階層の構築完了');
    return rootItems;
  }

  // ファイルサイズを人間が読める形式に変換
  function formatBytes(bytes) {
    // NaN、undefined、nullをチェック
    if (bytes == null || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // iが範囲外の場合はBを使用
    const unit = sizes[i] || 'B';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + unit;
  }

  // プログレス表示を更新
  function updateProgress(message) {
    const progressEl = document.getElementById('sp-storage-progress');
    if (progressEl) {
      progressEl.textContent = message;
    }
  }

  // テーブル行を生成
  function createTableRow(item, level = 0) {
    const indent = '&nbsp;&nbsp;'.repeat(level);

    // フォルダの展開アイコン（初期状態は展開されているので▼）
    let expandIcon = '';
    const hasChildren = item.children && item.children.length > 0;
    if (item.type === 'folder' && hasChildren) {
      expandIcon = '<span class="folder-toggle" style="cursor: pointer; user-select: none; margin-right: 4px; font-size: 12px;">▼</span>';
    } else if (item.type === 'folder') {
      expandIcon = '<span style="margin-right: 4px; opacity: 0.3;">▶</span>';
    }

    // アイコン: SharePointアイコンを使用（DocIconまたは拡張子ベース）
    let icon;
    if (item.type === 'folder') {
      icon = '📁';
    } else if (item.docIcon) {
      const iconUrl = item.docIcon.startsWith('http') ? item.docIcon : `${window.location.origin}${item.docIcon}`;
      icon = `<img src="${escapeHtml(iconUrl)}" alt="" style="width: 16px; height: 16px; vertical-align: middle;">`;
    } else {
      // フォールバックは画像取得で404を発生させないように絵文字を使用
      icon = '📄';
    }

    const sizeText = formatBytes(item.size);
    const countText = item.type === 'folder' ? `${item.fileCount}ファイル, ${item.folderCount}フォルダ` : '';

    // 親フォルダパスを取得してデコード表示
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
    const decodedParentPath = decodeURIComponent(parentPath);

    // 名前をデコードして拡張子付きで表示（重複チェック）
    const decodedName = decodeURIComponent(item.name);
    let displayName = decodedName;
    if (item.ext && !decodedName.toLowerCase().endsWith(`.${item.ext.toLowerCase()}`)) {
      displayName += '.' + item.ext;
    }

    return `
            <tr class="sp-storage-row" data-type="${item.type}" data-depth="${level}" data-path="${escapeHtml(item.path)}" data-has-children="${hasChildren}">
                <td style="word-break: break-word;">${indent}${expandIcon}${icon} <span class="item-name" style="color: #0078d4; cursor: pointer; text-decoration: underline;">${escapeHtml(displayName)}</span></td>
                <td class="sp-storage-size" data-size="${item.size}">${sizeText}</td>
                <td class="sp-storage-versions-count versions-col" data-versions-count="">${item.type === 'folder' ? '' : ''}</td>
                <td class="sp-storage-versions-total versions-col" data-versions-total="">${item.type === 'folder' ? '' : ''}</td>
                <td class="sp-storage-ext" data-ext="${item.ext || ''}">${item.type === 'file' ? escapeHtml(item.ext || '') : ''}</td>
                <td>${countText}</td>
                <td title="${decodedParentPath}" style="word-break: break-word;"><span class="parent-path" style="color: #0078d4; cursor: pointer; text-decoration: underline;">${escapeHtml(decodedParentPath)}</span></td>
            </tr>
        `;
  }

  // 指定ファイルのバージョン情報を取得（キャッシュ付き）
  async function fetchVersionsForFile(serverRelativePath) {
    if (!serverRelativePath) return null;
    try {
      if (versionsCache.has(serverRelativePath)) {
        return versionsCache.get(serverRelativePath);
      }
      // サーバー相対パスを正規化して site プレフィックスを含める
      let decodedPath = serverRelativePath;
      try { decodedPath = decodeURIComponent(serverRelativePath); } catch (e) { /* ignore */ }

      // currentSiteInfo.serverRelativeUrl を先頭に付与すべきか判断
      let fullServerPath = decodedPath;
      const sitePrefix = currentSiteInfo.serverRelativeUrl || '';
      // サイトプレフィックスが既に含まれているか、またはパスがルート形式(/sites/)ならそのまま
      if (!(fullServerPath.startsWith(sitePrefix) || fullServerPath.startsWith('/sites/') || fullServerPath.startsWith('/teams/'))) {
        // 絶対的なサーバー相対パスに変換
        const trimmed = fullServerPath.replace(/^\/+/, '');
        const prefix = sitePrefix.replace(/\/+$/, '');
        fullServerPath = prefix + '/' + trimmed;
      }

      // OData の単一引用符に含める際のエスケープ
      const safePath = fullServerPath.replace(/'/g, "''");
      // API ベースは選択サイトの absoluteUrl を使う（例: https://.../sites/TestForTeams/_api/...）
      const base = currentSiteInfo.absoluteUrl || window.location.origin;
      const endpoint = `${base}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(safePath)}')/Versions`;

      console.log('Fetch Versions API endpoint:', endpoint, { original: serverRelativePath, fullServerPath, safePath });
      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json;odata=verbose'
        },
        credentials: 'include'
      });

      if (!resp.ok) {
        // キャッシュに空のエントリを入れてリトライを避ける
        versionsCache.set(serverRelativePath, { versions: [], totalSize: 0, fetchedAt: new Date(), errorStatus: resp.status });
        return versionsCache.get(serverRelativePath);
      }

      const data = await resp.json();
      const results = data?.d?.results || [];

      // サイズはバージョンオブジェクトの Size または size のいずれかに存在する可能性がある
      let total = 0;
      const versions = results.map(v => {
        const size = parseInt(v.Size || v.size || 0, 10) || 0;
        total += size;
        return {
          label: v.VersionLabel || v.versionLabel || '',
          created: v.Created || v.created || null,
          size: size
        };
      });

      const entry = { versions: versions, totalSize: total, fetchedAt: new Date() };
      versionsCache.set(serverRelativePath, entry);
      return entry;
    } catch (e) {
      versionsCache.set(serverRelativePath, { versions: [], totalSize: 0, fetchedAt: new Date(), error: e.message });
      return versionsCache.get(serverRelativePath);
    }
  }

  // 行にバージョン情報を反映する
  function updateRowWithVersions(serverRelativePath, entry) {
    try {
      const rows = document.querySelectorAll(`#sp-storage-table tbody tr[data-path]`);
      for (const row of rows) {
        const rp = row.getAttribute('data-path');
        if (!rp) continue;
        // data-path はエスケープされている可能性があるためデコードして比較
        let a = rp;
        let b = serverRelativePath;
        try { a = decodeURIComponent(rp); } catch (e) { /* ignore */ }
        try { b = decodeURIComponent(serverRelativePath); } catch (e) { /* ignore */ }
        if (a === b) {
          const cntCell = row.querySelector('.sp-storage-versions-count');
          const totCell = row.querySelector('.sp-storage-versions-total');
          if (entry && entry.versions && entry.versions.length > 0) {
            cntCell.textContent = String(entry.versions.length);
            cntCell.setAttribute('data-versions-count', String(entry.versions.length));
            totCell.textContent = formatBytes(entry.totalSize || 0);
            totCell.setAttribute('data-versions-total', String(entry.totalSize || 0));
            // タイトルに詳細を追加
            totCell.title = entry.versions.map(v => `${v.label}:${formatBytes(v.size)}`).join('\n');
          } else {
            cntCell.textContent = '-';
            totCell.textContent = '-';
          }
        }
      }
    } catch (e) {
      console.warn('行の更新に失敗:', e);
    }
  }

  // HTML エスケープ
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // テーブルを再帰的に生成
  function generateTableRows(items, level = 0) {
    let html = '';
    for (const item of items) {
      html += createTableRow(item, level);
      if (item.children && item.children.length > 0) {
        // 子要素をソート（フォルダ優先、次にサイズ降順）
        const sortedChildren = [...item.children].sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return b.size - a.size;
        });
        html += generateTableRows(sortedChildren, level + 1);
      }
    }
    return html;
  }

  // フィルター適用（versionsフィルターは保護）
  function applyRowFilter() {
    const showFiles = document.getElementById('filter-files').checked;
    const showFolders = document.getElementById('filter-folders').checked;
    const searchText = document.getElementById('filter-search').value.toLowerCase();
    const extFilterEl = document.getElementById('filter-ext');
    const extFilter = extFilterEl ? extFilterEl.value.toLowerCase() : '';

    const rows = document.querySelectorAll('#sp-storage-table tbody tr');
    rows.forEach(row => {
      const type = row.getAttribute('data-type');
      const nameCell = row.cells[0].textContent;
      const parentCell = row.cells[6].textContent;

      // タイプチェック
      let typeMatch = false;
      if (type === 'file' && showFiles) typeMatch = true;
      if (type === 'folder' && showFolders) typeMatch = true;

      // 検索テキストチェック（名前または親フォルダに含まれるか）
      let textMatch = true;
      if (searchText) {
        textMatch = nameCell.toLowerCase().includes(searchText) ||
          parentCell.toLowerCase().includes(searchText);
      }

      // 拡張子フィルター
      let extMatch = true;
      if (extFilter) {
        const extCell = row.querySelector('.sp-storage-ext');
        const rowExt = extCell ? (extCell.dataset.ext || '').toLowerCase() : '';
        extMatch = rowExt === extFilter;
      }

      // 基本フィルター条件を満たす場合のみ表示対象とする
      // ただし、versionsフィルターで既に非表示の場合はそれを維持
      if (typeMatch && textMatch && extMatch) {
        // versionsフィルターでの非表示状態をチェック
        // data-versions-hidden属性で管理
        if (!row.hasAttribute('data-versions-hidden')) {
          row.style.display = '';
        }
      } else {
        row.style.display = 'none';
      }
    });
  }

  // 下位互換のためのエイリアス
  function applyFilter() {
    applyRowFilter();
  }

  // フィルタークリア（versionsフィルターは保護）
  function clearFilter() {
    document.getElementById('filter-files').checked = true;
    document.getElementById('filter-folders').checked = true;
    document.getElementById('filter-search').value = '';
    const extFilterEl = document.getElementById('filter-ext');
    if (extFilterEl) extFilterEl.value = '';
    // versionsフィルターは保護するため、applyFilterは呼ばずに行フィルターのみ適用
    applyRowFilter();
  }

  // テーブルをソート
  function sortTable(columnIndex, ascending = true) {
    const table = document.getElementById('sp-storage-table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
      let aValue, bValue;

      if (columnIndex === 1) { // サイズ列
        aValue = parseInt(a.querySelector('.sp-storage-size').dataset.size);
        bValue = parseInt(b.querySelector('.sp-storage-size').dataset.size);
        // NaNを0として扱う
        aValue = isNaN(aValue) ? 0 : aValue;
        bValue = isNaN(bValue) ? 0 : bValue;
      } else {
        aValue = a.cells[columnIndex].textContent.trim();
        bValue = b.cells[columnIndex].textContent.trim();
      }

      if (aValue < bValue) return ascending ? -1 : 1;
      if (aValue > bValue) return ascending ? 1 : -1;
      return 0;
    });

    // テーブルを再構築
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
  }

  // モーダルウィンドウを作成して表示
  function displayResults() {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('sp-storage-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHtml = `
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
            <div id="sp-storage-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
            ">
                <div style="
                    background: white;
                    width: 90%;
                    height: 90%;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                ">
                    <div style="
                      padding: 20px;
                      border-bottom: 1px solid #ddd;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                    ">
                      <h2 style="margin: 0; font-size: 24px;">SharePoint ストレージ詳細 <span style="font-size: 14px; color: #666;">(Search API版)</span></h2>
                      <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                        <div style="display:flex; align-items:center; gap:12px;">
                          <label style="display:flex; align-items:center; gap:6px; font-size:14px;">
                          <input type="checkbox" id="chk-show-versions-columns" style="cursor:pointer;">
                          <span>バージョンを含める</span>
                          <div id="version-spinner" style="display:none; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; width: 16px; height: 16px; animation: spin 2s linear infinite;"></div>
                          </label>
                          <button id="sp-storage-close" style="
                            background: #d32f2f;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 16px;
                          ">閉じる</button>
                        </div>
                        <div id="version-limit-controls" style="display:none; align-items:center; gap:8px; font-size:13px;">
                          <label style="display:flex; align-items:center; gap:8px;">
                            <span>取得件数:</span>
                            <input type="range" id="version-limit-slider" min="1" max="1000" step="1" value="30" style="width:150px;">
                            <span id="version-limit-value" style="min-width:60px; font-weight:bold;">上位30件</span>
                          </label>
                          <div id="version-progress-container" style="display:none; align-items:center; gap:6px;">
                            <div class="spinner" style="
                              border: 2px solid #f3f3f3;
                              border-top: 2px solid #3498db;
                              border-radius: 50%;
                              width: 16px;
                              height: 16px;
                              animation: spin 1s linear infinite;
                            "></div>
                            <span id="version-progress" style="font-weight:bold; color:#0078d4;">0/30</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style="padding: 20px; background: #f5f5f5;">
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 14px; margin-bottom: 15px;">
                            <div style="display: flex; gap: 30px;">
                                <div><strong>合計サイズ:</strong> ${formatBytes(storageData.totalSize)}</div>
                                <div><strong>ファイル数:</strong> ${storageData.totalFiles.toLocaleString()}</div>
                                <div><strong>フォルダ数:</strong> ${storageData.totalFolders.toLocaleString()}</div>
                            </div>
                            <div id="versions-size-display" style="display:none; padding: 8px; background: #e3f2fd; border-radius: 4px;">
                              <div style="display: flex; gap: 40px; margin-bottom: 4px;">
                                <div style="min-width: 120px;"></div>
                                <div style="min-width: 120px; font-weight: bold;">ファイルサイズ</div>
                                <div style="min-width: 140px; font-weight: bold;">バージョン込み</div>
                              </div>
                              <div id="versions-filtered-row" style="display: flex; gap: 40px; margin-bottom: 2px;">
                                <div style="min-width: 120px; font-weight: bold;">versions制約有:</div>
                                <div style="min-width: 120px;"><span id="versions-filtered-file-size">-</span></div>
                                <div style="min-width: 140px;"><span id="versions-filtered-with-versions-size">-</span></div>
                              </div>
                              <div id="versions-total-row" style="display: flex; gap: 40px;">
                                <div style="min-width: 120px; font-weight: bold;">versions制約無:</div>
                                <div style="min-width: 120px;"><span id="versions-total-file-size">-</span></div>
                                <div style="min-width: 140px; color: #999;">-</div>
                              </div>
                              <div style="margin-top: 4px; font-size: 12px; color: #666;">
                                (<span id="versions-file-count">-</span> のファイルを表示中)
                              </div>
                            </div>
                        </div>
                        <div style="display: none; gap: 30px; font-size: 16px; margin-bottom: 15px;">
                            <div><strong>合計サイズ:</strong> ${formatBytes(storageData.totalSize)}</div>
                            <div><strong>ファイル数:</strong> ${storageData.totalFiles.toLocaleString()}</div>
                            <div><strong>フォルダ数:</strong> ${storageData.totalFolders.toLocaleString()}</div>
                        </div>
                        <div style="margin-bottom: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 14px;">
                            <strong>注意:</strong> Search API はクロールベースのため、直前の変更が反映されない場合があります
                        </div>
                        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                <input type="checkbox" id="filter-files" checked style="cursor: pointer;">
                                <span>ファイル</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                                <input type="checkbox" id="filter-folders" checked style="cursor: pointer;">
                                <span>フォルダ</span>
                            </label>
                            <select id="filter-ext" style="padding:5px 10px; border:1px solid #ccc; border-radius:4px;">
                              <option value="">拡張子で絞り込み (すべて)</option>
                            </select>
                            <input type="text" id="filter-search" placeholder="部分一致検索... (即時反映)"
                                   style="padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px; width: 250px;">
                            <button id="clear-filter" style="background: #666; color: white; border: none;
                                    padding: 5px 15px; border-radius: 4px; cursor: pointer;">クリア</button>
                        </div>
                    </div>

                    <div style="
                        flex: 1;
                        overflow: auto;
                        padding: 20px;
                    ">
                        <table id="sp-storage-table" style="
                            width: 100%;
                            border-collapse: collapse;
                            background: white;
                            table-layout: fixed;
                        ">
                            <thead>
                                <tr style="background: #333; color: white;">
                                  <th style="padding: 12px; text-align: left; cursor: pointer; position: relative;" data-column="0">名前 ↕</th>
                                  <th style="padding: 12px; text-align: left; cursor: pointer; width: 120px; position: relative;" data-column="1">サイズ ↕</th>
                                  <th class="versions-col" style="padding: 12px; text-align: left; cursor: pointer; width: 120px; position: relative; display:none;" data-column="2">バージョン数 ↕</th>
                                  <th class="versions-col" style="padding: 12px; text-align: left; cursor: pointer; width: 140px; position: relative; display:none;" data-column="3">バージョン合計 ↕</th>
                                  <th style="padding: 12px; text-align: left; cursor: pointer; width: 100px; position: relative;" data-column="4">拡張子 ↕</th>
                                  <th style="padding: 12px; text-align: left; width: 180px;" data-column="5" title="ファイル数 / フォルダ数">内容 (ファイル/フォルダ)</th>
                                  <th style="padding: 12px; text-align: left; cursor: pointer; width: 250px; position: relative;" data-column="6">親フォルダ ↕</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateTableRows(storageData.items)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 拡張子ドロップダウンを充填
    try {
      const extSet = new Set();
      function collectExts(items) {
        for (const it of items) {
          if (it.type === 'file' && it.ext) extSet.add(it.ext);
          if (it.children && it.children.length) collectExts(it.children);
        }
      }
      collectExts(storageData.items || []);
      const extSelect = document.getElementById('filter-ext');
      if (extSelect) {
        // 既存のオプションを残して追加
        const exts = Array.from(extSet).sort();
        for (const e of exts) {
          const opt = document.createElement('option');
          opt.value = e;
          opt.textContent = e;
          extSelect.appendChild(opt);
        }
      }
    } catch (e) {
      console.warn('拡張子ドロップダウンの生成に失敗:', e);
    }

    // イベントリスナーを設定
    document.getElementById('sp-storage-close').addEventListener('click', () => {
      document.getElementById('sp-storage-modal').remove();
    });

    // 列幅の自動判定（最初の10件を基に）
    (function autoSizeColumns() {
      try {
        const table = document.getElementById('sp-storage-table');
        const tbodyRows = Array.from(table.querySelectorAll('tbody tr')).slice(0, 10);
        if (tbodyRows.length === 0) return;

        const colCount = table.querySelectorAll('thead th').length;
        const widths = new Array(colCount).fill(0);

        // 仮の要素を使ってテキスト幅を計測
        const measurer = document.createElement('span');
        measurer.style.visibility = 'hidden';
        measurer.style.whiteSpace = 'nowrap';
        measurer.style.position = 'absolute';
        measurer.style.left = '-9999px';
        document.body.appendChild(measurer);

        tbodyRows.forEach(row => {
          Array.from(row.cells).forEach((cell, idx) => {
            const txt = cell.textContent || '';
            measurer.textContent = txt;
            const w = measurer.offsetWidth;
            if (w > widths[idx]) widths[idx] = w;
          });
        });

        // ヘッダーに幅を反映（パディング余裕を少し追加）
        // ただし、非表示の列（versions-col）はスキップして元の幅を保持
        const ths = table.querySelectorAll('thead th');
        ths.forEach((th, i) => {
          // 非表示の列はスキップ（初期状態のwidth設定を保持）
          if (th.classList.contains('versions-col')) return;
          if (widths[i]) th.style.width = (widths[i] + 40) + 'px';
        });

        measurer.remove();
      } catch (e) {
        console.warn('自動列幅判定に失敗:', e);
      }
    })();

    // 列リサイズ（シンプル実装）
    (function attachResizers() {
      try {
        const table = document.getElementById('sp-storage-table');
        const ths = table.querySelectorAll('thead th');
        ths.forEach(th => {
          const resizer = document.createElement('div');
          resizer.style.position = 'absolute';
          resizer.style.top = '0';
          resizer.style.right = '0';
          resizer.style.width = '6px';
          resizer.style.cursor = 'col-resize';
          resizer.style.userSelect = 'none';
          resizer.style.height = '100%';
          th.style.position = 'relative';
          th.appendChild(resizer);

          let startX, startWidth;
          resizer.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startWidth = th.offsetWidth;
            document.body.style.cursor = 'col-resize';

            function onMouseMove(ev) {
              const dx = ev.clientX - startX;
              th.style.width = Math.max(40, startWidth + dx) + 'px';
            }

            function onMouseUp() {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              document.body.style.cursor = '';
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          });
        });
      } catch (e) {
        console.warn('列リサイズの初期化に失敗:', e);
      }
    })();

    // ソート機能
    const headers = document.querySelectorAll('#sp-storage-table th[data-column]');
    headers.forEach(header => {
      let ascending = true;
      header.addEventListener('click', () => {
        const column = parseInt(header.dataset.column);
        sortTable(column, ascending);
        ascending = !ascending;
      });
    });

    // フィルター機能（即時反映）
    const extEl = document.getElementById('filter-ext');
    if (extEl) extEl.addEventListener('change', applyFilter);
    document.getElementById('clear-filter').addEventListener('click', clearFilter);
    const searchEl = document.getElementById('filter-search');
    if (searchEl) searchEl.addEventListener('input', applyFilter);
    document.getElementById('filter-files').addEventListener('change', applyFilter);
    document.getElementById('filter-folders').addEventListener('change', applyFilter);

    // 名前クリック時の処理
    document.querySelectorAll('.item-name').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = e.target.closest('tr');
        const path = row.dataset.path;
        const fullUrl = `${window.location.origin}${path}`;
        window.open(fullUrl, '_blank');
      });
    });

    // 親フォルダクリック時の処理
    document.querySelectorAll('.parent-path').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentPath = e.target.textContent;
        if (parentPath && parentPath !== '/') {
          const fullUrl = `${window.location.origin}${parentPath}`;
          window.open(fullUrl, '_blank');
        }
      });
    });

    // フォルダ展開/折りたたみの処理
    document.querySelectorAll('.folder-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = e.target.closest('tr');
        const currentDepth = parseInt(row.dataset.depth);
        const isExpanded = e.target.textContent === '▼';

        // アイコンを切り替え
        e.target.textContent = isExpanded ? '▶' : '▼';

        // 次の行から、同じまたはより深い階層の行を探して表示/非表示
        let nextRow = row.nextElementSibling;
        while (nextRow && parseInt(nextRow.dataset.depth) > currentDepth) {
          const nextDepth = parseInt(nextRow.dataset.depth);
          if (nextDepth === currentDepth + 1) {
            // 直接の子要素
            nextRow.style.display = isExpanded ? 'none' : '';
          } else {
            // 孫要素以降：親が折りたたまれたら非表示
            nextRow.style.display = isExpanded ? 'none' : nextRow.style.display;
          }

          // 折りたたみ時：すべての子孫フォルダのアイコンを閉じた状態にリセット
          if (isExpanded) {
            const childToggleIcon = nextRow.querySelector('.folder-toggle');
            if (childToggleIcon) {
              childToggleIcon.textContent = '▶';
            }
          }

          nextRow = nextRow.nextElementSibling;
        }
      });
    });

    // バージョン列の表示切替と初回取得ロジック
    const chk = document.getElementById('chk-show-versions-columns');
    function setVersionsColumnsVisible(visible) {
      const cols = document.querySelectorAll('.versions-col');
      cols.forEach(c => c.style.display = visible ? '' : 'none');
      // バージョン込み合計サイズの表示も連動
      const versionsSizeDisplay = document.getElementById('versions-size-display');
      if (versionsSizeDisplay) {
        versionsSizeDisplay.style.display = visible ? '' : 'none';
      }
    }

    // 表示フィルタリング関数（上位N件のみ表示）
    function applyDisplayFilter(displayTopN) {
      const allRows = Array.from(document.querySelectorAll('#sp-storage-table tbody tr[data-type="file"]'));

      // 全行をサイズでソート（降順）
      const sortedRows = allRows
        .map(row => {
          const sizeCell = row.querySelector('.sp-storage-size');
          const size = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;
          return { row, size };
        })
        .sort((a, b) => b.size - a.size);

      // 表示されているファイルのサイズと全ファイルのサイズを計算
      let displayedFileSize = 0;
      let displayedWithVersionsSize = 0;
      let totalAllFilesSize = 0;
      let totalAllWithVersionsSize = 0;

      // 表示フィルタリング
      if (displayTopN !== null && displayTopN < sortedRows.length) {
        sortedRows.forEach((item, index) => {
          const row = item.row;
          const serverPath = row.getAttribute('data-path');
          const sizeCell = row.querySelector('.sp-storage-size');
          const originalSize = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;

          // 全ファイルのサイズを集計
          totalAllFilesSize += originalSize;
          totalAllWithVersionsSize += originalSize;
          if (serverPath && versionsCache.has(serverPath)) {
            const entry = versionsCache.get(serverPath);
            if (entry && entry.totalSize && !entry.errorStatus) {
              totalAllWithVersionsSize += entry.totalSize;
            }
          }

          // 表示/非表示の切り替え（data-versions-hidden属性で管理）
          if (index < displayTopN) {
            row.removeAttribute('data-versions-hidden');
            // 基本フィルターで表示されている場合のみ表示
            if (row.style.display !== 'none' || !row.style.display) {
              row.style.display = '';
            }
            // 表示されているファイルのサイズを集計
            displayedFileSize += originalSize;
            displayedWithVersionsSize += originalSize;
            if (serverPath && versionsCache.has(serverPath)) {
              const entry = versionsCache.get(serverPath);
              if (entry && entry.totalSize && !entry.errorStatus) {
                displayedWithVersionsSize += entry.totalSize;
              }
            }
          } else {
            row.setAttribute('data-versions-hidden', 'true');
            row.style.display = 'none';
          }
        });
      } else {
        sortedRows.forEach(item => {
          const row = item.row;
          const serverPath = row.getAttribute('data-path');
          const sizeCell = row.querySelector('.sp-storage-size');
          const originalSize = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;

          totalAllFilesSize += originalSize;
          totalAllWithVersionsSize += originalSize;
          if (serverPath && versionsCache.has(serverPath)) {
            const entry = versionsCache.get(serverPath);
            if (entry && entry.totalSize && !entry.errorStatus) {
              totalAllWithVersionsSize += entry.totalSize;
            }
          }

          row.removeAttribute('data-versions-hidden');
        });
        displayedFileSize = totalAllFilesSize;
        displayedWithVersionsSize = totalAllWithVersionsSize;
      }

      // サイズ表示を2行表示で更新
      const versionsFilteredFileSizeEl = document.getElementById('versions-filtered-file-size');
      const versionsFilteredWithVersionsSizeEl = document.getElementById('versions-filtered-with-versions-size');
      const versionsTotalFileSizeEl = document.getElementById('versions-total-file-size');
      const versionsFileCountEl = document.getElementById('versions-file-count');
      const versionsFilteredRow = document.getElementById('versions-filtered-row');

      if (versionsFilteredFileSizeEl && versionsFilteredWithVersionsSizeEl && versionsTotalFileSizeEl && versionsFileCountEl && versionsFilteredRow) {
        // 制約有（フィルター後）の表示
        if (displayTopN !== null && displayTopN < sortedRows.length) {
          versionsFilteredRow.style.display = 'flex';
          versionsFilteredFileSizeEl.textContent = formatBytes(displayedFileSize);
          versionsFilteredWithVersionsSizeEl.textContent = formatBytes(displayedWithVersionsSize);
          // 件数表示
          versionsFileCountEl.textContent = `${displayTopN}/${sortedRows.length}件`;
        } else {
          versionsFilteredRow.style.display = 'none';
          // 全件表示時
          versionsFileCountEl.textContent = `${sortedRows.length}/${sortedRows.length}件`;
        }

        // 制約無（全体）の表示
        versionsTotalFileSizeEl.textContent = formatBytes(totalAllFilesSize);
      }
    }

    // バージョン情報取得用のasync関数（表示フィルタリング対応）
    async function fetchVersionsForVisibleFiles(displayTopN, startFrom) {
      // 進捗表示コンテナとスピナーを表示
      const progressContainer = document.getElementById('version-progress-container');
      const progressText = document.getElementById('version-progress');
      if (progressContainer) progressContainer.style.display = 'flex';

      // バージョン込み合計サイズを積算（0から開始）
      let versionsTotalSize = 0;

      // 逐次実行（過負荷防止）：1件ずつ遅延を入れて実行
      const allRows = Array.from(document.querySelectorAll('#sp-storage-table tbody tr[data-type="file"]'));

      // 全行をサイズでソート（降順）
      const sortedRows = allRows
        .map(row => {
          const sizeCell = row.querySelector('.sp-storage-size');
          const size = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;
          return { row, size };
        })
        .sort((a, b) => b.size - a.size);

      // displayTopNが指定されている場合は上位N件のみフェッチ、nullの場合は全件フェッチ
      const rowsToFetch = displayTopN !== null ? sortedRows.slice(0, displayTopN) : sortedRows;
      const totalToFetch = rowsToFetch.length;

      for (let i = 0; i < rowsToFetch.length; i++) {
        // 進捗表示を更新
        if (progressText) {
          progressText.textContent = `${i + 1}/${totalToFetch}`;
        }

        // startFromより前はスキップ（既に取得済み）
        if (i < startFrom) {
          const item = rowsToFetch[i];
          const row = item.row;
          const sizeCell = row.querySelector('.sp-storage-size');
          const originalSize = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;
          versionsTotalSize += originalSize;
          const serverPath = row.getAttribute('data-path');
          if (serverPath && versionsCache.has(serverPath)) {
            const entry = versionsCache.get(serverPath);
            if (entry && entry.totalSize && !entry.errorStatus) {
              versionsTotalSize += entry.totalSize;
            }
          }
          continue;
        }

        const item = rowsToFetch[i];
        const row = item.row;
        const serverPath = row.getAttribute('data-path');
        if (!serverPath) continue;

        // 元のファイルサイズを取得
        const sizeCell = row.querySelector('.sp-storage-size');
        const originalSize = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;

        // 既にキャッシュがあれば即時反映
        if (versionsCache.has(serverPath)) {
          const entry = versionsCache.get(serverPath);
          updateRowWithVersions(serverPath, entry);
          // 現在のファイルサイズを加算
          versionsTotalSize += originalSize;
          // バージョン情報がある場合はバージョンサイズも加算
          if (entry && entry.totalSize && !entry.errorStatus) {
            versionsTotalSize += entry.totalSize;
          }
          continue;
        }
        // フェッチ
        try {
          updateProgress(`バージョン情報を取得中 (${i + 1}/${totalToFetch}): ${serverPath}`);
          const entry = await fetchVersionsForFile(serverPath);
          updateRowWithVersions(serverPath, entry);
          // 現在のファイルサイズを加算
          versionsTotalSize += originalSize;
          // バージョン情報がある場合はバージョンサイズも加算
          if (entry && entry.totalSize && !entry.errorStatus) {
            versionsTotalSize += entry.totalSize;
          }
          // 軽い遅延
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          console.warn('バージョン取得失敗:', serverPath, e);
          versionsTotalSize += originalSize;
        }
      }
      updateProgress('バージョン情報の取得完了');

      // **表示フィルタリング**: displayTopNが指定されている場合、上位N件のみ表示
      let displayedFileSize = 0; // 表示中のファイルサイズのみ
      let displayedWithVersionsSize = 0; // 表示中のファイル＋バージョンサイズ

      // 全ファイルの合計サイズを計算（フェッチしていない分も含む）
      let totalAllFilesSize = 0;
      let totalAllWithVersionsSize = 0;
      sortedRows.forEach(item => {
        const row = item.row;
        const serverPath = row.getAttribute('data-path');
        const sizeCell = row.querySelector('.sp-storage-size');
        const originalSize = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;
        totalAllFilesSize += originalSize;
        totalAllWithVersionsSize += originalSize;
        if (serverPath && versionsCache.has(serverPath)) {
          const entry = versionsCache.get(serverPath);
          if (entry && entry.totalSize && !entry.errorStatus) {
            totalAllWithVersionsSize += entry.totalSize;
          }
        }
      });

      if (displayTopN !== null && displayTopN < sortedRows.length) {
        // 上位N件のみ表示、それ以外は非表示
        sortedRows.forEach((item, index) => {
          const row = item.row;
          const serverPath = row.getAttribute('data-path');
          if (index < displayTopN) {
            row.removeAttribute('data-versions-hidden');
            row.style.display = ''; // 表示
            // 表示されているファイルのサイズを計算
            const sizeCell = row.querySelector('.sp-storage-size');
            const originalSize = sizeCell ? parseInt(sizeCell.getAttribute('data-size') || '0', 10) : 0;
            displayedFileSize += originalSize;
            displayedWithVersionsSize += originalSize;
            if (serverPath && versionsCache.has(serverPath)) {
              const entry = versionsCache.get(serverPath);
              if (entry && entry.totalSize && !entry.errorStatus) {
                displayedWithVersionsSize += entry.totalSize;
              }
            }
          } else {
            row.setAttribute('data-versions-hidden', 'true');
            row.style.display = 'none'; // 非表示
          }
        });
      } else {
        // 全件表示
        sortedRows.forEach(item => {
          item.row.removeAttribute('data-versions-hidden');
          item.row.style.display = ''; // 表示
        });
        displayedFileSize = totalAllFilesSize;
        displayedWithVersionsSize = totalAllWithVersionsSize;
      }

      // バージョン込み合計サイズを2行表示で更新
      const versionsFilteredFileSizeEl = document.getElementById('versions-filtered-file-size');
      const versionsFilteredWithVersionsSizeEl = document.getElementById('versions-filtered-with-versions-size');
      const versionsTotalFileSizeEl = document.getElementById('versions-total-file-size');
      const versionsFileCountEl = document.getElementById('versions-file-count');
      const versionsFilteredRow = document.getElementById('versions-filtered-row');

      if (versionsFilteredFileSizeEl && versionsFilteredWithVersionsSizeEl && versionsTotalFileSizeEl && versionsFileCountEl && versionsFilteredRow) {
        // 制約有（フィルター後）の表示
        if (displayTopN !== null && displayTopN < sortedRows.length) {
          versionsFilteredRow.style.display = 'flex';
          versionsFilteredFileSizeEl.textContent = formatBytes(displayedFileSize);
          versionsFilteredWithVersionsSizeEl.textContent = formatBytes(displayedWithVersionsSize);
          // 件数表示
          versionsFileCountEl.textContent = `${displayTopN}/${sortedRows.length}件`;
        } else {
          versionsFilteredRow.style.display = 'none';
          // 全件表示時
          versionsFileCountEl.textContent = `${sortedRows.length}/${sortedRows.length}件`;
        }

        // 制約無（全体）の表示
        versionsTotalFileSizeEl.textContent = formatBytes(totalAllFilesSize);
      }

      // 進捗表示を非表示
      if (progressContainer) progressContainer.style.display = 'none';
    }

    if (chk) {
      let currentLimit = null; // null = 全件取得

      chk.addEventListener('change', async (e) => {
        const show = e.target.checked;
        setVersionsColumnsVisible(show);

        if (show) {
          // ファイル総数を取得
          const totalFiles = document.querySelectorAll('#sp-storage-table tbody tr[data-type="file"]').length;
          // デフォルト値：30件（ファイル総数が少ない場合はその数）
          const defaultLimit = Math.min(30, totalFiles);

          // 件数入力付き確認ダイアログ表示
          const userInput = prompt(
            '大量のファイルがある場合、サイズ上位のファイルのみバージョン情報を取得することで高速化できます。\n\n' +
            '上位ファイルのみ取得する場合は件数を入力してください（例: ' + defaultLimit + '）\n' +
            `全件取得する場合は「キャンセル」を押してください\n\n（総ファイル数: ${totalFiles.toLocaleString()}件）`,
            String(defaultLimit)
          );

          if (userInput !== null && userInput.trim() !== '') {
            // 上位n件モード（ユーザー入力値を使用）
            const inputLimit = parseInt(userInput.trim(), 10);
            if (!isNaN(inputLimit) && inputLimit > 0) {
              const limitControls = document.getElementById('version-limit-controls');
              const slider = document.getElementById('version-limit-slider');
              if (limitControls && slider) {
                // まずコントロールを表示
                limitControls.style.display = 'flex';
                // スライダーの最小値と最大値を設定
                slider.min = 1;
                slider.max = totalFiles;
                // スライダーの値を更新（ファイル総数を超えないように）
                const actualLimit = Math.min(inputLimit, totalFiles);
                slider.value = actualLimit;
                const valueLabel = document.getElementById('version-limit-value');
                if (valueLabel) valueLabel.textContent = `上位${actualLimit}件`;
                currentLimit = actualLimit;
                fetchVersionsForVisibleFiles(currentLimit, 0).catch(err => console.warn('バージョン取得でエラー:', err));
              }
            } else {
              alert('無効な数値です。全件取得モードで実行します。');
              currentLimit = null;
              fetchVersionsForVisibleFiles(null, 0).catch(err => console.warn('バージョン取得でエラー:', err));
            }
          } else {
            // 全件取得モード（キャンセル押下時）
            currentLimit = null;
            fetchVersionsForVisibleFiles(null, 0).catch(err => console.warn('バージョン取得でエラー:', err));
          }
        } else {
          // チェックOFF時はスライダーも非表示
          const limitControls = document.getElementById('version-limit-controls');
          if (limitControls) limitControls.style.display = 'none';
        }
      });

      // スライダー変更時のハンドラー
      const slider = document.getElementById('version-limit-slider');
      const valueLabel = document.getElementById('version-limit-value');
      if (slider && valueLabel) {
        slider.addEventListener('input', (e) => {
          const value = parseInt(e.target.value, 10);
          valueLabel.textContent = `上位${value}件`;
        });

        slider.addEventListener('change', async (e) => {
          const newLimit = parseInt(e.target.value, 10);
          const oldLimit = currentLimit;
          currentLimit = newLimit;

          if (chk.checked) {
            if (oldLimit !== null && newLimit > oldLimit) {
              // 件数を増やした場合：追加分をフェッチ
              await fetchVersionsForVisibleFiles(newLimit, oldLimit);
            } else {
              // 件数を減らした場合：表示フィルタのみ更新
              applyDisplayFilter(newLimit);
            }
          }
        });
      }
    }
    // 初期状態ではバージョン列を非表示
    try { setVersionsColumnsVisible(false); } catch (e) { /* ignore */ }
  }

  // ローディング表示
  function showLoading() {
    const loadingHtml = `
            <div id="sp-storage-loading" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10001;
                display: flex;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                color: white;
                font-size: 20px;
            ">
                <div style="margin-bottom: 20px;">データを取得中...</div>
                <div id="sp-storage-progress" style="font-size: 14px; color: #ccc;">準備中...</div>
            </div>
        `;
    document.body.insertAdjacentHTML('beforeend', loadingHtml);
  }

  function hideLoading() {
    const loading = document.getElementById('sp-storage-loading');
    if (loading) {
      loading.remove();
    }
  }

  // メイン処理（サイト・ライブラリ選択対応版）
  async function main() {
    try {
      showLoading();
      updateProgress('SharePoint コンテキストを確認中...');

      // SharePoint コンテキストを取得
      const context = getSiteContext();
      console.log('SharePoint コンテキスト:', context);
      updateProgress(`サイト検出完了 (${context.source})`);

      updateProgress('利用可能なサイトを検出中...');

      // 1. 利用可能なサイトを取得
      const availableSites = await getAvailableSites();

      if (availableSites.length === 0) {
        throw new Error('利用可能なサイトが見つかりません。');
      }

      let selectedSite;

      // 2. サイト選択（複数ある場合はダイアログ表示、単一の場合は自動選択）
      if (availableSites.length === 1) {
        selectedSite = availableSites[0];
        updateProgress(`対象サイト: ${selectedSite.title}`);
      } else {
        hideLoading(); // ダイアログ表示前にローディングを隠す
        selectedSite = await showSiteSelectionDialog(availableSites);
        if (!selectedSite) {
          console.log('サイト選択がキャンセルされました');
          return; // キャンセルされた場合
        }
        showLoading(); // 再度ローディングを表示
      }

      // 現在のサイト情報を設定
      currentSiteInfo.absoluteUrl = selectedSite.url;
      currentSiteInfo.serverRelativeUrl = selectedSite.serverRelativeUrl || (new URL(selectedSite.url)).pathname || '';

      updateProgress(`サイト「${selectedSite.title}」のドキュメントライブラリを取得中...`);

      // 3. 選択されたサイトのドキュメントライブラリを取得
      const libraries = await getDocumentLibraries(selectedSite.url);

      if (libraries.length === 0) {
        alert(`サイト「${selectedSite.title}」にドキュメントライブラリが見つかりませんでした。`);
        hideLoading();
        return;
      }

      let selectedLibrary;

      // 4. ライブラリ選択（複数ある場合はダイアログ表示、単一の場合は自動選択）
      if (libraries.length === 1) {
        selectedLibrary = libraries[0];
        updateProgress(`対象ライブラリ: ${selectedLibrary.Title}`);
      } else {
        hideLoading(); // ダイアログ表示前にローディングを隠す
        selectedLibrary = await showLibrarySelectionDialog(selectedSite, libraries);
        if (!selectedLibrary) {
          console.log('ライブラリ選択がキャンセルされました');
          return; // キャンセルされた場合
        }
        showLoading(); // 再度ローディングを表示
      }

      console.log('選択された設定:', {
        site: selectedSite,
        library: selectedLibrary
      });

      // 5. Search API で選択されたライブラリのファイルを取得
      const libraryPath = selectedLibrary.RootFolder.ServerRelativeUrl;
      const files = await getAllFilesBySearch(selectedSite.url, libraryPath);

      if (files.length === 0) {
        alert(`ライブラリ「${selectedLibrary.Title}」にファイルが見つかりませんでした。検索インデックスが更新されていない可能性があります。`);
        hideLoading();
        return;
      }

      // 6. フォルダ階層を構築
      storageData.items = buildFolderHierarchy(files);

      hideLoading();
      displayResults();

      console.log('解析完了:', {
        site: selectedSite.title,
        library: selectedLibrary.Title,
        totalFiles: storageData.totalFiles,
        totalFolders: storageData.totalFolders,
        totalSize: formatBytes(storageData.totalSize)
      });

    } catch (error) {
      hideLoading();
      console.error('エラーが発生しました:', error);
      alert(`エラーが発生しました: ${error.message}\n\n詳細はコンソールを確認してください。`);
    }
  }

  // 実行
  main();
})();
