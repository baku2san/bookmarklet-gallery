/**
 * SharePoint Navigator Bookmarklet - リファクタリング版 v5
 * SharePoint サイト内での素早いナビゲーションを提供
 *
 * 改善点:
 * - モジュール分割による可読性向上
 * - 関数の単一責任原則の適用
 * - 定数の外部化
 * - イベントハンドリングの最適化
 * - ESLintルールに準拠した日本語コメント
 * - エラーハンドリングの追加
 */

javascript: (function () {
  'use strict';
  // =============================================================================
  // コンソール警告抑制（オプション）
  // =============================================================================
  const SUPPRESS_MUTATION_WARNINGS = true; // 必要に応じてfalseに変更

  if (SUPPRESS_MUTATION_WARNINGS) {
    window.originalConsoleWarn = console.warn;
    console.warn = function (...args) {
      // DOMNodeRemoved関連の警告を抑制
      if (args[0] && typeof args[0] === 'string' &&
        (args[0].includes('DOMNodeRemoved') ||
          args[0].includes('mutation event') ||
          args[0].includes('Mutation Events'))) {
        return;
      }
      window.originalConsoleWarn.apply(console, args);
    };
  }

  // =============================================================================
  // デザインシステム定数
  // =============================================================================
  const SHAREPOINT_DESIGN_SYSTEM = {
    // カラーパレット（Microsoft Fluent Design準拠）
    COLORS: {
      PRIMARY: '#0078d4',           // SharePoint Blue
      PRIMARY_HOVER: '#106ebe',     // Darker blue for hover
      SECONDARY: '#605e5c',         // Text secondary
      SUCCESS: '#107c10',           // Green
      WARNING: '#ff8c00',          // Orange
      DANGER: '#d13438',           // Red

      // 背景色
      BACKGROUND: {
        PRIMARY: '#ffffff',         // White
        SECONDARY: '#f8f9fa',       // Light gray
        TERTIARY: '#f3f2f1',        // Lighter gray
        PANEL: '#faf9f8'           // Panel background
      },

      // テキスト色
      TEXT: {
        PRIMARY: '#323130',         // Dark text
        SECONDARY: '#605e5c',       // Secondary text
        MUTED: '#8a8886',          // Muted text
        INVERSE: '#ffffff'          // White text
      },

      // ボーダー色
      BORDER: {
        DEFAULT: '#edebe9',         // Default border
        FOCUS: '#0078d4',          // Focus border
        SEPARATOR: '#e1dfdd'        // Separator
      }
    },

    // タイポグラフィ
    TYPOGRAPHY: {
      FONT_FAMILY: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Web Regular', 'Segoe UI Symbol', 'Helvetica Neue', Arial, sans-serif`,

      SIZES: {
        H1: '20px',
        H2: '18px',
        H3: '16px',
        H4: '14px',
        BODY: '14px',
        CAPTION: '12px',
        SMALL: '11px'
      },

      WEIGHTS: {
        NORMAL: '400',
        MEDIUM: '500',
        SEMIBOLD: '600',
        BOLD: '700'
      },

      LINE_HEIGHTS: {
        TIGHT: '1.2',
        NORMAL: '1.4',
        RELAXED: '1.6'
      }
    },

    // スペーシング
    SPACING: {
      XS: '4px',
      SM: '8px',
      MD: '12px',
      LG: '16px',
      XL: '20px',
      XXL: '24px',
      XXXL: '32px'
    },

    // ボーダー半径
    BORDER_RADIUS: {
      SM: '2px',
      MD: '4px',
      LG: '6px',
      XL: '8px',
      ROUND: '50%'
    },

    // シャドウ
    SHADOWS: {
      CARD: '0 1px 3px rgba(0, 0, 0, 0.1)',
      PANEL: '0 4px 8px rgba(0, 0, 0, 0.1)',
      MODAL: '0 8px 16px rgba(0, 0, 0, 0.15)',
      FOCUS: '0 0 0 2px rgba(0, 120, 212, 0.3)'
    },

    // アニメーション
    TRANSITIONS: {
      FAST: '0.15s ease',
      NORMAL: '0.2s ease',
      SLOW: '0.3s ease'
    },

    // レイアウト
    LAYOUT: {
      PANEL_MAX_WIDTH: '800px',
      PANEL_MIN_WIDTH: '320px',
      SIDEBAR_WIDTH: '250px',
      HEADER_HEIGHT: '48px'
    }
  };

  // =============================================================================
  // 定数定義
  // =============================================================================
  const CONSTANTS = {
    PANEL_ID: 'shima-sharepoint-navigator',
    MIN_WIDTH: 380,
    MIN_HEIGHT: 300,
    INITIAL_WIDTH: 640,
    INITIAL_HEIGHT: 700,
    MARGIN: 20,
    Z_INDEX: 2147483647,

    PRIORITIES: {
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      ALL: 'all'
    },

    PRIORITY_COLORS: {
      all: SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY,
      high: SHAREPOINT_DESIGN_SYSTEM.COLORS.DANGER,
      medium: SHAREPOINT_DESIGN_SYSTEM.COLORS.WARNING,
      low: SHAREPOINT_DESIGN_SYSTEM.COLORS.SUCCESS
    },

    ICONS: {
      NAVIGATOR: '🧭',
      STAR: '⭐',
      USERS: '👥',
      GALLERY: '🏛️',
      ADMIN: '🏗️',
      DESIGN: '🎨',
      ACTION: '⚡',
      COLLECTION: '🏛️',
      TOOLS: '🔧',
      MAINTENANCE: '🔧'
    }
  };

  // =============================================================================
  // ユーティリティ関数
  // =============================================================================
  const Utils = {
    // ========== 共通ユーティリティ関数 ==========

    // HTML エスケープ
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    // ネストした値を取得
    getNestedValue(obj, path) {
      return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : '';
      }, obj);
    },

    // 値をフォーマット
    formatValue(value, field) {
      if (value === null || value === undefined) {
        return '<em style="color: #999 !important;">null</em>';
      }
      if (typeof value === 'boolean') {
        return value ? '✓' : '✗';
      }
      if (typeof value === 'object') {
        return '<em style="color: #666 !important;">[Object]</em>';
      }
      if (field && field.toLowerCase().includes('date') && value) {
        try {
          return new Date(value).toLocaleString('ja-JP');
        } catch (e) {
          return this.escapeHtml(String(value));
        }
      }
      return this.escapeHtml(String(value));
    },

    // ローカルストレージへの保存
    saveToStorage(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e) {
        console.warn('ローカルストレージへの保存に失敗:', e);
        return false;
      }
    },

    // ローカルストレージからの読み込み
    loadFromStorage(key, defaultValue = null) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
      } catch (e) {
        console.warn('ローカルストレージからの読み込みに失敗:', e);
        return defaultValue;
      }
    },

    // クリップボード用の安全なエスケープ
    escapeForClipboard(value) {
      if (value === null || value === undefined) {
        return '';
      }

      const str = String(value);
      // JavaScriptの文字列リテラル用のエスケープ
      return str.replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    },

    // 一時メッセージ表示
    showTemporaryMessage(message, type = 'success', duration = 3000) {
      // 既存のメッセージがあれば削除
      const existingMessage = document.getElementById('shima-temp-message');
      if (existingMessage) {
        existingMessage.remove();
      }

      // メッセージ要素を作成
      const messageDiv = document.createElement('div');
      messageDiv.id = 'shima-temp-message';

      const bgColor = type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#fff3cd';
      const borderColor = type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#ffeaa7';
      const textColor = type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#856404';

      messageDiv.style.cssText = `
        position: fixed !important;
        top: 80px !important;
        right: 20px !important;
        background: ${bgColor} !important;
        border: 1px solid ${borderColor} !important;
        border-radius: 6px !important;
        padding: 12px 16px !important;
        color: ${textColor} !important;
        font-family: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
        font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.MEDIUM} !important;
        box-shadow: ${SHAREPOINT_DESIGN_SYSTEM.SHADOWS.CARD} !important;
        z-index: 2147483647 !important;
        max-width: 400px !important;
        word-wrap: break-word !important;
        animation: shimaCopyMessageSlideIn 0.3s ease-out !important;
        cursor: pointer !important;
      `;

      messageDiv.innerHTML = message;

      // クリックで削除
      messageDiv.addEventListener('click', () => {
        messageDiv.remove();
      });

      // アニメーションCSSを追加（一度だけ）
      if (!document.getElementById('shima-copy-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'shima-copy-animation-styles';
        style.textContent = `
          @keyframes shimaCopyMessageSlideIn {
            from {
              transform: translateX(100%) !important;
              opacity: 0 !important;
            }
            to {
              transform: translateX(0) !important;
              opacity: 1 !important;
            }
          }
          @keyframes shimaCopyMessageSlideOut {
            from {
              transform: translateX(0) !important;
              opacity: 1 !important;
            }
            to {
              transform: translateX(100%) !important;
              opacity: 0 !important;
            }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(messageDiv);

      // 指定時間後に削除
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.style.animation = 'shimaCopyMessageSlideOut 0.3s ease-in';
          setTimeout(() => {
            if (messageDiv.parentNode) {
              messageDiv.remove();
            }
          }, 300);
        }
      }, duration);
    },

    // ========== Navigator固有ユーティリティ関数 ==========

    /**
     * 既存のパネルをクリーンアップ
     * @returns {boolean} クリーンアップが実行されたかどうか
     */
    cleanupExistingPanel: function () {
      const existingPanel = document.getElementById(CONSTANTS.PANEL_ID);
      if (existingPanel) {
        // パネル内の全イベントリスナーを削除
        const allElements = existingPanel.querySelectorAll('*');
        allElements.forEach(element => {
          // cloneNodeでイベントリスナーを完全に削除
          const newElement = element.cloneNode(true);
          if (element.parentNode) {
            element.parentNode.replaceChild(newElement, element);
          }
        });

        // パネル自体を削除
        existingPanel.remove();

        // 注入したCSSを削除
        const styleElement = document.getElementById('shima-navigator-styles');
        if (styleElement) {
          styleElement.remove();
        }

        // グローバル関数をクリーンアップ
        this.cleanupGlobalFunctions();
        return true;
      }
      return false;
    },

    /**
     * グローバル関数をクリーンアップ
     */
    cleanupGlobalFunctions: function () {
      const functionNames = [
        'shimaNavUpdateTextFilter',
        'shimaNavUpdatePriorityFilter',
        'shimaNavClearFilters',
        'shimaNavToggleCategory',
        'shimaNavClosePanel'
      ];

      functionNames.forEach(name => {
        if (window[name]) {
          delete window[name];
        }
      });
    },    /**
     * SharePointサイト情報を取得
     * @returns {Object|null} サイト情報オブジェクト、またはnull（SharePointサイトでない場合）
     */
    getSharePointSiteInfo: function () {
      const currentUrl = window.location.href;

      // URLからクエリパラメータとハッシュを除去してベースURLを取得
      const cleanUrl = currentUrl.split('?')[0].split('#')[0];
      const sharepointMatch = cleanUrl.match(/^(?<domain>https?:\/\/[^\/]+)\/sites\/(?<siteName>[^\/]+)/);

      if (!sharepointMatch) {
        return null;
      }

      const { domain, siteName } = sharepointMatch.groups;
      let baseUrl = domain + '/sites/' + siteName;      // TopSite か ChildSite かを判別
      const childSiteMatch = cleanUrl.match(/^(?<protocol>https?:\/\/[^\/]+)\/sites\/(?<siteName>[^\/]+)\/(?<thirdLevelPath>[^\/]+)/);

      // SharePointの特殊パス（システムディレクトリ）を定義
      const systemPaths = [
        'pages', 'lists', 'shared%20documents', 'shared documents', 'forms', 'sitepages',
        'style%20library', 'style library', 'site%20assets', 'site assets', 'siteassets',
      ];

      const thirdLevelPath = childSiteMatch?.groups?.thirdLevelPath || '';

      // システムパス（SharePointの特殊ディレクトリ）かどうかをチェック
      const isSystemPath = thirdLevelPath && (
        systemPaths.includes(thirdLevelPath.toLowerCase()) ||
        systemPaths.includes(decodeURIComponent(thirdLevelPath).toLowerCase()) ||
        thirdLevelPath.startsWith('_') // _layouts, _catalogs, _api, _vti_, etc.
      );

      // 実際の子サイトかどうかを判別（システムパスでない場合のみ）
      const isChildSite = childSiteMatch && thirdLevelPath && !isSystemPath;

      let childSiteName = '';
      if (isChildSite) {
        childSiteName = thirdLevelPath;
        baseUrl = domain + '/sites/' + siteName + '/' + childSiteName;
      }

      // メンテナンスモードなどの特殊URLを検出
      const isSpecialUrl = currentUrl.includes('maintenancemode=true') ||
        currentUrl.includes('_vti_pvt') ||
        currentUrl.includes('Contents=1');

      return {
        domain,
        siteName,
        childSiteName,
        baseUrl,
        isChildSite,
        isSpecialUrl,
        displayName: isChildSite ? `${siteName}/${childSiteName}` : siteName,
        siteType: isChildSite ? 'Child Site' : 'Top Site'
      };
    },

    /**
     * 初期パネルサイズと位置を計算
     * @returns {Object} 位置とサイズの情報
     */
    calculateInitialDimensions: function () {
      let width = Math.min(CONSTANTS.INITIAL_WIDTH, window.innerWidth - 40);
      let height = Math.min(CONSTANTS.INITIAL_HEIGHT, window.innerHeight - 40);
      let left = CONSTANTS.MARGIN;
      let top = CONSTANTS.MARGIN;

      // 画面サイズが小さい場合の調整
      if (window.innerWidth < 520) {
        width = window.innerWidth - CONSTANTS.MARGIN;
        left = 10;
      }
      if (window.innerHeight < 600) {
        height = window.innerHeight - 60;
        top = 30;
      }

      return { width, height, left, top };
    }
  };

  // =============================================================================
  // ナビゲーションデータ生成
  // =============================================================================
  const NavigationData = {
    /**
     * すべてのカテゴリデータを生成
     * @param {Object} siteInfo サイト情報
     * @returns {Array} カテゴリ配列
     */
    createCategories: function (siteInfo) {
      return [
        this.createFrequentCategory(siteInfo),
        this.createUserPermissionCategory(siteInfo),
        this.createGalleryCategory(siteInfo),
        this.createSiteAdminCategory(siteInfo),
        this.createLookFeelCategory(siteInfo),
        this.createSiteActionCategory(siteInfo),
        this.createSiteCollectionCategory(siteInfo),
        this.createCommonActionCategory(siteInfo),
        this.createMaintenanceCategory(siteInfo)
      ];
    },

    /**
     * よく使う機能カテゴリを作成
     */
    createFrequentCategory: function (siteInfo) {
      const links = [
        {
          title: 'サイトコンテンツ',
          url: `${siteInfo.baseUrl}/_layouts/15/viewlsts.aspx`,
          icon: '📋',
          description: 'サイト内のリストとライブラリ一覧',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'ナビゲーションバー非表示',
          url: `${siteInfo.baseUrl}?env=WebView`,
          icon: '👁️',
          description: 'ナビ、ヘッダー、コマンドバーを非表示',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'ナビ&ヘッダー非表示',
          url: `${siteInfo.baseUrl}?env=Embedded`,
          icon: '🖼️',
          description: 'ナビとヘッダーを非表示',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'Microsoft Listsで開く',
          url: `${siteInfo.baseUrl}?env=WebViewList`,
          icon: '📄',
          description: 'リスト/ライブラリをMicrosoft Listsアプリで開く',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'サイト設定',
          url: `${siteInfo.baseUrl}/_layouts/15/settings.aspx`,
          icon: '⚙️',
          description: 'サイト設定ページ',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: '共有フォルダ',
          url: `${siteInfo.baseUrl}/Shared%20Documents/Forms/AllItems.aspx?view=3`,
          icon: '🤝',
          description: '共有されたドキュメント',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'クラシックアプリストア',
          url: `${siteInfo.baseUrl}/_layouts/15/addanapp.aspx`,
          icon: '🏪',
          description: 'SharePointアプリの追加',
          priority: CONSTANTS.PRIORITIES.HIGH
        }
      ];

      // 子サイトの場合は親サイトへのリンクを追加
      if (siteInfo.isChildSite) {
        const topSiteUrl = `${siteInfo.domain}/sites/${siteInfo.siteName}`;
        links.unshift({
          title: 'Top Site に移動',
          url: topSiteUrl,
          icon: '⬆️',
          description: '親サイトに移動',
          priority: CONSTANTS.PRIORITIES.HIGH
        });
      }

      return {
        name: 'よく使う機能',
        icon: CONSTANTS.ICONS.STAR,
        links: links,
        collapsed: false
      };
    },

    /**
     * ユーザーと権限カテゴリを作成
     */
    createUserPermissionCategory: function (siteInfo) {
      return {
        name: 'ユーザーと権限',
        icon: CONSTANTS.ICONS.USERS,
        links: [
          {
            title: 'ユーザー管理',
            url: `${siteInfo.baseUrl}/_layouts/people.aspx`,
            icon: '👥',
            description: 'サイトユーザーの管理',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'グループ管理',
            url: `${siteInfo.baseUrl}/_layouts/groups.aspx`,
            icon: '👫',
            description: 'SharePointグループの管理',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'サイトコレクション管理者',
            url: `${siteInfo.baseUrl}/_layouts/mngsiteadmin.aspx`,
            icon: '👑',
            description: 'サイトコレクション管理者の設定',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: '詳細権限設定',
            url: `${siteInfo.baseUrl}/_layouts/user.aspx`,
            icon: '🔐',
            description: '詳細なアクセス許可設定',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'アプリ権限',
            url: `${siteInfo.baseUrl}/_layouts/15/AppPrincipals.aspx`,
            icon: '🔑',
            description: 'サイトコレクションアプリの権限',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          }
        ],
        collapsed: false
      };
    },

    /**
     * ギャラリーカテゴリを作成
     */
    createGalleryCategory: function (siteInfo) {
      return {
        name: 'ギャラリー',
        icon: CONSTANTS.ICONS.GALLERY,
        links: [
          {
            title: 'サイト列',
            url: `${siteInfo.baseUrl}/_layouts/mngfield.aspx`,
            icon: '📊',
            description: 'サイト列の管理',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'サイトコンテンツタイプ',
            url: `${siteInfo.baseUrl}/_layouts/mngctype.aspx`,
            icon: '📂',
            description: 'コンテンツタイプの管理',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'Webパーツ',
            url: `${siteInfo.baseUrl}/_catalogs/wp/Forms/AllItems.aspx`,
            icon: '🧩',
            description: 'Webパーツギャラリー',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'リストテンプレート',
            url: `${siteInfo.baseUrl}/_catalogs/lt/Forms/AllItems.aspx`,
            icon: '📝',
            description: 'リストテンプレートギャラリー',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'マスターページ',
            url: `${siteInfo.baseUrl}/_layouts/ChangeSiteMasterPage.aspx`,
            icon: '🎨',
            description: 'マスターページの変更',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'テーマ',
            url: `${siteInfo.baseUrl}/_catalogs/theme/Forms/AllItems.aspx`,
            icon: '🎨',
            description: 'テーマギャラリー',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'ソリューション',
            url: `${siteInfo.baseUrl}/_catalogs/solutions/Forms/AllItems.aspx`,
            icon: '📦',
            description: 'ソリューションギャラリー',
            priority: CONSTANTS.PRIORITIES.LOW
          }
        ],
        collapsed: false
      };
    },

    /**
     * サイト管理カテゴリを作成
     */
    createSiteAdminCategory: function (siteInfo) {
      return {
        name: 'サイト管理',
        icon: CONSTANTS.ICONS.ADMIN,
        links: [
          {
            title: '地域設定',
            url: `${siteInfo.baseUrl}/_layouts/regionalsetng.aspx`,
            icon: '🌍',
            description: 'タイムゾーンと地域設定',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'コンテンツと構造',
            url: `${siteInfo.baseUrl}/_Layouts/sitemanager.aspx`,
            icon: '🏗️',
            description: 'サイト構造の管理',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'サイトライブラリとリスト',
            url: `${siteInfo.baseUrl}/_layouts/mcontent.aspx`,
            icon: '📚',
            description: 'すべてのリストとライブラリ',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'ユーザーアラート',
            url: `${siteInfo.baseUrl}/_layouts/sitesubs.aspx`,
            icon: '🔔',
            description: 'アラート設定の管理',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'RSS設定',
            url: `${siteInfo.baseUrl}/_layouts/siterss.aspx`,
            icon: '📡',
            description: 'RSS配信設定',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'サイトとワークスペース',
            url: `${siteInfo.baseUrl}/_layouts/mngsubwebs.aspx`,
            icon: '🏢',
            description: 'サブサイトの管理',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'ワークフロー',
            url: `${siteInfo.baseUrl}/_layouts/wrkmng.aspx`,
            icon: '🔄',
            description: 'ワークフローの管理',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'タクソノミー隠しリスト',
            url: `${siteInfo.baseUrl}/Lists/TaxonomyHiddenList`,
            icon: '🏷️',
            description: 'タクソノミー管理用隠しリスト',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          }
        ],
        collapsed: false
      };
    },

    /**
     * 外観とデザインカテゴリを作成
     */
    createLookFeelCategory: function (siteInfo) {
      return {
        name: '外観とデザイン',
        icon: CONSTANTS.ICONS.DESIGN,
        links: [
          {
            title: 'ウェルカムページ',
            url: `${siteInfo.baseUrl}/_Layouts/AreaWelcomePage.aspx`,
            icon: '👋',
            description: 'ウェルカムページの設定',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'タイトル、説明、アイコン',
            url: `${siteInfo.baseUrl}/_layouts/prjsetng.aspx`,
            icon: '📰',
            description: 'サイトの基本情報設定',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'ページレイアウト',
            url: `${siteInfo.baseUrl}/_Layouts/ChangeSiteMasterPage.aspx`,
            icon: '📄',
            description: 'ページレイアウトの変更',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'ツリービュー',
            url: `${siteInfo.baseUrl}/_layouts/navoptions.aspx`,
            icon: '🌳',
            description: 'ナビゲーションツリーの設定',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'サイトテーマ',
            url: `${siteInfo.baseUrl}/_layouts/themeweb.aspx`,
            icon: '🎨',
            description: 'サイトテーマの変更',
            priority: CONSTANTS.PRIORITIES.LOW
          },
          {
            title: 'ナビゲーション設定',
            url: `${siteInfo.baseUrl}/_layouts/AreaNavigationSettings.aspx`,
            icon: '🧭',
            description: 'サイトナビゲーションの設定',
            priority: CONSTANTS.PRIORITIES.LOW
          }
        ],
        collapsed: false
      };
    },

    /**
     * サイトアクションカテゴリを作成
     */
    createSiteActionCategory: function (siteInfo) {
      return {
        name: 'サイトアクション',
        icon: CONSTANTS.ICONS.ACTION,
        links: [
          {
            title: 'サイト機能管理',
            url: `${siteInfo.baseUrl}/_layouts/ManageFeatures.aspx`,
            icon: '🔧',
            description: 'サイト機能の有効/無効',
            priority: CONSTANTS.PRIORITIES.HIGH
          },
          {
            title: 'サイト削除',
            url: `${siteInfo.baseUrl}/_layouts/deleteweb.aspx`,
            icon: '🗑️',
            description: 'このサイトを削除',
            priority: CONSTANTS.PRIORITIES.HIGH
          },
          {
            title: 'サイトテンプレート保存',
            url: `${siteInfo.baseUrl}/_layouts/savetmpl.aspx`,
            icon: '💾',
            description: 'サイトをテンプレートとして保存',
            priority: CONSTANTS.PRIORITIES.HIGH
          },
          {
            title: 'ごみ箱',
            url: `${siteInfo.baseUrl}/_layouts/RecycleBin.aspx`,
            icon: '🗑️',
            description: 'サイトレベルのごみ箱',
            priority: CONSTANTS.PRIORITIES.HIGH
          }
        ],
        collapsed: false
      };
    },

    /**
     * サイトコレクション管理カテゴリを作成
     */
    createSiteCollectionCategory: function (siteInfo) {
      return {
        name: 'サイトコレクション管理',
        icon: CONSTANTS.ICONS.COLLECTION,
        links: [
          {
            title: '検索設定',
            url: `${siteInfo.baseUrl}/_layouts/enhancedSearch.aspx`,
            icon: '🔍',
            description: '検索の詳細設定',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'サイトコレクション機能',
            url: `${siteInfo.baseUrl}/_layouts/ManageFeatures.aspx?Scope=Site`,
            icon: '🔧',
            description: 'サイトコレクションレベルの機能',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'サイト階層',
            url: `${siteInfo.baseUrl}/_layouts/vsubwebs.aspx`,
            icon: '🌳',
            description: 'サイト階層の表示',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: '監査設定',
            url: `${siteInfo.baseUrl}/_layouts/AuditSettings.aspx`,
            icon: '📊',
            description: 'サイトコレクション監査設定',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: '監査ログレポート',
            url: `${siteInfo.baseUrl}/_layouts/Reporting.aspx?Category=Auditing`,
            icon: '📈',
            description: '監査ログの表示',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'ストレージ使用状況',
            url: `${siteInfo.baseUrl}/_layouts/storman.aspx`,
            icon: '💽',
            description: 'ストレージ使用量の確認',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'SharePoint Designer設定',
            url: `${siteInfo.baseUrl}/_layouts/SharePointDesignerSettings.aspx`,
            icon: '🎨',
            description: 'SharePoint Designerの設定',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          }
        ],
        collapsed: false
      };
    },

    /**
     * 一般的なアクションカテゴリを作成
     */
    createCommonActionCategory: function (siteInfo) {
      const links = [
        {
          title: '新規作成',
          url: `${siteInfo.baseUrl}/_layouts/spscreate.aspx`,
          icon: '➕',
          description: '新しいアイテムの作成',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'リスト表示',
          url: `${siteInfo.baseUrl}/_layouts/viewlsts.aspx`,
          icon: '📋',
          description: '全リストの表示',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'サイトグループ作成',
          url: `${siteInfo.baseUrl}/_layouts/permsetup.aspx`,
          icon: '👥',
          description: 'サイトグループの作成',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'クイック起動',
          url: `${siteInfo.baseUrl}/_layouts/quiklnch.aspx`,
          icon: '🚀',
          description: 'クイック起動の設定',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'ワークフロー履歴',
          url: `${siteInfo.baseUrl}/lists/Workflow History`,
          icon: '📜',
          description: 'ワークフロー履歴リスト',
          priority: CONSTANTS.PRIORITIES.HIGH
        },
        {
          title: 'ユーザーアラート管理',
          url: `${siteInfo.baseUrl}/_layouts/AlertsAdmin.aspx`,
          icon: '🔔',
          description: 'ユーザーアラートの管理',
          priority: CONSTANTS.PRIORITIES.HIGH
        }
      ];

      // 特殊URL用のリンクを追加
      if (siteInfo.isSpecialUrl) {
        links.unshift({
          title: '通常モードに戻る',
          url: siteInfo.baseUrl,
          icon: '🔄',
          description: '通常のページビューに戻る',
          priority: CONSTANTS.PRIORITIES.HIGH
        });
      }

      return {
        name: '一般的なアクション',
        icon: CONSTANTS.ICONS.TOOLS,
        links: links,
        collapsed: false
      };
    },

    /**
     * メンテナンスカテゴリを作成
     */
    createMaintenanceCategory: function (siteInfo) {
      return {
        name: 'メンテナンス',
        icon: CONSTANTS.ICONS.MAINTENANCE,
        links: [
          {
            title: 'Webパーツメンテナンス（クラシック）',
            url: `${siteInfo.baseUrl}?Contents=1`,
            icon: '🔧',
            description: 'クラシックページのWebパーツメンテナンス',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'Webパーツメンテナンス（モダン）',
            url: `${siteInfo.baseUrl}?maintenancemode=true`,
            icon: '🔧',
            description: 'モダンページのメンテナンスモード',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          },
          {
            title: 'SharePointバージョン確認',
            url: `${siteInfo.baseUrl}/_vti_pvt/Service.cnf`,
            icon: 'ℹ️',
            description: 'サーバーバージョンとパッチレベル',
            priority: CONSTANTS.PRIORITIES.MEDIUM
          }
        ],
        collapsed: false
      };
    }
  };

  // =============================================================================
  // フィルタリング
  // =============================================================================
  const FilterManager = {
    currentPriorityFilter: CONSTANTS.PRIORITIES.ALL,
    currentTextFilter: '',

    /**
     * フィルターを適用してカテゴリをフィルタリング
     * @param {Array} categories 全カテゴリ
     * @returns {Array} フィルタリング済みカテゴリ
     */
    applyFilters: function (categories) {
      const self = this;
      return categories.map(function (category) {
        const filteredLinks = category.links.filter(function (link) {
          // 優先度フィルター
          const priorityMatch = self.currentPriorityFilter === CONSTANTS.PRIORITIES.ALL ||
            link.priority === self.currentPriorityFilter;

          // テキストフィルター
          const textMatch = self.currentTextFilter === '' ||
            link.title.toLowerCase().includes(self.currentTextFilter.toLowerCase()) ||
            link.description.toLowerCase().includes(self.currentTextFilter.toLowerCase());

          return priorityMatch && textMatch;
        });

        return {
          name: category.name,
          icon: category.icon,
          links: filteredLinks,
          collapsed: category.collapsed
        };
      }).filter(function (category) {
        return category.links.length > 0;
      });
    },

    /**
     * テキストフィルターを更新
     * @param {string} value フィルター文字列
     */
    updateTextFilter: function (value) {
      this.currentTextFilter = value;
    },

    /**
     * 優先度フィルターを更新
     * @param {string} priority 優先度
     */
    updatePriorityFilter: function (priority) {
      this.currentPriorityFilter = priority;
    },

    /**
     * すべてのフィルターをクリア
     */
    clearFilters: function () {
      this.currentTextFilter = '';
      this.currentPriorityFilter = CONSTANTS.PRIORITIES.ALL;
    }
  };

  // =============================================================================
  // UI生成
  // =============================================================================
  const UIGenerator = {
    /**
     * CSSスタイルを生成・注入
     */
    injectCSS: function () {
      const existingStyle = document.getElementById('shima-navigator-styles');
      if (existingStyle) {
        existingStyle.remove();
      }

      const style = document.createElement('style');
      style.id = 'shima-navigator-styles';
      style.textContent = `
        #${CONSTANTS.PANEL_ID} .close-button:hover {
          background-color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
          opacity: 0.9 !important;
        }

        #${CONSTANTS.PANEL_ID} .category-header:hover {
          background-color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
        }

        #${CONSTANTS.PANEL_ID} .nav-link:hover {
          background-color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
        }

        #${CONSTANTS.PANEL_ID} button[data-action]:hover:not(:disabled) {
          opacity: 0.9 !important;
          transform: translateY(-1px) !important;
        }

        #${CONSTANTS.PANEL_ID} button[data-action]:active:not(:disabled) {
          transform: translateY(0) !important;
        }

        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar {
          width: 8px !important;
        }

        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar-track {
          background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
        }

        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar-thumb {
          background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
          border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
        }

        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar-thumb:hover {
          background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.MUTED} !important;
        }
      `;

      document.head.appendChild(style);
    },

    /**
     * メインHTMLコンテンツを生成
     * @param {Object} siteInfo サイト情報
     * @param {Array} categories カテゴリ配列
     * @returns {string} HTML文字列
     */
    generateHTML: function (siteInfo, categories) {
      const filteredCategories = FilterManager.applyFilters(categories);

      return `
        <div style="${this.getMainContainerStyle()}">
          ${this.generateHeader(siteInfo)}
          ${this.generateFilterArea()}
          ${this.generateContent(filteredCategories)}
        </div>
      `;
    },

    /**
     * メインコンテナのスタイルを取得
     */
    getMainContainerStyle: function () {
      return [
        'padding: 16px !important',
        'height: 100% !important',
        'display: flex !important',
        'flex-direction: column !important',
        'box-sizing: border-box !important'
      ].join(';');
    },

    /**
     * ヘッダー部分を生成
     */
    generateHeader: function (siteInfo) {
      return `
        <div style="${this.getHeaderStyle()}">
          <div>
            <h3 style="${this.getTitleStyle()}">${CONSTANTS.ICONS.NAVIGATOR} SharePoint Navigator</h3>            <div style="${this.getSubtitleStyle()}">${siteInfo.displayName} (${siteInfo.siteType})</div>          </div>
          <button data-action="close" class="close-button" style="${this.getCloseButtonStyle()}"
                  title="パネルを閉じる">✕</button>
        </div>
      `;
    },

    /**
     * ヘッダーのスタイルを取得
     */
    getHeaderStyle: function () {
      return [
        'display: flex !important',
        'justify-content: space-between !important',
        'align-items: center !important',
        `margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important`,
        `padding-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important`,
        `border-bottom: 2px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important`,
        'cursor: move !important'
      ].join(';');
    },

    /**
     * タイトルのスタイルを取得
     */
    getTitleStyle: function () {
      return [
        'margin: 0 !important',
        `color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important`,
        `font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important`,
        `font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important`,
        'cursor: move !important'
      ].join(';');
    },

    /**
     * サブタイトルのスタイルを取得
     */
    getSubtitleStyle: function () {
      return [
        `font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important`,
        `color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important`,
        `margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important`
      ].join(';');
    },

    /**
     * 閉じるボタンのスタイルを取得
     */
    getCloseButtonStyle: function () {
      return [
        `background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important`,
        'border: none !important',
        `border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important`,
        'width: 28px !important',
        'height: 28px !important',
        'cursor: pointer !important',
        'display: flex !important',
        'align-items: center !important',
        'justify-content: center !important',
        `font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important`,
        `transition: all ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important`,
        `color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important`
      ].join(';');
    },

    /**
     * フィルターエリアを生成
     */
    generateFilterArea: function () {
      return `
        <div style="${this.getFilterAreaStyle()}">
          ${this.generateTextFilter()}
          ${this.generatePriorityButtons()}
          ${this.generateClearButton()}
        </div>
      `;
    },

    /**
     * フィルターエリアのスタイルを取得
     */
    getFilterAreaStyle: function () {
      return [
        'display: flex !important',
        'gap: 8px !important',
        'margin-bottom: 16px !important',
        'align-items: center !important'
      ].join(';');
    },

    /**
     * テキストフィルターを生成
     */
    generateTextFilter: function () {
      return `
        <input type="text" id="nav-text-filter" placeholder="検索..." value="${FilterManager.currentTextFilter}"
               style="${this.getTextFilterStyle()}">
      `;
    },

    /**
     * テキストフィルターのスタイルを取得
     */
    getTextFilterStyle: function () {
      return [
        'flex: 1 !important',
        'padding: 6px 8px !important',
        'border: 1px solid #c8c6c4 !important',
        'border-radius: 4px !important',
        'font-size: 13px !important',
        'font-family: inherit !important'
      ].join(';');
    },

    /**
     * 優先度ボタンを生成
     */
    generatePriorityButtons: function () {
      const priorities = [
        { key: CONSTANTS.PRIORITIES.ALL, label: '全て', color: CONSTANTS.PRIORITY_COLORS.all },
        { key: CONSTANTS.PRIORITIES.HIGH, label: '高', color: CONSTANTS.PRIORITY_COLORS.high },
        { key: CONSTANTS.PRIORITIES.MEDIUM, label: '中', color: CONSTANTS.PRIORITY_COLORS.medium },
        { key: CONSTANTS.PRIORITIES.LOW, label: '低', color: CONSTANTS.PRIORITY_COLORS.low }
      ];

      const buttons = priorities.map(priority => {
        const isActive = FilterManager.currentPriorityFilter === priority.key;
        const bgColor = isActive ? priority.color : '#f3f2f1';
        const textColor = isActive ? 'white' : '#323130'; return `
          <button data-action="priority-filter" data-priority="${priority.key}"
                  style="${this.getPriorityButtonStyle(bgColor, textColor, priority.color, isActive)}"
                  title="${priority.label}優先度でフィルタリング">
            ${priority.label}
          </button>
        `;
      }).join('');

      return `<div style="display: flex !important; gap: 4px !important;">${buttons}</div>`;
    },

    /**
     * 優先度ボタンのスタイルを取得
     */
    getPriorityButtonStyle: function (bgColor, textColor, borderColor, isActive) {
      return [
        `background: ${bgColor} !important`,
        `color: ${textColor} !important`,
        `border: 1px solid ${borderColor} !important`,
        'border-radius: 4px !important',
        'padding: 4px 8px !important',
        'font-size: 11px !important',
        `font-weight: ${isActive ? '600' : '400'} !important`,
        'cursor: pointer !important',
        'white-space: nowrap !important'
      ].join(';');
    },

    /**
     * クリアボタンを生成
     */    generateClearButton: function () {
      return `
        <button data-action="clear-filters" style="${this.getClearButtonStyle()}"
                title="全てのフィルターをクリア">
          クリア
        </button>
      `;
    },

    /**
     * クリアボタンのスタイルを取得
     */
    getClearButtonStyle: function () {
      return [
        'background: #f3f2f1 !important',
        'border: 1px solid #c8c6c4 !important',
        'border-radius: 4px !important',
        'padding: 4px 8px !important',
        'font-size: 11px !important',
        'cursor: pointer !important'
      ].join(';');
    },

    /**
     * コンテンツエリアを生成
     */
    generateContent: function (filteredCategories) {
      return `
        <div style="${this.getContentAreaStyle()}">
          <div style="${this.getGridStyle()}">
            ${filteredCategories.map((category, index) => this.generateCategory(category, index)).join('')}
          </div>
        </div>
      `;
    },

    /**
     * コンテンツエリアのスタイルを取得
     */
    getContentAreaStyle: function () {
      return [
        'flex: 1 !important',
        'overflow-y: auto !important',
        'padding-right: 4px !important'
      ].join(';');
    },

    /**
     * グリッドのスタイルを取得
     */
    getGridStyle: function () {
      return [
        'display: grid !important',
        'grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important',
        'gap: 16px !important'
      ].join(';');
    },

    /**
     * カテゴリを生成
     */
    generateCategory: function (category, categoryIndex) {
      return `
        <div style="${this.getCategoryContainerStyle()}">
          ${this.generateCategoryHeader(category, categoryIndex)}
          ${this.generateCategoryContent(category, categoryIndex)}
        </div>
      `;
    },

    /**
     * カテゴリコンテナのスタイルを取得
     */
    getCategoryContainerStyle: function () {
      return [
        'border: 1px solid #edebe9 !important',
        'border-radius: 6px !important',
        'overflow: hidden !important'
      ].join(';');
    },

    /**
     * カテゴリヘッダーを生成
     */    generateCategoryHeader: function (category, categoryIndex) {
      const action = category.collapsed ? '展開' : '折りたたみ';
      return `
        <div data-action="toggle-category" data-category-index="${categoryIndex}"
             class="category-header" style="${this.getCategoryHeaderStyle()}"
             title="${category.name}カテゴリーを${action}">
          <span>${category.icon} ${category.name} (${category.links.length})</span>
          <span style="color: #605e5c !important; font-size: 12px !important;" id="arrow-${categoryIndex}">
            ${category.collapsed ? '▶' : '▼'}
          </span>
        </div>
      `;
    },

    /**
     * カテゴリヘッダーのスタイルを取得
     */
    getCategoryHeaderStyle: function () {
      return [
        'background: #f8f8f8 !important',
        'padding: 8px 12px !important',
        'cursor: pointer !important',
        'border-bottom: 1px solid #edebe9 !important',
        'display: flex !important',
        'justify-content: space-between !important',
        'align-items: center !important',
        'font-weight: 600 !important',
        'font-size: 13px !important'
      ].join(';');
    },

    /**
     * カテゴリコンテンツを生成
     */
    generateCategoryContent: function (category, categoryIndex) {
      const linksHtml = category.links.map(link => this.generateLink(link)).join('');

      return `
        <div id="content-${categoryIndex}" style="${this.getCategoryContentStyle(category.collapsed)}">
          ${linksHtml}
        </div>
      `;
    },

    /**
     * カテゴリコンテンツのスタイルを取得
     */
    getCategoryContentStyle: function (collapsed) {
      return [
        `display: ${collapsed ? 'none' : 'block'} !important`,
        'padding: 8px !important'
      ].join(';');
    },    /**
     * リンクを生成
     */
    generateLink: function (link) {
      const priorityColor = CONSTANTS.PRIORITY_COLORS[link.priority] || '#605e5c';

      // ツールチップに説明と遷移先URLを含める
      const tooltipText = `${link.description}\n\n遷移先: ${link.url}`;

      return `
        <a href="${link.url}" class="nav-link" style="${this.getLinkStyle(priorityColor)}"
           title="${tooltipText}">
          <div style="${this.getLinkTitleStyle()}">${link.icon} ${link.title}</div>
          <div style="${this.getLinkDescriptionStyle()}">${link.description}</div>
        </a>
      `;
    },

    /**
     * リンクのスタイルを取得
     */
    getLinkStyle: function (priorityColor) {
      return [
        'display: block !important',
        'padding: 6px 8px !important',
        'margin: 2px 0 !important',
        'text-decoration: none !important',
        'color: #323130 !important',
        'border-radius: 4px !important',
        `border-left: 3px solid ${priorityColor} !important`,
        'background: #fafafa !important'
      ].join(';');
    },

    /**
     * リンクタイトルのスタイルを取得
     */
    getLinkTitleStyle: function () {
      return [
        'font-weight: 500 !important',
        'font-size: 12px !important',
        'line-height: 1.3 !important'
      ].join(';');
    },

    /**
     * リンク説明のスタイルを取得
     */
    getLinkDescriptionStyle: function () {
      return [
        'font-size: 10px !important',
        'color: #605e5c !important',
        'margin-top: 2px !important',
        'line-height: 1.2 !important'
      ].join(';');
    }
  };

  // =============================================================================
  // パネル管理
  // =============================================================================
  const PanelManager = {
    panel: null,
    allCategories: [],
    siteInfo: null,
    textFilterHandler: null,

    /**
     * パネルを初期化
     */
    initialize: function () {
      try {
        // 既存パネルをクリーンアップ
        if (Utils.cleanupExistingPanel()) {
          return;
        }

        // SharePointサイト情報を取得
        this.siteInfo = Utils.getSharePointSiteInfo();
        if (!this.siteInfo) {
          alert('このブックマークレットはSharePointサイトでのみ動作します。');
          return;
        }        // カテゴリデータを作成
        this.allCategories = NavigationData.createCategories(this.siteInfo);

        // CSSスタイルを注入
        UIGenerator.injectCSS();

        // パネルを作成
        this.createPanel();
        this.setupGlobalFunctions();

        // パネルをDOMに追加
        document.body.appendChild(this.panel);

        // DOM追加後にイベントリスナーを設定（確実に要素が存在するように）
        setTimeout(() => {
          this.setupEventListeners();
        }, 0);

        this.setupDragAndResize();

        // パネル外クリックで閉じる
        this.setupOutsideClickHandler();

      } catch (error) {
        console.error('SharePoint Navigator の初期化に失敗しました:', error);
        alert('エラーが発生しました。詳細はコンソールを確認してください。');
      }
    },

    /**
     * パネル要素を作成
     */
    createPanel: function () {
      this.panel = document.createElement('div');
      this.panel.id = CONSTANTS.PANEL_ID;

      const dimensions = Utils.calculateInitialDimensions();
      this.panel.style.cssText = this.getPanelStyle(dimensions);

      // リサイズハンドルを追加
      const resizeHandle = this.createResizeHandle();
      this.panel.appendChild(resizeHandle);

      // コンテンツを設定
      this.updateContent();
    },

    /**
     * パネルのスタイルを取得
     */
    getPanelStyle: function (dimensions) {
      return [
        'all: initial',
        'position: fixed !important',
        `top: ${dimensions.top}px !important`,
        `left: ${dimensions.left}px !important`,
        `width: ${dimensions.width}px !important`,
        `height: ${dimensions.height}px !important`,
        `min-width: ${CONSTANTS.MIN_WIDTH}px !important`,
        `min-height: ${CONSTANTS.MIN_HEIGHT}px !important`,
        `max-width: ${window.innerWidth - CONSTANTS.MARGIN}px !important`,
        `max-height: ${window.innerHeight - CONSTANTS.MARGIN}px !important`,
        `background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important`,
        `border: 2px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important`,
        `border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} !important`,
        `box-shadow: ${SHAREPOINT_DESIGN_SYSTEM.SHADOWS.PANEL} !important`,
        `z-index: ${CONSTANTS.Z_INDEX} !important`,
        `font-family: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important`,
        `font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important`,
        'line-height: 1.4 !important',
        `color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important`,
        'overflow: hidden !important',
        'display: flex !important',
        'flex-direction: column !important'
      ].join(';');
    },

    /**
     * リサイズハンドルを作成
     */
    createResizeHandle: function () {
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = [
        'position: absolute !important',
        'bottom: 0 !important',
        'right: 0 !important',
        'width: 20px !important',
        'height: 20px !important',
        'background: linear-gradient(-45deg, transparent 40%, #c8c6c4 40%, #c8c6c4 60%, transparent 60%) !important',
        'cursor: se-resize !important',
        'z-index: 10 !important'
      ].join(';');

      return resizeHandle;
    },

    /**
     * コンテンツを更新
     */
    updateContent: function () {
      this.panel.innerHTML = UIGenerator.generateHTML(this.siteInfo, this.allCategories) +
        this.panel.querySelector('.resize-handle').outerHTML;
    },

    /**
     * コンテンツエリアのみを更新（フィルター用）
     */
    updateContentOnly: function () {
      const contentArea = this.panel.querySelector('div[style*="flex: 1"]');
      if (contentArea) {
        const filteredCategories = FilterManager.applyFilters(this.allCategories);
        const gridStyle = UIGenerator.getGridStyle();

        contentArea.innerHTML = `
          <div style="${gridStyle}">
            ${filteredCategories.map((category, index) => UIGenerator.generateCategory(category, index)).join('')}
          </div>
        `;

        // カテゴリのイベントリスナーを再設定
        this.setupCategoryEventListeners();
      }
    },

    /**
     * カテゴリのイベントリスナーのみを設定
     */
    setupCategoryEventListeners: function () {
      const self = this;

      // カテゴリトグルのイベントリスナーを設定
      const toggleElements = this.panel.querySelectorAll('[data-action="toggle-category"]');
      toggleElements.forEach(element => {
        element.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();

          const categoryIndex = parseInt(this.getAttribute('data-category-index'), 10);
          window.shimaNavToggleCategory(categoryIndex);
        });
      });
    },

    /**
     * グローバル関数を設定
     */
    setupGlobalFunctions: function () {
      const self = this;

      window.shimaNavUpdateTextFilter = function (value) {
        FilterManager.updateTextFilter(value);
        // テキストフィルターの場合はコンテンツのみ更新
        self.updateContentOnly();
      };

      window.shimaNavUpdatePriorityFilter = function (priority) {
        FilterManager.updatePriorityFilter(priority);
        // 優先度フィルターの場合は全体を更新（ボタンの状態も変わるため）
        self.updateContent();
        self.setupEventListeners();
      };

      window.shimaNavClearFilters = function () {
        FilterManager.clearFilters();
        // クリアの場合は全体を更新（フィルターエリアもリセットする必要があるため）
        self.updateContent();
        self.setupEventListeners();
      };

      window.shimaNavToggleCategory = function (categoryIndex) {
        const filteredCategories = FilterManager.applyFilters(self.allCategories);
        if (filteredCategories[categoryIndex]) {
          const categoryName = filteredCategories[categoryIndex].name;
          for (let i = 0; i < self.allCategories.length; i++) {
            if (self.allCategories[i].name === categoryName) {
              self.allCategories[i].collapsed = !self.allCategories[i].collapsed;
              break;
            }
          }
          // カテゴリ展開/折りたたみの場合はコンテンツのみ更新
          self.updateContentOnly();
        }
      }; window.shimaNavClosePanel = function () {
        // 外部クリックイベントリスナーを削除
        if (self.outsideClickHandler) {
          document.removeEventListener('click', self.outsideClickHandler, false);
          self.outsideClickHandler = null;
        }        // パネル内クリックイベントリスナーを削除
        if (self.panelClickHandler && self.panel) {
          self.panel.removeEventListener('click', self.panelClickHandler, false);
          self.panelClickHandler = null;
        }

        // パネルを削除
        if (self.panel && self.panel.parentNode) {
          self.panel.remove();
        }        // 注入したCSSを削除
        const styleElement = document.getElementById('shima-navigator-styles');
        if (styleElement) {
          styleElement.remove();
        }

        // コンソール警告抑制を元に戻す（必要に応じて）
        if (window.originalConsoleWarn) {
          console.warn = window.originalConsoleWarn;
          delete window.originalConsoleWarn;
        }

        // グローバ関数をクリーンアップ
        Utils.cleanupGlobalFunctions();
      };
    },

    /**
     * イベントリスナーを設定
     */
    setupEventListeners: function () {
      const self = this;

      // テキストフィルターのイベントリスナー
      const textInput = document.getElementById('nav-text-filter');
      if (textInput) {
        // 既存のイベントリスナーを削除
        textInput.removeEventListener('input', this.textFilterHandler);

        // 新しいイベントリスナーを設定
        this.textFilterHandler = function (e) {
          // フォーカスを維持するため、カーソル位置を保存
          const cursorPosition = this.selectionStart;

          // フィルターを更新し、コンテンツのみを更新
          FilterManager.updateTextFilter(this.value);
          self.updateContentOnly();

          // フォーカスとカーソル位置を復元
          setTimeout(() => {
            const newInput = document.getElementById('nav-text-filter');
            if (newInput) {
              newInput.focus();
              newInput.setSelectionRange(cursorPosition, cursorPosition);
            }
          }, 0);
        };

        textInput.addEventListener('input', this.textFilterHandler);
      }

      // data-action属性を持つ要素にイベントリスナーを設定
      const actionElements = this.panel.querySelectorAll('[data-action]');
      console.log('Elements with data-action:', actionElements.length);

      actionElements.forEach(element => {
        element.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();

          const action = this.getAttribute('data-action');
          console.log('Action clicked:', action);

          switch (action) {
            case 'close':
              window.shimaNavClosePanel();
              break;

            case 'priority-filter':
              const priority = this.getAttribute('data-priority');
              window.shimaNavUpdatePriorityFilter(priority);
              break;

            case 'clear-filters':
              window.shimaNavClearFilters();
              break;

            case 'toggle-category':
              const categoryIndex = parseInt(this.getAttribute('data-category-index'), 10);
              window.shimaNavToggleCategory(categoryIndex);
              break;

            default:
              console.log('Unknown action:', action);
          }
        });
      });

      // 残っているonclick属性をチェック（デバッグ用）
      const onclickElements = this.panel.querySelectorAll('[onclick]');
      if (onclickElements.length > 0) {
        console.warn('Still have onclick elements:', onclickElements.length);
      }
    },

    /**
     * ドラッグ&リサイズ機能を設定
     */
    setupDragAndResize: function () {
      this.dragHandler = new DragResizeHandler(this.panel);
      this.dragHandler.initialize();
    },

    /**
     * パネル外クリックハンドラーを設定
     */
    setupOutsideClickHandler: function () {
      const self = this;

      // 既存のイベントリスナーがあれば削除
      if (this.outsideClickHandler) {
        document.removeEventListener('click', this.outsideClickHandler);
      }

      if (this.panelClickHandler) {
        this.panel.removeEventListener('click', this.panelClickHandler);
      }

      // パネル内クリックハンドラー - パネル内をクリックした場合はイベント伝播を停止
      this.panelClickHandler = function (e) {
        console.log('Panel internal click detected - preventing propagation');
        e.stopPropagation(); // 外部クリックハンドラーへの伝播を防ぐ
      };

      // 外部クリックハンドラー - シンプルな設計
      this.outsideClickHandler = function (e) {
        console.log('Document click detected - checking if should close panel');

        // ドラッグ中は何もしない
        if (self.dragHandler && (self.dragHandler.isDragging || self.dragHandler.isResizing)) {
          console.log('Drag/resize in progress - ignoring click');
          return;
        }

        // ここに到達したということは、パネル外をクリックしたということ
        // （パネル内のクリックは stopPropagation() で阻止されるため）
        console.log('Closing panel due to outside click');
        window.shimaNavClosePanel();
      };

      // パネル内クリックハンドラーを追加（イベント伝播を停止するため）
      this.panel.addEventListener('click', this.panelClickHandler, false);

      // 外部クリックハンドラーを追加（少し遅延させる）
      setTimeout(function () {
        document.addEventListener('click', self.outsideClickHandler, false);
      }, 100);
    }
  };
  // =============================================================================
  // ドラッグ&リサイズハンドラー
  // =============================================================================
  function DragResizeHandler(panel) {
    this.panel = panel;
    this.isDragging = false;
    this.isResizing = false;
    this.currentX = 0;
    this.currentY = 0;
    this.initialX = 0;
    this.initialY = 0;
    this.xOffset = 0;
    this.yOffset = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.startX = 0;
    this.startY = 0;
    this.lastDragEndTime = 0;
  }

  DragResizeHandler.prototype = {
    /**
     * ドラッグ&リサイズを初期化
     */
    initialize: function () {
      this.panel.addEventListener('mousedown', this.handleMouseDown.bind(this), false);
      document.addEventListener('mouseup', this.handleMouseUp.bind(this), false);
      document.addEventListener('mousemove', this.handleMouseMove.bind(this), false);
    },

    /**
     * マウスダウンハンドラー
     */
    handleMouseDown: function (e) {
      const resizeHandle = this.panel.querySelector('.resize-handle');

      if (e.target === resizeHandle) {
        this.startResize(e);
      } else if (this.isInDragArea(e)) {
        this.startDrag(e);
      }
    },

    /**
     * リサイズ開始
     */
    startResize: function (e) {
      this.isResizing = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.startWidth = parseInt(getComputedStyle(this.panel).width, 10);
      this.startHeight = parseInt(getComputedStyle(this.panel).height, 10);
      e.preventDefault();
    },

    /**
     * ドラッグ開始
     */
    startDrag: function (e) {
      if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
        this.initialX = e.clientX - this.xOffset;
        this.initialY = e.clientY - this.yOffset;
        this.isDragging = true;
        this.panel.style.cursor = 'move';
        e.preventDefault();
      }
    },

    /**
     * ドラッグ可能エリアかチェック
     */
    isInDragArea: function (e) {
      const rect = this.panel.getBoundingClientRect();
      const isInHeaderArea = (e.clientY - rect.top) < 60;
      const isHeaderElement = e.target.tagName === 'H3' ||
        e.target.closest('h3') ||
        (e.target.closest('div') && e.target.closest('div').style.borderBottom);

      return isInHeaderArea || isHeaderElement;
    },

    /**
     * マウス移動ハンドラー
     */
    handleMouseMove: function (e) {
      if (this.isDragging) {
        this.handleDrag(e);
      } else if (this.isResizing) {
        this.handleResize(e);
      }
    },

    /**
     * ドラッグ処理
     */
    handleDrag: function (e) {
      e.preventDefault();
      this.currentX = e.clientX - this.initialX;
      this.currentY = e.clientY - this.initialY;
      this.xOffset = this.currentX;
      this.yOffset = this.currentY;

      const newLeft = Math.max(0, Math.min(this.currentX, window.innerWidth - this.panel.offsetWidth));
      const newTop = Math.max(0, Math.min(this.currentY, window.innerHeight - this.panel.offsetHeight));

      this.panel.style.left = newLeft + 'px';
      this.panel.style.top = newTop + 'px';
    },

    /**
     * リサイズ処理
     */
    handleResize: function (e) {
      e.preventDefault();
      const newWidth = this.startWidth + e.clientX - this.startX;
      const newHeight = this.startHeight + e.clientY - this.startY;

      const maxWidth = window.innerWidth - parseInt(this.panel.style.left, 10) - CONSTANTS.MARGIN;
      const maxHeight = window.innerHeight - parseInt(this.panel.style.top, 10) - CONSTANTS.MARGIN;

      const finalWidth = Math.max(CONSTANTS.MIN_WIDTH, Math.min(newWidth, maxWidth));
      const finalHeight = Math.max(CONSTANTS.MIN_HEIGHT, Math.min(newHeight, maxHeight));

      this.panel.style.width = finalWidth + 'px';
      this.panel.style.height = finalHeight + 'px';
    },

    /**
     * マウスアップハンドラー
     */
    handleMouseUp: function (e) {
      if (this.isDragging) {
        this.initialX = this.currentX;
        this.initialY = this.currentY;
        this.isDragging = false;
        this.panel.style.cursor = '';
        this.lastDragEndTime = Date.now();
        e.preventDefault();
        e.stopPropagation();
      }
      if (this.isResizing) {
        this.isResizing = false;
        this.lastDragEndTime = Date.now();
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };

  // =============================================================================
  // メイン実行
  // =============================================================================
  PanelManager.initialize();

})();
