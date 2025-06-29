/**
 * 📥 ファイル一括ダウンロード Bookmarklet
 * 現在のページにあるダウンロード可能なファイルを収集・選択・一括ダウンロードします
 *
 * 対応ファイル形式:
 * - 文書: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF
 * - 圧縮: ZIP, RAR, 7Z, TAR, GZ
 * - 画像: JPG, PNG, GIF, SVG, BMP, WEBP
 * - 動画: MP4, AVI, MOV, WMV, FLV
 * - 音声: MP3, WAV, OGG, FLAC
 * - データ: JSON, XML, CSV, SQL
 *
 * 使用方法:
 * 1. ファイルリンクがあるページで実行
 * 2. 検出されたファイルから選択
 * 3. 一括ダウンロード実行
 *
 * セキュリティ: 同一ドメインのファイルのみ対象
 */

javascript: (function () {
  'use strict';

  // =============================================================================
  // MemoryManager - メモリーリーク対策ユーティリティ（File Downloader 用）
  // =============================================================================
  class MemoryManager {
    constructor() {
      this.eventListeners = new Map();
      this.intervals = new Set();
      this.timeouts = new Set();
      this.isCleanedUp = false;
    }

    addEventListener(element, type, handler, options = {}) {
      if (this.isCleanedUp || !element || typeof handler !== 'function') return;

      element.addEventListener(type, handler, options);

      if (!this.eventListeners.has(element)) {
        this.eventListeners.set(element, []);
      }

      this.eventListeners.get(element).push({ type, handler, options });
    }

    setTimeout(callback, delay, ...args) {
      if (this.isCleanedUp) return null;

      const timeoutId = setTimeout(() => {
        this.timeouts.delete(timeoutId);
        callback(...args);
      }, delay);

      this.timeouts.add(timeoutId);
      return timeoutId;
    }

    cleanup() {
      if (this.isCleanedUp) return;

      // イベントリスナーのクリーンアップ
      for (const [element, listeners] of this.eventListeners.entries()) {
        for (const listener of listeners) {
          try {
            element.removeEventListener(listener.type, listener.handler, listener.options);
          } catch (error) {
            console.warn('File Downloader MemoryManager: Error removing event listener:', error);
          }
        }
      }
      this.eventListeners.clear();

      // タイムアウトのクリーンアップ
      for (const timeoutId of this.timeouts) {
        try {
          clearTimeout(timeoutId);
        } catch (error) {
          console.warn('File Downloader MemoryManager: Error clearing timeout:', error);
        }
      }
      this.timeouts.clear();

      this.isCleanedUp = true;
      console.log('📥 File Downloader: メモリークリーンアップ完了');
    }
  }

  // メモリーマネージャーのインスタンス作成
  const memoryManager = new MemoryManager();

  // 対応ファイル形式の定義
  const FILE_EXTENSIONS = {
    document: [
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'txt',
      'rtf',
      'odt',
      'ods',
      'odp',
    ],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'bmp', 'webp', 'ico', 'tiff'],
    video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v'],
    audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'],
    data: ['json', 'xml', 'csv', 'sql', 'yaml', 'yml', 'log'],
    code: ['js', 'css', 'html', 'php', 'py', 'java', 'cpp', 'c', 'h'],
    other: ['exe', 'msi', 'dmg', 'deb', 'rpm', 'apk'],
  };

  const ALL_EXTENSIONS = Object.values(FILE_EXTENSIONS).flat();

  // ファイルカテゴリアイコン
  const CATEGORY_ICONS = {
    document: '📄',
    archive: '📦',
    image: '🖼️',
    video: '🎥',
    audio: '🎵',
    data: '📊',
    code: '💻',
    other: '📁',
  };

  // ファイルリンクを検索する関数
  function findFileLinks() {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const currentDomain = window.location.hostname;

    const fileLinks = links.filter(link => {
      try {
        const url = new URL(link.href);
        // 同一ドメインまたはサブドメインのみ許可（セキュリティ強化）
        const isValidDomain =
          url.hostname === currentDomain ||
          url.hostname.endsWith('.' + currentDomain) ||
          currentDomain.endsWith('.' + url.hostname);

        if (!isValidDomain) return false;

        const pathname = url.pathname.toLowerCase();
        const filename = pathname.split('/').pop();

        // ファイル拡張子チェック
        const hasValidExtension = ALL_EXTENSIONS.some(
          ext =>
            pathname.endsWith('.' + ext) ||
            url.search.includes('.' + ext) ||
            filename.includes('.' + ext)
        );

        return hasValidExtension;
      } catch (e) {
        return false;
      }
    });

    return fileLinks.map(link => {
      const url = new URL(link.href);
      const pathname = url.pathname.toLowerCase();
      const filename = pathname.split('/').pop();

      // ファイル拡張子を特定
      let extension = '';
      let category = 'other';

      for (const [cat, exts] of Object.entries(FILE_EXTENSIONS)) {
        for (const ext of exts) {
          if (pathname.endsWith('.' + ext) || filename.includes('.' + ext)) {
            extension = ext;
            category = cat;
            break;
          }
        }
        if (extension) break;
      }

      const displayName =
        link.textContent.trim() ||
        link.title ||
        link.getAttribute('download') ||
        filename ||
        url.pathname.split('/').pop();

      return {
        url: link.href,
        displayName,
        filename: filename || displayName,
        extension,
        category,
        icon: CATEGORY_ICONS[category] || '📁',
        element: link,
        size: link.getAttribute('data-size') || 'Unknown',
      };
    });
  }

  // ファイル選択UI作成
  function createFileSelectionUI(fileLinks) {
    const overlay = document.createElement('div');
    overlay.id = 'file-selector-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      max-width: 95vw;
      max-height: 95vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // ヘッダー
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
    `;

    const title = document.createElement('h2');
    title.textContent = '📥 ファイルダウンロード選択';
    title.style.margin = '0 0 10px 0';

    const subtitle = document.createElement('p');
    subtitle.textContent = `${fileLinks.length}個のダウンロード可能ファイルが見つかりました`;
    subtitle.style.margin = '0';
    subtitle.style.opacity = '0.9';

    header.appendChild(title);
    header.appendChild(subtitle);

    // フィルターセクション
    const filterSection = document.createElement('div');
    filterSection.style.cssText = `
      padding: 15px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    `;

    // 検索ボックス
    const searchContainer = document.createElement('div');
    searchContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 200px;
    `;

    const searchLabel = document.createElement('label');
    searchLabel.textContent = '🔍 検索:';
    searchLabel.style.fontWeight = 'bold';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'ファイル名で検索...';
    searchInput.style.cssText = `
      flex: 1;
      padding: 6px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    `;

    searchContainer.appendChild(searchLabel);
    searchContainer.appendChild(searchInput);

    // カテゴリフィルター
    const categoryContainer = document.createElement('div');
    categoryContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    `;

    const categoryLabel = document.createElement('label');
    categoryLabel.textContent = '📂 カテゴリ:';
    categoryLabel.style.fontWeight = 'bold';

    const categorySelect = document.createElement('select');
    categorySelect.style.cssText = `
      padding: 6px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    `;

    // カテゴリオプション作成
    const categoryCounts = {};
    fileLinks.forEach(file => {
      categoryCounts[file.category] = (categoryCounts[file.category] || 0) + 1;
    });

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = `全て (${fileLinks.length})`;
    categorySelect.appendChild(allOption);

    Object.entries(categoryCounts).forEach(([category, count]) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = `${CATEGORY_ICONS[category]} ${category} (${count})`;
      categorySelect.appendChild(option);
    });

    categoryContainer.appendChild(categoryLabel);
    categoryContainer.appendChild(categorySelect);

    filterSection.appendChild(searchContainer);
    filterSection.appendChild(categoryContainer);

    // 選択コントロール
    const controlSection = document.createElement('div');
    controlSection.style.cssText = `
      padding: 10px 20px;
      background: #ffffff;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const selectControls = document.createElement('div');
    selectControls.style.cssText = `
      display: flex;
      gap: 10px;
    `;

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = '✅ 全選択';
    selectAllBtn.style.cssText = `
      padding: 6px 12px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = '❌ 全解除';
    deselectAllBtn.style.cssText = `
      padding: 6px 12px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    `;

    const selectedCount = document.createElement('span');
    selectedCount.style.cssText = `
      font-size: 14px;
      color: #666;
      font-weight: bold;
    `;

    selectControls.appendChild(selectAllBtn);
    selectControls.appendChild(deselectAllBtn);
    controlSection.appendChild(selectControls);
    controlSection.appendChild(selectedCount);

    // テーブルコンテナ
    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      max-height: 500px;
    `;

    // テーブル作成
    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    `;

    // テーブルヘッダー
    const thead = document.createElement('thead');
    thead.style.cssText = `
      background: #f8f9fa;
      position: sticky;
      top: 0;
      z-index: 1;
    `;

    const headerRow = document.createElement('tr');
    const headers = [
      { text: '選択', width: '60px' },
      { text: 'アイコン', width: '50px' },
      { text: 'ファイル名', width: 'auto' },
      { text: 'カテゴリ', width: '120px' },
      { text: '拡張子', width: '80px' },
      { text: 'サイズ', width: '100px' },
    ];

    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header.text;
      th.style.cssText = `
        padding: 12px 8px;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
        font-weight: 600;
        background: #f8f9fa;
        width: ${header.width};
      `;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // テーブルボディ
    const tbody = document.createElement('tbody');

    // ファイル行作成
    fileLinks.forEach((file, index) => {
      const row = document.createElement('tr');
      row.className = `file-row category-${file.category}`;
      row.style.cssText = `
        border-bottom: 1px solid #e9ecef;
        transition: background-color 0.2s;
      `;

      // ホバー効果
      row.onmouseover = () => {
        row.style.backgroundColor = '#f8f9fa';
      };
      row.onmouseout = () => {
        row.style.backgroundColor = 'white';
      };

      // チェックボックス列
      const checkCell = document.createElement('td');
      checkCell.style.cssText = `
        padding: 12px 8px;
        text-align: center;
      `;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;
      checkbox.style.cssText = `
        transform: scale(1.3);
        cursor: pointer;
      `;

      // チェックボックスのクリックイベント（イベント伝播を停止）
      memoryManager.addEventListener(checkbox, 'click', e => {
        e.stopPropagation();
        updateSelectedCount();
      });

      checkCell.appendChild(checkbox);

      // アイコン列
      const iconCell = document.createElement('td');
      iconCell.style.cssText = `
        padding: 12px 8px;
        text-align: center;
        font-size: 18px;
      `;
      iconCell.textContent = file.icon;

      // ファイル名列
      const nameCell = document.createElement('td');
      nameCell.style.cssText = `
        padding: 12px 8px;
        font-weight: 500;
        color: #333;
        max-width: 300px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
      `;
      nameCell.textContent = file.displayName;
      nameCell.title = file.displayName; // ツールチップ

      // カテゴリ列
      const categoryCell = document.createElement('td');
      categoryCell.style.cssText = `
        padding: 12px 8px;
        color: #666;
      `;
      categoryCell.textContent = file.category;

      // 拡張子列
      const extCell = document.createElement('td');
      extCell.style.cssText = `
        padding: 12px 8px;
        color: #666;
        font-family: monospace;
      `;
      extCell.textContent = `.${file.extension}`;

      // サイズ列
      const sizeCell = document.createElement('td');
      sizeCell.style.cssText = `
        padding: 12px 8px;
        color: #666;
        font-size: 12px;
      `;
      sizeCell.textContent = file.size;

      // 行クリックでチェックボックス切り替え
      memoryManager.addEventListener(row, 'click', e => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          updateSelectedCount();
        }
      });

      row.appendChild(checkCell);
      row.appendChild(iconCell);
      row.appendChild(nameCell);
      row.appendChild(categoryCell);
      row.appendChild(extCell);
      row.appendChild(sizeCell);

      tbody.appendChild(row);
      file._checkbox = checkbox;
      file._row = row;
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // フッター（アクションボタン）
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 20px;
      background: #f8f9fa;
      border-top: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = '⬇️ ダウンロード開始';
    downloadBtn.style.cssText = `
      padding: 12px 24px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    `;

    // URLコピーボタンを追加
    const copyUrlBtn = document.createElement('button');
    copyUrlBtn.textContent = '📋 URL一覧をコピー';
    copyUrlBtn.style.cssText = `
      padding: 12px 24px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    `;

    // Markdownコピーボタンを追加
    const copyMarkdownBtn = document.createElement('button');
    copyMarkdownBtn.textContent = '📝 Markdown形式でコピー';
    copyMarkdownBtn.style.cssText = `
      padding: 12px 24px;
      background: #6f42c1;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '❌ キャンセル';
    cancelBtn.style.cssText = `
      padding: 12px 24px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    `;
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
    };

    const actionButtons = document.createElement('div');
    actionButtons.style.cssText = `
      display: flex;
      gap: 10px;
    `;

    actionButtons.appendChild(downloadBtn);
    actionButtons.appendChild(copyUrlBtn);
    actionButtons.appendChild(copyMarkdownBtn);
    actionButtons.appendChild(cancelBtn);

    footer.appendChild(actionButtons);

    // フィルター機能
    function filterFiles() {
      const searchTerm = searchInput.value.toLowerCase();
      const selectedCategory = categorySelect.value;
      let visibleCount = 0;

      fileLinks.forEach(file => {
        const matchesSearch =
          file.displayName.toLowerCase().includes(searchTerm) ||
          file.extension.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === 'all' || file.category === selectedCategory;
        const shouldShow = matchesSearch && matchesCategory;

        file._row.style.display = shouldShow ? '' : 'none';
        if (shouldShow) visibleCount++;
      });

      // サブタイトル更新
      subtitle.textContent = `${visibleCount}個のファイルを表示中（全${fileLinks.length}個）`;
    }

    // 選択数更新
    function updateSelectedCount() {
      const visibleRows = tbody.querySelectorAll('tr:not([style*="display: none"])');
      const checkedBoxes = Array.from(visibleRows).filter(
        row => row.querySelector('input[type="checkbox"]').checked
      );
      selectedCount.textContent = `選択中: ${checkedBoxes.length}個`;
      downloadBtn.textContent = `⬇️ ダウンロード開始 (${checkedBoxes.length}個)`;
      downloadBtn.disabled = checkedBoxes.length === 0;
      downloadBtn.style.opacity = checkedBoxes.length === 0 ? '0.5' : '1';
    }

    // イベントリスナー
    memoryManager.addEventListener(searchInput, 'input', filterFiles);
    memoryManager.addEventListener(categorySelect, 'change', filterFiles);

    // 全選択/全解除
    memoryManager.addEventListener(selectAllBtn, 'click', () => {
      const visibleRows = tbody.querySelectorAll('tr:not([style*="display: none"])');
      visibleRows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox.checked = true;
      });
      updateSelectedCount();
    });

    memoryManager.addEventListener(deselectAllBtn, 'click', () => {
      const visibleRows = tbody.querySelectorAll('tr:not([style*="display: none"])');
      visibleRows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox.checked = false;
      });
      updateSelectedCount();
    });

    // 組み立て
    dialog.appendChild(header);
    dialog.appendChild(filterSection);
    dialog.appendChild(controlSection);
    dialog.appendChild(tableContainer);
    dialog.appendChild(footer);
    overlay.appendChild(dialog);

    // 初期状態設定
    updateSelectedCount();

    return {
      element: overlay,
      getSelectedFiles: () => {
        return fileLinks.filter(file => file._checkbox.checked);
      },
      onDownload: callback => {
        downloadBtn.onclick = () => {
          const selectedFiles = fileLinks.filter(file => file._checkbox.checked);
          if (selectedFiles.length > 0) {
            callback(selectedFiles);
          }
        };
      },
      onCopyUrls: callback => {
        copyUrlBtn.onclick = () => {
          const selectedFiles = fileLinks.filter(file => file._checkbox.checked);
          if (selectedFiles.length === 0) {
            alert('コピーするファイルが選択されていません。');
            return;
          }
          const urls = selectedFiles.map(file => file.url).join('\n');
          navigator.clipboard
            .writeText(urls)
            .then(() => {
              copyUrlBtn.textContent = '✅ コピー完了！';
              setTimeout(() => {
                copyUrlBtn.textContent = '📋 URL一覧をコピー';
              }, 2000);
            })
            .catch(err => {
              console.error('クリップボードへのコピーに失敗:', err);
              alert('コピーに失敗しました。コンソールを確認してください。');
            });
          if (callback) callback(selectedFiles);
        };
      },
      onCopyMarkdown: callback => {
        copyMarkdownBtn.onclick = () => {
          const selectedFiles = fileLinks.filter(file => file._checkbox.checked);
          if (selectedFiles.length === 0) {
            alert('コピーするファイルが選択されていません。');
            return;
          }
          const markdown = selectedFiles
            .map(file => `- [${file.displayName}](${file.url})`)
            .join('\n');
          navigator.clipboard
            .writeText(markdown)
            .then(() => {
              copyMarkdownBtn.textContent = '✅ コピー完了！';
              setTimeout(() => {
                copyMarkdownBtn.textContent = '📝 Markdown形式でコピー';
              }, 2000);
            })
            .catch(err => {
              console.error('クリップボードへのコピーに失敗:', err);
              alert('コピーに失敗しました。コンソールを確認してください。');
            });
          if (callback) callback(selectedFiles);
        };
      },
      close: () => {
        // メモリーマネージャーでクリーンアップ
        memoryManager.cleanup();

        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }

        console.log('📥 File Downloader: パネル閉鎖・クリーンアップ完了');
      },
    };
  }

  // ダウンロード実行関数
  function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || url.split('/').pop();
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // プログレス表示用のUI作成
  function createProgressUI(total) {
    const overlay = document.createElement('div');
    overlay.id = 'file-download-overlay';
    overlay.style.cssText = `
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
      font-family: Arial, sans-serif;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      text-align: center;
      min-width: 300px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'ファイル一括ダウンロード中...';
    title.style.margin = '0 0 15px 0';

    const progress = document.createElement('div');
    progress.style.cssText = `
      width: 100%;
      height: 20px;
      background: #f0f0f0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 10px;
    `;

    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
      height: 100%;
      background: #4CAF50;
      width: 0%;
      transition: width 0.3s ease;
    `;
    progress.appendChild(progressBar);

    const status = document.createElement('div');
    status.textContent = `0 / ${total} 完了`;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.style.cssText = `
      margin-top: 15px;
      padding: 8px 16px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;

    dialog.appendChild(title);
    dialog.appendChild(progress);
    dialog.appendChild(status);
    dialog.appendChild(cancelBtn);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    let cancelled = false;
    cancelBtn.onclick = () => {
      cancelled = true;
      document.body.removeChild(overlay);
    };

    return {
      updateProgress: current => {
        if (!cancelled) {
          const percentage = (current / total) * 100;
          progressBar.style.width = percentage + '%';
          status.textContent = `${current} / ${total} 完了`;

          if (current >= total) {
            title.textContent = 'ダウンロード完了！';
            cancelBtn.textContent = '閉じる';
            cancelBtn.style.background = '#4CAF50';
          }
        }
      },
      isCancelled: () => cancelled,
      close: () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      },
    };
  }

  // メイン処理
  async function main() {
    try {
      // ファイルリンクを検索
      const fileLinks = findFileLinks();

      if (fileLinks.length === 0) {
        alert('このページにはダウンロード可能なファイルが見つかりませんでした。');
        return;
      }

      // ファイル選択UI表示
      const selectorUI = createFileSelectionUI(fileLinks);
      document.body.appendChild(selectorUI.element);

      // ダウンロード開始イベント
      selectorUI.onDownload(async selectedFiles => {
        selectorUI.close();

        if (selectedFiles.length === 0) {
          alert('ダウンロードするファイルが選択されていません。');
          return;
        }

        // プログレスUI表示
        const progressUI = createProgressUI(selectedFiles.length);

        // ダウンロード実行
        let completed = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
          if (progressUI.isCancelled()) {
            break;
          }

          const file = selectedFiles[i];
          try {
            // ファイル名の生成（安全な文字のみ）
            let filename = file.displayName;
            if (!filename.toLowerCase().endsWith('.' + file.extension)) {
              filename += '.' + file.extension;
            }
            // ファイル名に使用できない文字を除去
            filename = filename.replace(/[<>:"/\\|?*]/g, '_');

            downloadFile(file.url, filename);
            completed++;
            progressUI.updateProgress(completed);

            // ブラウザの制限を考慮して少し待機
            if (i < selectedFiles.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (error) {
            console.error(`ファイルダウンロードエラー: ${file.url}`, error);
          }
        }

        // 完了後、3秒後に自動で閉じる
        if (!progressUI.isCancelled()) {
          setTimeout(() => {
            progressUI.close();
          }, 3000);
        }
      });

      // URLコピーイベント
      selectorUI.onCopyUrls();

      // Markdownコピーイベント
      selectorUI.onCopyMarkdown();
    } catch (error) {
      console.error('ファイル一括ダウンローダーでエラーが発生しました:', error);
      alert('エラーが発生しました。コンソールを確認してください。');
    }
  }

  // 実行
  main();
})();
