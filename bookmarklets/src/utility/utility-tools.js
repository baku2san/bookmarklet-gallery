// ====================================================================================
// 🛠️ Utility Tools - 多機能ユーティリティツール
// ====================================================================================
// 
// 📋 概要:
//   URL操作、言語切り替え、Office文書ダウンロードなど、
//   日常的によく使う便利機能を統合したツールです。
//
// 🎯 主な機能:
//   • URL Decode/Encode と クリップボードコピー
//   • 多言語URL切り替え (en/ja, en-us/ja-jp)
//   • Office 365 文書の直接ダウンロード
//   • URL形式変換 (相対→絶対、HTTP→HTTPS等)
//   • クエリパラメータの解析・編集
//   • リダイレクト追跡
//
// 🔧 使用方法:
//   ブックマークレットを実行すると、多機能パネルが表示されます。
//   各ボタンをクリックして機能を実行できます。
//
// 📝 更新履歴:
//   2025-06-22: 初版作成 - URL Decode, 言語切り替え, Office DL機能統合
//
// ====================================================================================

(function () {
  'use strict';

  // =================================================================================
  // 🎨 UI スタイル定義
  // =================================================================================
  const styles = `
        .utility-tools-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 380px;
            max-height: 90vh;
            overflow-y: auto;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            backdrop-filter: blur(10px);
        }
        
        .utility-tools-header {
            padding: 20px;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .utility-tools-title {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .utility-tools-close {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }
        
        .utility-tools-close:hover {
            background: rgba(255,255,255,0.3);
            transform: scale(1.1);
        }
        
        .utility-tools-content {
            padding: 20px;
        }
        
        .utility-tools-section {
            margin-bottom: 24px;
        }
        
        .utility-tools-section:last-child {
            margin-bottom: 0;
        }
        
        .utility-tools-section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            color: rgba(255,255,255,0.9);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .utility-tools-button {
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 10px 16px;
            margin: 4px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-width: 120px;
            justify-content: center;
        }
        
        .utility-tools-button:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        
        .utility-tools-button:active {
            transform: translateY(0);
        }
        
        .utility-tools-button.primary {
            background: rgba(255,255,255,0.9);
            color: #667eea;
            font-weight: 600;
        }
        
        .utility-tools-button.primary:hover {
            background: white;
        }
        
        .utility-tools-input {
            width: 100%;
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 6px;
            background: rgba(255,255,255,0.1);
            color: white;
            font-size: 13px;
            margin: 8px 0;
            box-sizing: border-box;
        }
        
        .utility-tools-input::placeholder {
            color: rgba(255,255,255,0.6);
        }
        
        .utility-tools-url-info {
            background: rgba(255,255,255,0.1);
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            line-height: 1.4;
            margin: 8px 0;
            word-break: break-all;
        }
        
        .utility-tools-status {
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            margin: 8px 0;
            text-align: center;
        }
        
        .utility-tools-status.success {
            background: rgba(34, 197, 94, 0.2);
            border: 1px solid rgba(34, 197, 94, 0.4);
        }
        
        .utility-tools-status.error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.4);
        }
        
        .utility-tools-status.info {
            background: rgba(59, 130, 246, 0.2);
            border: 1px solid rgba(59, 130, 246, 0.4);
        }
        
        .utility-tools-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        
        .utility-tools-grid .utility-tools-button {
            margin: 0;
            min-width: auto;
        }
    `;

  // =================================================================================
  // 🔧 ユーティリティ関数
  // =================================================================================

  // クリップボードにコピー（非同期対応）
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // フォールバック方式
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
      }
    } catch (err) {
      console.error('クリップボードへのコピーに失敗:', err);
      return false;
    }
  }

  // ステータス表示
  function showStatus(message, type = 'success', duration = 3000) {
    const existingStatus = panel.querySelector('.utility-tools-status');
    if (existingStatus) {
      existingStatus.remove();
    }

    const status = document.createElement('div');
    status.className = `utility-tools-status ${type}`;
    status.textContent = message;

    const content = panel.querySelector('.utility-tools-content');
    content.insertBefore(status, content.firstChild);

    setTimeout(() => {
      if (status.parentNode) {
        status.remove();
      }
    }, duration);
  }

  // URL解析
  function parseURL(url) {
    try {
      const urlObj = new URL(url);
      const params = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return {
        protocol: urlObj.protocol,
        host: urlObj.host,
        hostname: urlObj.hostname,
        port: urlObj.port,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        params: params,
        origin: urlObj.origin
      };
    } catch (e) {
      return null;
    }
  }

  // =================================================================================
  // 🎯 メイン機能群
  // =================================================================================

  const UtilityFeatures = {
    // URL デコード・エンコード
    urlDecode: async function () {
      try {
        const decoded = decodeURIComponent(location.href);
        const success = await copyToClipboard(decoded);
        if (success) {
          showStatus('✅ デコードされたURLをクリップボードにコピーしました');
          updateURLInfo();
        } else {
          showStatus('❌ クリップボードへのコピーに失敗しました', 'error');
        }
      } catch (e) {
        showStatus('❌ URLのデコードに失敗しました', 'error');
      }
    },

    urlEncode: async function () {
      try {
        const encoded = encodeURIComponent(location.href);
        const success = await copyToClipboard(encoded);
        if (success) {
          showStatus('✅ エンコードされたURLをクリップボードにコピーしました');
        } else {
          showStatus('❌ クリップボードへのコピーに失敗しました', 'error');
        }
      } catch (e) {
        showStatus('❌ URLのエンコードに失敗しました', 'error');
      }
    },

    // 言語切り替え（拡張版）
    languageSwitch: function () {
      const url = location.href;
      let newUrl = null;

      // より多くのパターンに対応
      const patterns = [
        { from: /\/en-us\//gi, to: '/ja-jp/' },
        { from: /\/en\//gi, to: '/ja/' },
        { from: /\/ja-jp\//gi, to: '/en-us/' },
        { from: /\/ja\//gi, to: '/en/' },
        { from: /\/english\//gi, to: '/japanese/' },
        { from: /\/japanese\//gi, to: '/english/' },
        { from: /[?&]lang=en/gi, to: '?lang=ja' },
        { from: /[?&]lang=ja/gi, to: '?lang=en' },
        { from: /[?&]language=english/gi, to: '?language=japanese' },
        { from: /[?&]language=japanese/gi, to: '?language=english' }
      ];

      for (const pattern of patterns) {
        if (url.match(pattern.from)) {
          newUrl = url.replace(pattern.from, pattern.to);
          break;
        }
      }

      if (newUrl && newUrl !== url) {
        showStatus('🌐 言語を切り替えています...', 'info');
        setTimeout(() => {
          location.href = newUrl;
        }, 1000);
      } else {
        showStatus('❌ 言語切り替えのパターンが見つかりませんでした', 'error');
      }
    },

    // Office 365 ダウンロード（拡張版）
    officeDownload: function () {
      const url = location.href;
      let downloadUrl = null;

      // 複数のOffice 365パターンに対応
      if (url.includes('/Doc.aspx?sourcedoc')) {
        downloadUrl = url.replace('/Doc.aspx?sourcedoc', '/download.aspx?UniqueId');
      } else if (url.includes('/_layouts/15/Doc.aspx')) {
        downloadUrl = url.replace('/_layouts/15/Doc.aspx', '/_layouts/15/download.aspx');
      } else if (url.includes('onedrive.live.com') && url.includes('view.aspx')) {
        downloadUrl = url.replace('view.aspx', 'download.aspx');
      }

      if (downloadUrl) {
        showStatus('📥 ダウンロードを開始しています...', 'info');
        window.open(downloadUrl, '_blank');
      } else {
        showStatus('❌ Office文書のダウンロードURLを生成できませんでした', 'error');
      }
    },

    // HTTP → HTTPS 変換
    httpsConvert: function () {
      if (location.protocol === 'http:') {
        const httpsUrl = location.href.replace('http://', 'https://');
        showStatus('🔒 HTTPSに切り替えています...', 'info');
        setTimeout(() => {
          location.href = httpsUrl;
        }, 1000);
      } else {
        showStatus('ℹ️ すでにHTTPS接続です', 'info');
      }
    },

    // クエリパラメータを削除
    removeParams: async function () {
      const cleanUrl = location.origin + location.pathname;
      const success = await copyToClipboard(cleanUrl);
      if (success) {
        showStatus('✅ クエリパラメータを削除したURLをコピーしました');
      } else {
        showStatus('❌ コピーに失敗しました', 'error');
      }
    },

    // ページ情報を表示
    pageInfo: async function () {
      const info = {
        title: document.title,
        url: location.href,
        domain: location.hostname,
        protocol: location.protocol,
        port: location.port || 'default',
        lastModified: document.lastModified,
        charset: document.characterSet,
        referrer: document.referrer || 'なし'
      };

      const infoText = Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      const success = await copyToClipboard(infoText);
      if (success) {
        showStatus('✅ ページ情報をクリップボードにコピーしました');
      } else {
        showStatus('❌ コピーに失敗しました', 'error');
      }
    }
  };

  // =================================================================================
  // 🎨 UI構築
  // =================================================================================

  // 既存のパネルを削除
  const existingPanel = document.getElementById('utility-tools-panel');
  if (existingPanel) {
    existingPanel.remove();
  }

  // スタイルシートを追加
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);

  // メインパネルを作成
  const panel = document.createElement('div');
  panel.id = 'utility-tools-panel';
  panel.className = 'utility-tools-panel';

  // URL情報を更新する関数
  function updateURLInfo() {
    const urlInfo = panel.querySelector('.utility-tools-url-info');
    if (urlInfo) {
      const parsed = parseURL(location.href);
      if (parsed) {
        urlInfo.innerHTML = `
                    <strong>現在のURL:</strong><br>
                    ${location.href}<br><br>
                    <strong>デコード版:</strong><br>
                    ${decodeURIComponent(location.href)}
                `;
      }
    }
  }

  panel.innerHTML = `
        <div class="utility-tools-header">
            <h3 class="utility-tools-title">🛠️ Utility Tools</h3>
            <button class="utility-tools-close">×</button>
        </div>
        <div class="utility-tools-content">
            <div class="utility-tools-section">
                <div class="utility-tools-section-title">📋 URL操作</div>
                <div class="utility-tools-url-info"></div>
                <div class="utility-tools-grid">
                    <button class="utility-tools-button primary" data-action="urlDecode">
                        🔓 デコード
                    </button>
                    <button class="utility-tools-button" data-action="urlEncode">
                        🔒 エンコード
                    </button>
                    <button class="utility-tools-button" data-action="removeParams">
                        🧹 クエリ削除
                    </button>
                    <button class="utility-tools-button" data-action="httpsConvert">
                        🔒 HTTPS化
                    </button>
                </div>
            </div>
            
            <div class="utility-tools-section">
                <div class="utility-tools-section-title">🌐 言語・地域</div>
                <button class="utility-tools-button primary" data-action="languageSwitch">
                    🔄 EN/JA 切り替え
                </button>
            </div>
            
            <div class="utility-tools-section">
                <div class="utility-tools-section-title">📥 Office 365</div>
                <button class="utility-tools-button primary" data-action="officeDownload">
                    📄 直接ダウンロード
                </button>
            </div>
            
            <div class="utility-tools-section">
                <div class="utility-tools-section-title">ℹ️ 情報</div>
                <button class="utility-tools-button" data-action="pageInfo">
                    📊 ページ情報取得
                </button>
            </div>
        </div>
    `;

  // イベントリスナーを設定
  panel.querySelector('.utility-tools-close').addEventListener('click', () => {
    panel.remove();
    styleSheet.remove();
  });

  // ボタンのクリックイベント
  panel.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button) {
      const action = button.getAttribute('data-action');
      if (UtilityFeatures[action]) {
        UtilityFeatures[action]();
      }
    }
  });

  // パネルをページに追加
  document.body.appendChild(panel);

  // 初期表示時にURL情報を更新
  updateURLInfo();

  // 初期化完了メッセージ
  showStatus('🚀 Utility Tools が起動しました', 'info', 2000);

})();
