/**
 * SharePoint API Navigator Bookmarklet (リファクタリング版)
 * SharePoint REST API の探索・テストツール
 *
 * 機能:
 * - SharePoint REST API エンドポイントの選択
 * - API レスポンスの表示（JSON/テーブル形式）
 * - フィルタリング・ソート機能
 * - Lists API の詳細表示
 */

javascript: (() => {
  'use strict';

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

  // 定数定義
  const CONFIG = {
    PANEL_ID: 'shima-sharepoint-api-navigator',
    STORAGE_KEY: 'shima-api-last-results',
    MAX_DISPLAY_FIELDS: 10,
    MAX_CELL_LENGTH: 250
  };

  // ユーティリティ関数
  const Utils = {
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
      if (field.toLowerCase().includes('date') && value) {
        try {
          return new Date(value).toLocaleString('ja-JP');
        } catch (e) {
          return this.escapeHtml(String(value));
        }
      }
      return this.escapeHtml(String(value));
    },

    // 重要なフィールドを取得
    getImportantFields(item, endpointId) {
      const allFields = Object.keys(item);
      const fieldPriority = {
        'lists': ['Title', 'BaseTemplate', 'ItemCount', 'Created', 'LastItemModifiedDate', 'Id'],
        'users': ['Title', 'LoginName', 'Email', 'IsSiteAdmin', 'Id'],
        'groups': ['Title', 'Description', 'Owner', 'Users', 'Id'],
        'web': ['Title', 'Url', 'Created', 'Language', 'WebTemplate', 'Id'],
        'webs': ['Title', 'Url', 'Created', 'WebTemplate', 'Id'],
        'contentTypes': ['Name', 'Id', 'Group', 'Hidden'],
        'features': ['DisplayName', 'DefinitionId', 'Id']
      };

      const priority = fieldPriority[endpointId] || [];
      const result = [];

      // 優先フィールドを追加
      priority.forEach(field => {
        if (allFields.includes(field)) {
          result.push(field);
        }
      });

      // 残りの重要そうなフィールドを追加
      const commonImportant = ['Title', 'Name', 'DisplayName', 'Url', 'Email', 'Description'];
      allFields.forEach(field => {
        if (result.length >= CONFIG.MAX_DISPLAY_FIELDS) return;
        if (!result.includes(field) &&
          (commonImportant.includes(field) ||
            (!field.startsWith('__') && typeof item[field] !== 'object'))) {
          result.push(field);
        }
      });

      return result.slice(0, CONFIG.MAX_DISPLAY_FIELDS);
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
    }
  };

  // SharePoint API エンドポイント定義
  class ApiEndpoints {
    constructor(apiBaseUrl) {
      this.apiBaseUrl = apiBaseUrl;
    }

    getEndpoints() {
      return [
        {
          id: 'web',
          title: 'Web Site',
          url: `${this.apiBaseUrl}/web`,
          description: 'サイトの基本情報'
        },
        {
          id: 'lists',
          title: 'Lists',
          url: `${this.apiBaseUrl}/web/lists`,
          description: 'サイト内のリスト一覧'
        },
        {
          id: 'webs',
          title: 'Sub Sites',
          url: `${this.apiBaseUrl}/web/webs`,
          description: 'サブサイト一覧'
        },
        {
          id: 'users',
          title: 'Site Users',
          url: `${this.apiBaseUrl}/web/siteusers`,
          description: 'サイトユーザー一覧'
        },
        {
          id: 'groups',
          title: 'Site Groups',
          url: `${this.apiBaseUrl}/web/sitegroups`,
          description: 'サイトグループ一覧'
        },
        {
          id: 'roleassignments',
          title: 'Role Assignments',
          url: `${this.apiBaseUrl}/web/roleassignments`,
          description: '権限割り当て一覧'
        },
        {
          id: 'contentTypes',
          title: 'Content Types',
          url: `${this.apiBaseUrl}/web/contenttypes`,
          description: 'コンテンツタイプ一覧'
        },
        {
          id: 'features',
          title: 'Site Features',
          url: `${this.apiBaseUrl}/web/features`,
          description: 'サイト機能一覧'
        }
      ];
    }

    // 動的エンドポイント生成
    createListDetailEndpoint(listId, listTitle) {
      return {
        id: 'list-detail',
        title: `List Detail: ${listTitle}`,
        url: `${this.apiBaseUrl}/web/lists('${listId}')`
      };
    }

    createListFieldsEndpoint(listId, listTitle) {
      return {
        id: 'list-fields',
        title: `List Fields: ${listTitle}`,
        url: `${this.apiBaseUrl}/web/lists('${listId}')/fields`
      };
    }

    createListItemsEndpoint(listId, listTitle) {
      return {
        id: 'list-items',
        title: `List Items: ${listTitle}`,
        url: `${this.apiBaseUrl}/web/lists('${listId}')/items`
      };
    }
  }

  // UI コンポーネント管理
  class UIManager {
    constructor(baseUrl, apiEndpoints) {
      this.baseUrl = baseUrl;
      this.apiEndpoints = apiEndpoints;
      this.panel = null;
    }

    // メインパネル作成
    createPanel() {
      this.panel = document.createElement('div');
      this.panel.id = CONFIG.PANEL_ID;
      this.panel.style.cssText = this.getPanelStyles();

      // ドラッグ機能を追加
      this.makeDraggable(this.panel);

      return this.panel;
    }

    // パネルをドラッグ可能にする
    makeDraggable(panel) {
      let isDragging = false;
      let startX, startY, startLeft, startTop;

      // ドラッグ開始
      const startDrag = (e) => {
        // ドラッグハンドル内でのみドラッグを開始
        const dragHandle = panel.querySelector('#shima-drag-handle');
        if (!dragHandle || !dragHandle.contains(e.target)) {
          return;
        }

        // ボタン要素の場合はドラッグしない
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
          return;
        }
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(window.getComputedStyle(panel).left, 10);
        startTop = parseInt(window.getComputedStyle(panel).top, 10);

        const dragHandleEl = panel.querySelector('#shima-drag-handle');
        if (dragHandleEl) {
          dragHandleEl.style.cursor = 'grabbing';
        }
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        e.preventDefault();
      };

      // ドラッグ中
      const drag = (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        panel.style.left = (startLeft + dx) + 'px';
        panel.style.top = (startTop + dy) + 'px';
      };

      // ドラッグ終了
      const stopDrag = () => {
        isDragging = false;
        const dragHandleEl = panel.querySelector('#shima-drag-handle');
        if (dragHandleEl) {
          dragHandleEl.style.cursor = 'grab';
        }
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
      };

      // パネル全体にイベントリスナーを設定（但しドラッグハンドルのみでドラッグ開始）
      panel.addEventListener('mousedown', startDrag);
    }

    // パネルスタイル
    getPanelStyles() {
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const maxHeight = Math.min(windowHeight * 0.9, 800);
      const maxWidth = Math.min(windowWidth * 0.95, 1200);

      return `
        all: initial;
        position: fixed !important;
        top: 10px !important;
        left: 10px !important;
        width: ${maxWidth}px !important;
        height: ${maxHeight}px !important;
        min-width: 800px !important;
        min-height: 500px !important;
        background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
        border: 2px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} !important;
        box-shadow: ${SHAREPOINT_DESIGN_SYSTEM.SHADOWS.PANEL} !important;
        z-index: 2147483647 !important;
        font-family: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
        line-height: 1.4 !important;
        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
        display: flex !important;
        flex-direction: column !important;
        resize: both !important;
        overflow: hidden !important;
      `;
    }

    // UI HTML生成
    generateHTML() {
      const endpointsHTML = this.apiEndpoints.getEndpoints()
        .map(endpoint => `
          <div class="shima-api-endpoint" data-endpoint-id="${endpoint.id}"
               style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important; 
                      padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important; 
                      border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                      border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                      cursor: pointer !important; 
                      background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
                      transition: all ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;">
            <div style="font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important; 
                        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important; 
                        word-break: break-word !important;
                        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
              ${endpoint.title}
            </div>
            <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important; 
                        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important; 
                        margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important;
                        word-break: break-word !important;">
              ${endpoint.description}
            </div>
          </div>
        `).join('');

      return `
        ${this.generateHeaderHTML()}
        <div style="display: flex !important; flex: 1 !important; min-height: 0 !important;">
          ${this.generateSidebarHTML(endpointsHTML)}
          ${this.generateMainContentHTML()}
        </div>
      `;
    }    // ヘッダーHTML生成
    generateHeaderHTML() {
      return `
        <div id="shima-drag-handle" style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; 
             border-bottom: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important; 
             background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
             cursor: grab !important;" title="ここをドラッグしてパネルを移動できます">
          <div style="display: flex !important; justify-content: space-between !important; align-items: center !important;
                      flex-wrap: wrap !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <h3 style="margin: 0 !important; color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important; 
                       font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important; 
                       font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                       pointer-events: none !important;">
              🔌 SharePoint API Navigator
            </h3>
            <div style="display: flex !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important; 
                        align-items: center !important; flex-wrap: wrap !important;">
              <button id="shima-toggle-sidebar" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.MUTED} !important; 
                      color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                      border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                      padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                      cursor: pointer !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                      transition: all ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;">📱 メニュー</button>
              <button id="shima-close-api-navigator" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.DANGER} !important; 
                      color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                      border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                      padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                      cursor: pointer !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                      transition: all ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;">✕ 閉じる</button>
            </div>
          </div>
          <div style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important; 
                      font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important; 
                      color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                      word-break: break-all !important; pointer-events: none !important;">
            Site: <strong>${this.baseUrl}</strong>
          </div>
        </div>
      `;
    }

    // サイドバーHTML生成
    generateSidebarHTML(endpointsHTML) {
      return `
        <div id="shima-sidebar" style="width: 280px !important; min-width: 200px !important;
             border-right: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important; 
             background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important; 
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             overflow-y: auto !important; transition: margin-left ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.SLOW} !important;">
          <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} 0 !important; 
                     font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H4} !important; 
                     color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
                     font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
            API エンドポイント
          </h4>
          <div id="shima-api-endpoints">
            ${endpointsHTML}
          </div>
        </div>
      `;
    }

    // メインコンテンツHTML生成
    generateMainContentHTML() {
      return `
        <div style="flex: 1 !important; display: flex !important; flex-direction: column !important; min-width: 0 !important; min-height: 0 !important;">
          ${this.generateControlPanelHTML()}
          ${this.generateResultsAreaHTML()}
        </div>
      `;
    }
    // コントロールパネルHTML生成
    generateControlPanelHTML() {
      return `
        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important; 
                    border-bottom: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important; 
                    background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;">
          <div style="display: flex !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important; 
                      align-items: center !important; flex-wrap: wrap !important;">
            <button id="shima-execute-api" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.SUCCESS} !important; 
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                    padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                    cursor: pointer !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                    transition: all ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;" disabled>🚀 実行</button>
            <button id="shima-clear-results" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.MUTED} !important; 
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                    padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                    cursor: pointer !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                    transition: all ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;">🗑️ クリア</button>
            <button id="shima-back-to-main" style="display: none !important; 
                    background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.WARNING} !important; 
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                    padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                    cursor: pointer !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                    transition: all ${SHAREPOINT_DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;">← 戻る</button>
            <input type="text" id="shima-filter-input" placeholder="フィルター..."
                   style="border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important; 
                          border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                          padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                          font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important; 
                          min-width: 100px !important; flex: 1 !important; max-width: 200px !important;">
            <select id="shima-view-mode" style="border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important; 
                    border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                    padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important; 
                    font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;">
              <option value="table">テーブル表示</option>
              <option value="json">JSON表示</option>
            </select>            <!-- リスト操作メニュー - 実行メニューの右端に配置 -->
            <div id="shima-list-operations" style="display: none !important; flex-direction: column !important; align-items: flex-end !important;
                 background: rgba(40, 167, 69, 0.1) !important; padding: 6px 12px !important; border-radius: 4px !important;
                 border: 1px solid #28a745 !important; margin-left: auto !important;">
              <div style="display: flex !important; gap: 6px !important; align-items: center !important;">
                <span style="font-size: 11px !important; color: #28a745 !important; font-weight: bold !important;">📋 リスト操作:</span>
                <button id="shima-show-list-details" title="選択したリストの詳細情報を表示"
                        style="background: #007bff !important; color: white !important;
                        border: none !important; border-radius: 3px !important; padding: 4px 8px !important;
                        cursor: pointer !important; font-size: 10px !important;">📄 詳細</button>
                <button id="shima-show-list-fields" title="選択したリストのフィールド一覧を表示"
                        style="background: #17a2b8 !important; color: white !important;
                        border: none !important; border-radius: 3px !important; padding: 4px 8px !important;
                        cursor: pointer !important; font-size: 10px !important;">🔧 フィールド</button>
                <button id="shima-show-list-items" title="選択したリストのアイテム一覧を表示"
                        style="background: #28a745 !important; color: white !important;
                        border: none !important; border-radius: 3px !important; padding: 4px 8px !important;
                        cursor: pointer !important; font-size: 10px !important;">📋 アイテム</button>
              </div>
              <div style="margin-top: 4px !important; text-align: right !important; border-top: 1px solid rgba(40, 167, 69, 0.3) !important; padding-top: 4px !important;">
                <div style="font-size: 9px !important; color: #666 !important;">選択中のリスト:</div>
                <div id="shima-selected-list-name" style="font-size: 11px !important; color: #28a745 !important; font-weight: bold !important; max-width: 200px !important; word-break: break-word !important;">
                  リスト未選択
                </div>
              </div>
            </div>
          </div>
          <div id="shima-current-endpoint" style="margin-top: 8px !important; font-size: 11px !important;
               color: #666 !important; font-family: monospace !important; word-break: break-all !important;">
            エンドポイントを選択してください
          </div>
          <div id="shima-current-context" style="margin-top: 4px !important; font-size: 12px !important;
               color: #0078d4 !important; font-weight: bold !important; display: none !important;">
            📊 表示中: メインAPI結果
          </div>
        </div>
      `;
    }
    // 結果エリアHTML生成
    generateResultsAreaHTML() {
      return `
        <div id="shima-results-area" style="flex: 1 !important; display: flex !important; flex-direction: column !important;
             min-height: 0 !important; padding: 12px !important; padding-top: 0 !important;">
          <div style="text-align: center !important; color: #666 !important; padding: 40px !important;">
            📡 左側からAPIエンドポイントを選択すると自動的にAPIが実行されます。
          </div>
        </div>
      `;
    }    // テーブル作成
    createTable(data, endpoint) {
      if (!data || data.length === 0) {
        return '<div>データがありません</div>';
      }

      const sampleItem = data[0];
      const importantFields = Utils.getImportantFields(sampleItem, endpoint.id);

      let tableHtml = '<div style="flex: 1 !important; overflow: auto !important; border: 1px solid #ddd !important; border-radius: 4px !important; min-height: 0 !important;">';
      tableHtml += '<table style="width: 100% !important; border-collapse: collapse !important; font-size: 12px !important; min-width: 800px !important;">';

      // ヘッダー
      tableHtml += '<thead><tr style="background: #f8f9fa !important; position: sticky !important; top: 0 !important; z-index: 10 !important;">';
      importantFields.forEach(field => {
        let fieldTitle = Utils.escapeHtml(field);
        let helpText = '';

        // IDフィールドにヘルプテキストを追加
        if (field === 'Id') {
          helpText = ' (SharePoint内部識別子)';
          fieldTitle = `<span title="SharePointで自動生成される一意の識別子です">${fieldTitle}</span>`;
        }

        tableHtml += `<th style="border: 1px solid #ddd !important; padding: 8px !important; text-align: left !important;
                        font-weight: bold !important; white-space: nowrap !important; background: #f8f9fa !important;">
                        ${fieldTitle}${helpText}</th>`;
      });
      tableHtml += '</tr></thead>';

      // データ行
      tableHtml += '<tbody>';
      data.forEach((item, index) => {
        const rowStyle = index % 2 === 0 ? 'background: white !important;' : 'background: #f9f9f9 !important;';
        tableHtml += `<tr style="${rowStyle} cursor: pointer !important; transition: background-color 0.2s ease !important;"
                      data-row-index="${index}"
                      onmouseover="this.style.backgroundColor='rgba(0, 123, 255, 0.05)'"
                      onmouseout="this.style.backgroundColor='${index % 2 === 0 ? 'white' : '#f9f9f9'}'">`;

        importantFields.forEach(field => {
          const value = Utils.getNestedValue(item, field);
          const displayValue = Utils.formatValue(value, field);
          const cellWidth = ['Title', 'Name', 'Description'].includes(field)
            ? 'min-width: 200px !important;'
            : 'min-width: 120px !important;';

          tableHtml += `<td style="border: 1px solid #ddd !important; padding: 8px !important;
                        max-width: ${CONFIG.MAX_CELL_LENGTH}px !important; overflow: hidden !important;
                        text-overflow: ellipsis !important; white-space: nowrap !important; ${cellWidth}"
                        title="${Utils.escapeHtml(String(value))}">${displayValue}</td>`;
        });

        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table></div>';

      return tableHtml;
    }
  }
  // API 管理クラス
  class ApiManager {
    constructor(apiEndpoints) {
      this.apiEndpoints = apiEndpoints;
      this.mainResults = null; // メインの結果を保存
      this.currentContext = 'main'; // 現在の表示コンテキスト
      this.selectedListId = null;
      this.selectedListTitle = null;
    }

    // API実行
    async executeApi(endpoint) {
      const resultsArea = document.getElementById('shima-results-area');
      const executeBtn = document.getElementById('shima-execute-api');

      try {
        // ローディング表示
        this.setLoadingState(executeBtn, resultsArea);

        const response = await fetch(`${endpoint.url}?$select=*`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose'
          },
          credentials: 'same-origin'
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.displayResults(data, endpoint, resultsArea);
        this.saveResults(data);

      } catch (error) {
        this.displayError(error, resultsArea);
      } finally {
        this.resetLoadingState(executeBtn);
      }
    }

    // ローディング状態設定
    setLoadingState(executeBtn, resultsArea) {
      executeBtn.disabled = true;
      executeBtn.textContent = '⏳ 実行中...';
      resultsArea.innerHTML = '<div style="text-align: center !important; padding: 40px !important;">⏳ API実行中...</div>';
    }

    // ローディング状態リセット
    resetLoadingState(executeBtn) {
      executeBtn.disabled = false;
      executeBtn.textContent = '🚀 実行';
    }

    // 結果表示
    displayResults(data, endpoint, resultsArea) {
      const viewMode = document.getElementById('shima-view-mode').value;
      const filterText = document.getElementById('shima-filter-input').value.toLowerCase();

      if (viewMode === 'json') {
        this.displayJsonResults(data, resultsArea);
        return;
      }

      this.displayTableResults(data, endpoint, resultsArea, filterText);
    }

    // JSON結果表示
    displayJsonResults(data, resultsArea) {
      resultsArea.innerHTML = `
        <div style="flex: 1 !important; overflow: auto !important; min-height: 0 !important;">
          <pre style="background: #f8f9fa !important; padding: 12px !important; border-radius: 4px !important;
               overflow: auto !important; font-size: 11px !important; white-space: pre-wrap !important;
               word-break: break-word !important; margin: 0 !important; height: 100% !important;">
            ${Utils.escapeHtml(JSON.stringify(data, null, 2))}
          </pre>
        </div>
      `;

      // 結果エリアのスタイルを調整
      resultsArea.style.display = 'flex';
      resultsArea.style.flexDirection = 'column';
      resultsArea.style.minHeight = '0';
    }

    // テーブル結果表示
    displayTableResults(data, endpoint, resultsArea, filterText) {
      let results = data.d ? (data.d.results || [data.d]) : [data];
      if (!Array.isArray(results)) {
        results = [results];
      }

      // フィルタリング
      if (filterText) {
        results = results.filter(item =>
          JSON.stringify(item).toLowerCase().includes(filterText)
        );
      }

      if (results.length === 0) {
        resultsArea.innerHTML = `
          <div style="text-align: center !important; color: #666 !important; padding: 40px !important;">
            📄 データが見つかりませんでした
          </div>
        `;
        return;
      }

      const uiManager = new UIManager('', this.apiEndpoints);
      const table = uiManager.createTable(results, endpoint);

      resultsArea.innerHTML = `
        <div style="margin-bottom: 12px !important; font-size: 12px !important; color: #666 !important;">
          ${results.length} 件の結果
        </div>
        ${table}
      `;

      // 結果エリアのスタイルを調整
      resultsArea.style.display = 'flex';
      resultsArea.style.flexDirection = 'column';
      resultsArea.style.minHeight = '0';

      // コンテキスト管理
      this.updateContext(endpoint);

      // Lists APIの場合、リスト操作を表示し、追加機能を提供
      if (endpoint.id === 'lists') {
        this.mainResults = results; // メイン結果を保存
        this.showListOperations();
        this.setupListSelection(resultsArea, results);
      } else if (endpoint.id.startsWith('list-')) {
        // リスト詳細の場合、戻るボタンを表示
        this.showBackButton();
        this.hideListOperations();
      } else {
        this.hideListOperations();
        this.hideBackButton();
      }
    }

    // エラー表示
    displayError(error, resultsArea) {
      resultsArea.innerHTML = `
        <div style="color: #dc3545 !important; padding: 20px !important; background: #f8d7da !important;
             border: 1px solid #f5c6cb !important; border-radius: 4px !important;">
          ❌ エラー: ${Utils.escapeHtml(error.message)}
        </div>
      `;
    }

    // 結果保存
    saveResults(data) {
      const results = data.d ? (data.d.results || [data.d]) : [data];
      Utils.saveToStorage(CONFIG.STORAGE_KEY, results);
    }    // リスト選択機能設定（簡易版）
    setupListSelection(resultsArea, results) {
      let selectedListId = null;
      let selectedListTitle = null;

      const tableRows = resultsArea.querySelectorAll('tbody tr');
      tableRows.forEach((row, index) => {
        row.addEventListener('click', () => {
          // 既存の選択を解除
          tableRows.forEach(r => {
            r.style.backgroundColor = '';
            r.classList.remove('shima-selected-row');
          });

          // 新しい選択を設定
          row.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
          row.classList.add('shima-selected-row'); if (results[index]) {
            this.selectedListId = results[index].Id;
            this.selectedListTitle = results[index].Title;

            // 選択されたリスト名を更新
            this.updateSelectedListName(this.selectedListTitle);
          }
        });
      });      // コントロールパネルのボタンイベント設定
      this.setupControlPanelListButtons();
    }

    // コントロールパネルのリストボタン設定
    setupControlPanelListButtons() {
      const detailsBtn = document.getElementById('shima-show-list-details');
      const fieldsBtn = document.getElementById('shima-show-list-fields');
      const itemsBtn = document.getElementById('shima-show-list-items');

      if (detailsBtn) {
        detailsBtn.addEventListener('click', () => {
          if (!this.selectedListId) {
            alert('リストを選択してください。テーブル行をクリックしてリストを選択してから実行してください。');
            return;
          }
          const endpoint = this.apiEndpoints.createListDetailEndpoint(this.selectedListId, this.selectedListTitle);
          this.executeApi(endpoint);
        });
      }

      if (fieldsBtn) {
        fieldsBtn.addEventListener('click', () => {
          if (!this.selectedListId) {
            alert('リストを選択してください。テーブル行をクリックしてリストを選択してから実行してください。');
            return;
          }
          const endpoint = this.apiEndpoints.createListFieldsEndpoint(this.selectedListId, this.selectedListTitle);
          this.executeApi(endpoint);
        });
      } if (itemsBtn) {
        itemsBtn.addEventListener('click', () => {
          if (!this.selectedListId) {
            alert('リストを選択してください。テーブル行をクリックしてリストを選択してから実行してください。');
            return;
          }
          const endpoint = this.apiEndpoints.createListItemsEndpoint(this.selectedListId, this.selectedListTitle);
          this.executeApi(endpoint);
        });
      }
    }

    // コンテキスト更新
    updateContext(endpoint) {
      const contextDiv = document.getElementById('shima-current-context');
      if (contextDiv) {
        contextDiv.style.display = 'block';
        if (endpoint.id.startsWith('list-')) {
          contextDiv.innerHTML = `📊 表示中: ${endpoint.title}`;
        } else {
          contextDiv.innerHTML = `📊 表示中: ${endpoint.title} (${endpoint.description})`;
        }
      }
    }

    // 戻るボタン表示
    showBackButton() {
      const backBtn = document.getElementById('shima-back-to-main');
      if (backBtn) {
        backBtn.style.display = 'inline-block';
      }
    }

    // 戻るボタン非表示
    hideBackButton() {
      const backBtn = document.getElementById('shima-back-to-main');
      if (backBtn) {
        backBtn.style.display = 'none';
      }
    }

    // メイン結果に戻る
    backToMainResults() {
      if (this.mainResults) {
        const resultsArea = document.getElementById('shima-results-area');
        const endpoint = { id: 'lists', title: 'Lists', description: 'サイト内のリスト一覧' };

        const uiManager = new UIManager('', this.apiEndpoints);
        const table = uiManager.createTable(this.mainResults, endpoint); resultsArea.innerHTML = `
          <div style="margin-bottom: 12px !important; font-size: 12px !important; color: #666 !important;">
            ${this.mainResults.length} 件の結果
          </div>
          <div style="flex: 1 !important; overflow: hidden !important;">
            ${table}
          </div>
        `;

        this.showListOperations();
        this.hideBackButton();
        this.setupListSelection(resultsArea, this.mainResults);
        this.updateContext(endpoint);
      }
    }

    // リスト操作表示
    showListOperations() {
      const listOpsDiv = document.getElementById('shima-list-operations');
      if (listOpsDiv) {
        listOpsDiv.style.display = 'flex';
      }
    }

    // リスト操作非表示
    hideListOperations() {
      const listOpsDiv = document.getElementById('shima-list-operations');
      if (listOpsDiv) {
        listOpsDiv.style.display = 'none';
      }
    }

    // 選択されたリスト名を更新
    updateSelectedListName(listTitle) {
      const nameSpan = document.getElementById('shima-selected-list-name');
      if (nameSpan) {
        nameSpan.textContent = listTitle || 'リスト未選択';
      }
    }
  }

  // イベントハンドラー管理
  class EventManager {
    constructor(apiManager, uiManager, apiEndpoints) {
      this.apiManager = apiManager;
      this.uiManager = uiManager;
      this.apiEndpoints = apiEndpoints;
      this.currentSelectedEndpoint = null;
    }    // イベントリスナー設定
    setupEventListeners() {
      this.setupCloseButton();
      this.setupSidebarToggle();
      this.setupExecuteButton();
      this.setupClearButton();
      this.setupBackButton();
      this.setupFilterInput();
      this.setupViewModeChange();
      this.setupEndpointSelection();
      this.setupResize();
    }

    // 閉じるボタン
    setupCloseButton() {
      const closeBtn = document.getElementById('shima-close-api-navigator');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.uiManager.panel.remove();
        });
      } else {
        console.warn('閉じるボタンが見つかりません');
      }
    }

    // サイドバー切り替え
    setupSidebarToggle() {
      const toggleBtn = document.getElementById('shima-toggle-sidebar');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          const sidebar = document.getElementById('shima-sidebar');
          if (sidebar) {
            const isHidden = sidebar.style.marginLeft === '-280px';

            if (isHidden) {
              sidebar.style.marginLeft = '0';
              this.textContent = '📱 拡大';
            } else {
              sidebar.style.marginLeft = '-280px';
              this.textContent = '📱 メニュー';
            }
          }
        });
      } else {
        console.warn('サイドバー切り替えボタンが見つかりません');
      }
    }

    // 実行ボタン
    setupExecuteButton() {
      const executeBtn = document.getElementById('shima-execute-api');
      if (executeBtn) {
        executeBtn.addEventListener('click', () => {
          if (this.currentSelectedEndpoint) {
            this.apiManager.executeApi(this.currentSelectedEndpoint);
          }
        });
      } else {
        console.warn('実行ボタンが見つかりません');
      }
    }    // クリアボタン
    setupClearButton() {
      const clearBtn = document.getElementById('shima-clear-results');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          const resultsArea = document.getElementById('shima-results-area');
          const filterInput = document.getElementById('shima-filter-input');
          const contextDiv = document.getElementById('shima-current-context');

          if (resultsArea) {
            resultsArea.innerHTML =
              '<div style="text-align: center !important; color: #666 !important; padding: 40px !important;">' +
              '📡 左側からAPIエンドポイントを選択し、「実行」ボタンでAPIを呼び出してください。</div>';
          }

          if (filterInput) {
            filterInput.value = '';
          }

          if (contextDiv) {
            contextDiv.style.display = 'none';
          }

          // API Manager の状態をリセット
          this.apiManager.mainResults = null;
          this.apiManager.selectedListId = null;
          this.apiManager.selectedListTitle = null;
          this.apiManager.currentContext = 'main';
          this.apiManager.hideListOperations();
          this.apiManager.hideBackButton();
          this.apiManager.updateSelectedListName('');
        });
      } else {
        console.warn('クリアボタンが見つかりません');
      }
    }

    // 戻るボタン
    setupBackButton() {
      const backBtn = document.getElementById('shima-back-to-main');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          this.apiManager.backToMainResults();
        });
      } else {
        console.warn('戻るボタンが見つかりません');
      }
    }    // フィルター入力
    setupFilterInput() {
      const filterInput = document.getElementById('shima-filter-input');
      if (filterInput) {
        let debounceTimer;
        filterInput.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this.applyTableFilter();
          }, 300); // 300ms のデバウンス
        });
      } else {
        console.warn('フィルター入力が見つかりません');
      }
    }

    // テーブルフィルター適用
    applyTableFilter() {
      const filterInput = document.getElementById('shima-filter-input');
      const filterText = filterInput ? filterInput.value.toLowerCase() : '';
      const table = document.querySelector('#shima-results-area table');

      if (!table) return;

      const rows = table.querySelectorAll('tbody tr');
      let visibleCount = 0;

      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(filterText)) {
          row.style.display = '';
          visibleCount++;
        } else {
          row.style.display = 'none';
        }
      });

      // 結果カウントを更新
      const countDiv = document.querySelector('#shima-results-area > div:first-child');
      if (countDiv && countDiv.textContent.includes('件の結果')) {
        if (filterText) {
          countDiv.textContent = `${visibleCount} 件の結果 (フィルター適用中)`;
        } else {
          countDiv.textContent = `${rows.length} 件の結果`;
        }
      }
    }

    // 表示モード変更
    setupViewModeChange() {
      const viewModeSelect = document.getElementById('shima-view-mode');
      if (viewModeSelect) {
        viewModeSelect.addEventListener('change', () => {
          if (this.currentSelectedEndpoint) {
            this.apiManager.executeApi(this.currentSelectedEndpoint);
          }
        });
      } else {
        console.warn('表示モード選択が見つかりません');
      }
    }

    // エンドポイント選択
    setupEndpointSelection() {
      const endpointElements = document.querySelectorAll('.shima-api-endpoint');
      if (endpointElements.length > 0) {
        endpointElements.forEach(element => {
          element.addEventListener('click', () => {
            // 既存の選択を解除
            endpointElements.forEach(el => {
              el.classList.remove('selected');
              el.style.background = 'white';
              el.style.borderColor = '#ddd';
            });

            // 新しい選択を設定
            element.classList.add('selected');
            element.style.background = '#e3f2fd';
            element.style.borderColor = '#0078d4';

            // 実行ボタンを有効化
            const executeBtn = document.getElementById('shima-execute-api');
            if (executeBtn) {
              executeBtn.disabled = false;
            }

            // 現在のエンドポイントを保存
            const endpointId = element.getAttribute('data-endpoint-id');
            this.currentSelectedEndpoint = this.apiEndpoints.getEndpoints()
              .find(e => e.id === endpointId);

            // 現在のエンドポイント表示を更新
            if (this.currentSelectedEndpoint) {
              const currentEndpointDiv = document.getElementById('shima-current-endpoint');
              if (currentEndpointDiv) {
                currentEndpointDiv.textContent = this.currentSelectedEndpoint.url;
              }

              // エンドポイント選択時に自動実行
              this.apiManager.executeApi(this.currentSelectedEndpoint);
            }
          });
        });
      } else {
        console.warn('APIエンドポイント要素が見つかりました');
      }
    }

    // リサイズ処理
    setupResize() {
      const handleResize = () => {
        const panel = document.getElementById(CONFIG.PANEL_ID);
        const sidebar = document.getElementById('shima-sidebar');
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const toggleBtn = document.getElementById('shima-toggle-sidebar');

        // パネルの高さをウィンドウサイズに合わせて調整
        if (panel) {
          const maxHeight = Math.min(windowHeight * 0.9, 800);
          const maxWidth = Math.min(windowWidth * 0.95, 1200);

          // パネルサイズが最大値を超えている場合は調整
          const currentHeight = panel.offsetHeight;
          const currentWidth = panel.offsetWidth;

          if (currentHeight > maxHeight) {
            panel.style.height = maxHeight + 'px';
          }
          if (currentWidth > maxWidth) {
            panel.style.width = maxWidth + 'px';
          }

          // パネルが画面外に出ている場合は位置を調整
          const rect = panel.getBoundingClientRect();
          if (rect.bottom > windowHeight) {
            panel.style.top = Math.max(10, windowHeight - panel.offsetHeight - 10) + 'px';
          }
          if (rect.right > windowWidth) {
            panel.style.left = Math.max(10, windowWidth - panel.offsetWidth - 10) + 'px';
          }
        }

        // サイドバーの表示制御
        if (windowWidth < 768) {
          // モバイルサイズの場合、サイドバーを初期状態で隠す
          if (sidebar) sidebar.style.marginLeft = '-280px';
          if (toggleBtn) toggleBtn.textContent = '📱 メニュー';
        } else {
          // デスクトップサイズの場合、サイドバーを表示
          if (sidebar) sidebar.style.marginLeft = '0';
          if (toggleBtn) toggleBtn.textContent = '📅 拡大';
        }
      };

      // 初期サイズ調整
      handleResize();
      // ウィンドウリサイズ時の処理
      window.addEventListener('resize', handleResize);
    }
  }

  // メインアプリケーションクラス
  class SharePointApiNavigator {
    constructor() {
      this.baseUrl = '';
      this.apiBaseUrl = '';
    }

    // 初期化
    init() {
      try {
        if (this.checkExistingPanel()) return;
        if (!this.validateSharePointSite()) return;

        this.setupUrls();
        this.createApplication();
      } catch (error) {
        console.error('SharePoint API Navigator初期化エラー:', error);
        alert('アプリケーションの初期化に失敗しました: ' + error.message);
      }
    }

    // 既存パネルのチェック
    checkExistingPanel() {
      const existingPanel = document.getElementById(CONFIG.PANEL_ID);
      if (existingPanel) {
        existingPanel.remove();
        return true;
      }
      return false;
    }

    // SharePoint サイトの検証
    validateSharePointSite() {
      const currentUrl = window.location.href;
      const sharepointMatch = currentUrl.match(/^(https?:\/\/[^\/]+)\/sites\/([^\/]+)/);

      if (!sharepointMatch) {
        alert('このブックマークレットはSharePointサイトでのみ動作します。');
        return false;
      }

      this.sharepointMatch = sharepointMatch;
      return true;
    }

    // URL設定
    setupUrls() {
      const [, domain, siteName] = this.sharepointMatch;
      const currentUrl = window.location.href;

      // Child Site の判別
      const fullMatch = currentUrl.match(/^(https?:\/\/[^\/]+)\/sites\/([^\/]+)\/([^\/]+)/);
      const isChildSite = fullMatch && fullMatch[3] &&
        !['pages', 'Lists', 'Shared%20Documents'].includes(fullMatch[3]) &&
        !fullMatch[3].startsWith('_layouts');

      this.baseUrl = isChildSite
        ? `${domain}/sites/${siteName}/${fullMatch[3]}`
        : `${domain}/sites/${siteName}`;

      this.apiBaseUrl = `${this.baseUrl}/_api`;
    }

    // アプリケーション作成
    createApplication() {
      const apiEndpoints = new ApiEndpoints(this.apiBaseUrl);
      const uiManager = new UIManager(this.baseUrl, apiEndpoints);
      const apiManager = new ApiManager(apiEndpoints);
      const eventManager = new EventManager(apiManager, uiManager, apiEndpoints);

      // UI作成
      const panel = uiManager.createPanel();
      panel.innerHTML = uiManager.generateHTML();

      // ページに追加（イベント設定前に）
      document.body.appendChild(panel);

      // DOM要素が追加された後にイベント設定
      // 少し遅延を入れてDOM要素の準備を確実にする
      setTimeout(() => {
        try {
          eventManager.setupEventListeners();
          // 共通スタイルを追加
          this.addCommonStyles();
        } catch (error) {
          console.error('イベントリスナー設定エラー:', error);
          alert('イベントリスナーの設定に失敗しました: ' + error.message);
        }
      }, 10);
    }

    // 共通スタイルを追加
    addCommonStyles() {
      const style = document.createElement('style');
      style.textContent = `
        #${CONFIG.PANEL_ID} .shima-api-endpoint:hover {
          background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
          border-color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
        }

        #${CONFIG.PANEL_ID} button:hover:not(:disabled) {
          opacity: 0.9 !important;
          transform: translateY(-1px) !important;
        }

        #${CONFIG.PANEL_ID} button:active:not(:disabled) {
          transform: translateY(0) !important;
        }

        #${CONFIG.PANEL_ID} *::-webkit-scrollbar {
          width: 8px !important;
        }

        #${CONFIG.PANEL_ID} *::-webkit-scrollbar-track {
          background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
        }

        #${CONFIG.PANEL_ID} *::-webkit-scrollbar-thumb {
          background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
          border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
        }

        #${CONFIG.PANEL_ID} *::-webkit-scrollbar-thumb:hover {
          background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.MUTED} !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // アプリケーション実行
  const app = new SharePointApiNavigator();
  app.init();

})();
