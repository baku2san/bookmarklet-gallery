/**
 * SharePoint Storage Details Viewer - Bookmarklet
 *
 * SharePoint のストレージ使用状況を詳細表示する Bookmarklet
 *
 * 機能:
 * - サイト内のすべてのフォルダとファイルを再帰的に取得
 * - ファイルサイズを集計して階層表示
 * - ソート可能なテーブルで表示
 * - フォルダごとのサイズ集計
 *
 * 使用方法:
 * 1. SharePoint サイトのページで実行
 * 2. 自動的にデータ取得が開始される
 * 3. モーダルウィンドウで結果を表示
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

  // フォルダ内のファイル一覧を取得
  async function getFilesInFolder(folderUrl) {
    const endpoint = `/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Files?$select=Name,Length,ServerRelativeUrl,TimeLastModified`;
    try {
      const data = await spRestRequest(endpoint);
      return data.d.results || [];
    } catch (error) {
      console.warn(`フォルダ ${folderUrl} のファイル取得に失敗:`, error);
      return [];
    }
  }

  // フォルダ内のサブフォルダ一覧を取得
  async function getSubFoldersInFolder(folderUrl) {
    const endpoint = `/_api/web/GetFolderByServerRelativeUrl('${encodeURIComponent(folderUrl)}')/Folders?$select=Name,ServerRelativeUrl,ItemCount`;
    try {
      const data = await spRestRequest(endpoint);
      return data.d.results || [];
    } catch (error) {
      console.warn(`フォルダ ${folderUrl} のサブフォルダ取得に失敗:`, error);
      return [];
    }
  }

  // 再帰的にフォルダを走査してデータを収集
  async function scanFolder(folderUrl, depth = 0, parentPath = '') {
    updateProgress(`スキャン中: ${folderUrl}`);

    const folderData = {
      name: folderUrl.split('/').pop(),
      path: folderUrl,
      type: 'folder',
      depth: depth,
      parentPath: parentPath,
      size: 0,
      fileCount: 0,
      folderCount: 0,
      children: []
    };

    // ファイルを取得
    const files = await getFilesInFolder(folderUrl);
    for (const file of files) {
      // file.Lengthがundefinedやnullの場合は0として扱う
      const fileSize = (file.Length != null && !isNaN(file.Length)) ? file.Length : 0;
      const fileData = {
        name: file.Name,
        path: file.ServerRelativeUrl,
        type: 'file',
        depth: depth + 1,
        parentPath: folderUrl,
        size: fileSize,
        modified: new Date(file.TimeLastModified)
      };
      folderData.children.push(fileData);
      folderData.size += fileSize;
      folderData.fileCount++;
      storageData.totalFiles++;
    }

    // サブフォルダを取得して再帰的にスキャン
    const subFolders = await getSubFoldersInFolder(folderUrl);
    for (const subFolder of subFolders) {
      // システムフォルダをスキップ
      if (subFolder.Name === 'Forms') continue;

      const subFolderData = await scanFolder(subFolder.ServerRelativeUrl, depth + 1, folderUrl);
      folderData.children.push(subFolderData);
      // サブフォルダのサイズが有効な場合のみ加算
      const subSize = (subFolderData.size != null && !isNaN(subFolderData.size)) ? subFolderData.size : 0;
      folderData.size += subSize;
      folderData.fileCount += subFolderData.fileCount;
      folderData.folderCount += subFolderData.folderCount + 1;
      storageData.totalFolders++;
    }

    storageData.totalSize += folderData.size;
    return folderData;
  }

  // サイト内のすべてのドキュメントライブラリを取得
  async function getDocumentLibraries() {
    const endpoint = `/_api/web/lists?$filter=BaseTemplate eq 101&$select=Title,RootFolder/ServerRelativeUrl&$expand=RootFolder`;
    const data = await spRestRequest(endpoint);
    return data.d.results || [];
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
        html += generateTableRows(item.children, level + 1);
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
                        <h2 style="margin: 0; font-size: 24px;">SharePoint ストレージ詳細</h2>
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
                                    <th style="padding: 12px; text-align: left; cursor: pointer; width: 35%; resize: horizontal; overflow: auto; position: relative;" data-column="0">名前</th>
                                    <th style="padding: 12px; text-align: left; cursor: pointer; width: 15%; resize: horizontal; overflow: auto;" data-column="1">サイズ</th>
                                    <th style="padding: 12px; text-align: left; width: 20%; resize: horizontal; overflow: auto;">内容</th>
                                    <th style="padding: 12px; text-align: left; cursor: pointer; width: 30%; resize: horizontal; overflow: auto;" data-column="3">親フォルダ</th>
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

  // メイン処理
  async function main() {
    try {
      showLoading();

      // サイトコンテキストを取得
      const context = getSiteContext();
      updateProgress('ドキュメントライブラリを取得中...');

      // ドキュメントライブラリを取得
      const libraries = await getDocumentLibraries();

      if (libraries.length === 0) {
        alert('ドキュメントライブラリが見つかりませんでした。');
        hideLoading();
        return;
      }

      updateProgress(`${libraries.length} 個のライブラリを発見しました。スキャンを開始します...`);

      // 各ライブラリをスキャン
      for (const library of libraries) {
        const folderUrl = library.RootFolder.ServerRelativeUrl;
        const folderData = await scanFolder(folderUrl, 0, '');
        folderData.name = library.Title;
        storageData.items.push(folderData);
      }

      hideLoading();
      displayResults();

    } catch (error) {
      hideLoading();
      console.error('エラーが発生しました:', error);
      alert(`エラーが発生しました: ${error.message}`);
    }
  }

  // 実行
  main();
})();
