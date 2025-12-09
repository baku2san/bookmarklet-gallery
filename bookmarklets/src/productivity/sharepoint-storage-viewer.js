/**
 * SharePoint Storage Details Viewer - Bookmarklet (Search API版)
 *
 * SharePoint のストレージ使用状況を詳細表示する Bookmarklet
 *
 * 機能:
 * - Search API で全ファイルを一括取得（API呼び出し数を大幅削減）
 * - ファイルサイズを集計して階層表示
 * - ソート可能なテーブルで表示
 * - フォルダごとのサイズ集計
 *
 * 使用方法:
 * 1. SharePoint サイトのページで実行
 * 2. 自動的にデータ取得が開始される
 * 3. モーダルウィンドウで結果を表示
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

  // SharePoint コンテキスト情報の取得
  function getSiteContext() {
    if (typeof _spPageContextInfo === 'undefined') {
      throw new Error('SharePoint コンテキストが見つかりません。SharePoint サイトで実行してください。');
    }
    return {
      webAbsoluteUrl: _spPageContextInfo.webAbsoluteUrl,
      webServerRelativeUrl: _spPageContextInfo.webServerRelativeUrl,
      siteServerRelativeUrl: _spPageContextInfo.siteServerRelativeUrl
    };
  }

  // REST API リクエストヘルパー
  async function spRestRequest(endpoint, method = 'GET') {
    const context = getSiteContext();
    const url = `${context.webAbsoluteUrl}${endpoint}`;

    const headers = {
      'Accept': 'application/json;odata=verbose',
      'Content-Type': 'application/json;odata=verbose'
    };

    const response = await fetch(url, {
      method: method,
      headers: headers,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`API エラー: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Search API で全ファイルを取得（ページネーション対応）
  async function getAllFilesBySearch() {
    const context = getSiteContext();
    const siteUrl = context.webAbsoluteUrl;
    const rowLimit = 500; // 1回のリクエストで取得する件数
    let startRow = 0;
    const allFiles = [];
    let totalRetrieved = 0;

    updateProgress('Search API でファイル情報を取得中...');

    while (true) {
      // クエリ構築: サイト内のドキュメントのみを検索
      const queryText = `Path:"${siteUrl}" AND IsDocument:1`;
      const selectProperties = 'Path,Size,Title,LastModifiedTime,FileExtension';

      // エンコードしてエンドポイント構築
      const encodedQuery = encodeURIComponent(queryText);
      const encodedSelect = encodeURIComponent(selectProperties);
      const endpoint = `/_api/search/query?querytext='${encodedQuery}'&selectproperties='${encodedSelect}'&rowlimit=${rowLimit}&startrow=${startRow}&trimduplicates=false`;

      try {
        const data = await spRestRequest(endpoint);

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

          // Cells から Key-Value ペアを抽出
          cells.forEach(cell => {
            fileInfo[cell.Key] = cell.Value;
          });

          const path = fileInfo.Path || '';
          const size = parseInt(fileInfo.Size, 10) || 0;
          const modified = fileInfo.LastModifiedTime ? new Date(fileInfo.LastModifiedTime) : null;
          const title = fileInfo.Title || '';

          // サーバー相対パスに変換（フルURLの場合）
          let serverRelativePath = path;
          if (path.startsWith('http')) {
            try {
              const url = new URL(path);
              serverRelativePath = url.pathname;
            } catch (e) {
              console.warn('URL解析失敗:', path);
            }
          }

          allFiles.push({
            path: serverRelativePath,
            name: title || serverRelativePath.split('/').pop(),
            size: size,
            modified: modified,
            type: 'file'
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
    const icon = item.type === 'folder' ? '📁' : '📄';
    const sizeText = formatBytes(item.size);
    const countText = item.type === 'folder' ? `${item.fileCount}ファイル, ${item.folderCount}フォルダ` : '';
    // 親フォルダパスを取得（パスから最後のセグメントを除いたもの）
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/')) || '/';

    return `
            <tr class="sp-storage-row" data-type="${item.type}" data-depth="${level}" data-path="${escapeHtml(item.path)}">
                <td style="word-break: break-word;">${indent}${icon} <span class="item-name" style="color: #0078d4; cursor: pointer; text-decoration: underline;">${escapeHtml(item.name)}</span></td>
                <td class="sp-storage-size" data-size="${item.size}">${sizeText}</td>
                <td>${countText}</td>
                <td title="${parentPath}" style="word-break: break-word;"><span class="parent-path" style="color: #0078d4; cursor: pointer; text-decoration: underline;">${escapeHtml(parentPath)}</span></td>
            </tr>
        `;
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

  // フィルター適用
  function applyFilter() {
    const showFiles = document.getElementById('filter-files').checked;
    const showFolders = document.getElementById('filter-folders').checked;
    const searchText = document.getElementById('filter-search').value.toLowerCase();

    const rows = document.querySelectorAll('#sp-storage-table tbody tr');
    rows.forEach(row => {
      const type = row.getAttribute('data-type');
      const nameCell = row.cells[0].textContent;
      const parentCell = row.cells[3].textContent;

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

      // 両方の条件を満たす場合のみ表示
      if (typeMatch && textMatch) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // フィルタークリア
  function clearFilter() {
    document.getElementById('filter-files').checked = true;
    document.getElementById('filter-folders').checked = true;
    document.getElementById('filter-search').value = '';
    applyFilter();
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

                    <div style="padding: 20px; background: #f5f5f5;">
                        <div style="display: flex; gap: 30px; font-size: 16px; margin-bottom: 15px;">
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
                            <input type="text" id="filter-search" placeholder="部分一致検索..."
                                   style="padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px; width: 250px;">
                            <button id="apply-filter" style="background: #0078d4; color: white; border: none;
                                    padding: 5px 15px; border-radius: 4px; cursor: pointer;">フィルター適用</button>
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
                                    <th style="padding: 12px; text-align: left; cursor: pointer; width: 35%;" data-column="0">名前 ↕</th>
                                    <th style="padding: 12px; text-align: left; cursor: pointer; width: 15%;" data-column="1">サイズ ↕</th>
                                    <th style="padding: 12px; text-align: left; width: 20%;">内容</th>
                                    <th style="padding: 12px; text-align: left; cursor: pointer; width: 30%;" data-column="3">親フォルダ ↕</th>
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

    // イベントリスナーを設定
    document.getElementById('sp-storage-close').addEventListener('click', () => {
      document.getElementById('sp-storage-modal').remove();
    });

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

    // フィルター機能
    document.getElementById('apply-filter').addEventListener('click', applyFilter);
    document.getElementById('clear-filter').addEventListener('click', clearFilter);
    document.getElementById('filter-search').addEventListener('keyup', (e) => {
      if (e.key === 'Enter') applyFilter();
    });
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

  // メイン処理（Search API版）
  async function main() {
    try {
      showLoading();

      const context = getSiteContext();
      console.log('SharePoint コンテキスト:', context);

      // Search API で全ファイルを取得
      const files = await getAllFilesBySearch();

      if (files.length === 0) {
        alert('ファイルが見つかりませんでした。検索インデックスが更新されていない可能性があります。');
        hideLoading();
        return;
      }

      // フォルダ階層を構築
      storageData.items = buildFolderHierarchy(files);

      hideLoading();
      displayResults();

      console.log('取得完了:', {
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
