/**
 * Microsoft Lists Column Formatter Bookmarklet
 * Microsoft Lists の JSON 列書式設定支援ツール
 *
 * 機能:
 * - 既存の Lists から JSON 列書式を取得
 * - 書式を他の Lists に適用（列名変更可能）
 * - 書式の保存・管理・共有
 * - クリップボード経由での書式共有
 */

javascript: (() => {
  'use strict';

  // =============================================================================
  // Memory Manager の読み込み
  // =============================================================================
  // MemoryManager クラスが利用できない場合は読み込む
  if (typeof MemoryManager === 'undefined') {
    // MemoryManager のロード用スクリプト
    const script = document.createElement('script');
    script.src =
      'https://cdn.jsdelivr.net/gh/shimabukuromeg/bookmarklet-gallery@main/bookmarklets/src/memory-manager.js';
    script.onerror = () => {
      console.warn('MemoryManager の読み込みに失敗。基本機能で動作します。');
      window.MemoryManager = class {
        addEventListener(el, type, handler, opts) {
          el.addEventListener(type, handler, opts);
        }
        removeEventListener(el, type, handler, opts) {
          el.removeEventListener(type, handler, opts);
        }
        setInterval(cb, delay) {
          return setInterval(cb, delay);
        }
        setTimeout(cb, delay) {
          return setTimeout(cb, delay);
        }
        clearInterval(id) {
          clearInterval(id);
        }
        clearTimeout(id) {
          clearTimeout(id);
        }
        cleanup() {}
      };
    };
    document.head.appendChild(script);
  }

  // Memory Manager インスタンス
  const memoryManager = new MemoryManager({
    debugMode: false,
    enableWarnings: true,
  });

  // =============================================================================
  // 定数定義
  // =============================================================================
  const CONSTANTS = {
    PANEL_ID: 'lists-formatter-panel',
    STORAGE_KEY: 'lists-column-formats',
    Z_INDEX: 999999,
    PANEL_WIDTH: 400,
    PANEL_HEIGHT: 600,
  };

  // SharePoint デザインシステム
  const SHAREPOINT_DESIGN_SYSTEM = {
    COLORS: {
      PRIMARY: '#0078d4',
      BACKGROUND: {
        PRIMARY: '#ffffff',
        SECONDARY: '#f8f9fa',
        TERTIARY: '#f3f2f1',
      },
      TEXT: {
        PRIMARY: '#323130',
        SECONDARY: '#605e5c',
        MUTED: '#8a8886',
        INVERSE: '#ffffff',
      },
      BORDER: {
        DEFAULT: '#edebe9',
        FOCUS: '#0078d4',
      },
      STATUS: {
        SUCCESS: '#107c10',
        WARNING: '#ffaa44',
        ERROR: '#d13438',
        INFO: '#0078d4',
      },
    },
    TYPOGRAPHY: {
      FONT_FAMILY: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Segoe UI Web Regular', 'Segoe UI Symbol', 'Helvetica Neue', Arial, sans-serif`,
      SIZES: {
        H1: '20px',
        H2: '18px',
        H3: '16px',
        H4: '14px',
        BODY: '14px',
        CAPTION: '12px',
        SMALL: '11px',
      },
      WEIGHTS: {
        NORMAL: '400',
        MEDIUM: '500',
        SEMIBOLD: '600',
        BOLD: '700',
      },
    },
    SPACING: {
      XS: '4px',
      SM: '8px',
      MD: '12px',
      LG: '16px',
      XL: '24px',
    },
    BORDER_RADIUS: {
      SM: '2px',
      MD: '4px',
      LG: '6px',
      XL: '8px',
    },
    SHADOWS: {
      PANEL: '0 8px 16px rgba(0, 0, 0, 0.14), 0 0 2px rgba(0, 0, 0, 0.12)',
    },
  };

  // =============================================================================
  // ユーティリティクラス
  // =============================================================================
  class Utils {
    // HTML エスケープ
    static escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // 現在のサイト情報を取得
    static getSiteInfo() {
      const url = window.location.href;
      const hostname = window.location.hostname;

      // SharePoint Online または SharePoint Server の判定
      const isSharePointOnline = hostname.includes('.sharepoint.com');
      const isSharePointServer =
        document.querySelector('[data-automation-id="siteLogo"]') ||
        document.querySelector('.ms-siteHeader-siteName') ||
        url.includes('/_layouts/');

      if (!isSharePointOnline && !isSharePointServer) {
        return null;
      }

      // ベースURLの取得
      let baseUrl = window.location.origin;
      const pathParts = window.location.pathname.split('/').filter(p => p);

      if (isSharePointOnline) {
        // SharePoint Online: /sites/sitename または /teams/teamname 形式
        if (pathParts.length >= 2 && (pathParts[0] === 'sites' || pathParts[0] === 'teams')) {
          baseUrl += `/${pathParts[0]}/${pathParts[1]}`;
        }
      } else {
        // SharePoint Server: サイトパスを推定
        const sitePath = pathParts.slice(0, -1).join('/');
        if (sitePath) {
          baseUrl += `/${sitePath}`;
        }
      }

      return {
        baseUrl,
        isSharePointOnline,
        isSharePointServer,
        currentUrl: url,
      };
    }

    // Lists ページかどうかを判定
    static isListsPage() {
      const url = window.location.href;
      return (
        url.includes('/lists/') ||
        url.includes('?env=WebViewList') ||
        document.querySelector('[data-automation-id="ColumnHeader"]') ||
        document.querySelector('.ms-List-page')
      );
    }

    // 現在のリスト情報を取得
    static getCurrentListInfo() {
      // リスト名を取得（複数の方法で試行）
      let listTitle = '';

      // Method 1: ページタイトルから
      const title = document.title;
      if (title && !title.includes('SharePoint')) {
        listTitle = title.split(' - ')[0];
      }

      // Method 2: ヘッダーから
      if (!listTitle) {
        const headerElement =
          document.querySelector('[data-automation-id="pageHeader"] h1') ||
          document.querySelector('.ms-List-page h1') ||
          document.querySelector('h1');
        if (headerElement) {
          listTitle = headerElement.textContent.trim();
        }
      }

      // Method 3: URLから推定
      if (!listTitle) {
        const match = window.location.pathname.match(/\/lists\/([^\/]+)/);
        if (match) {
          listTitle = decodeURIComponent(match[1]).replace(/\+/g, ' ');
        }
      }

      return {
        title: listTitle,
        url: window.location.href,
      };
    }

    // ローカルストレージから書式データを取得
    static getSavedFormats() {
      try {
        const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch (error) {
        console.warn('保存された書式の取得に失敗:', error);
        return [];
      }
    }

    // ローカルストレージに書式データを保存
    static saveFormats(formats) {
      try {
        localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(formats));
        return true;
      } catch (error) {
        console.error('書式の保存に失敗:', error);
        return false;
      }
    }

    // 現在の日時を文字列で取得
    static getCurrentTimestamp() {
      return new Date().toLocaleString('ja-JP');
    }
  }

  // =============================================================================
  // 列書式管理クラス
  // =============================================================================
  class ColumnFormatManager {
    constructor() {
      this.formats = Utils.getSavedFormats();
    }

    // 書式を保存
    saveFormat(formatData) {
      const newFormat = {
        id: Date.now().toString(),
        name: formatData.name,
        description: formatData.description || '',
        columnType: formatData.columnType,
        formatJson: formatData.formatJson,
        sourceList: formatData.sourceList || '',
        sourceColumn: formatData.sourceColumn || '',
        createdAt: Utils.getCurrentTimestamp(),
      };

      this.formats.unshift(newFormat);

      // 最大50件まで保持
      if (this.formats.length > 50) {
        this.formats = this.formats.slice(0, 50);
      }

      Utils.saveFormats(this.formats);
      return newFormat;
    }

    // 書式を削除
    deleteFormat(formatId) {
      this.formats = this.formats.filter(f => f.id !== formatId);
      Utils.saveFormats(this.formats);
    }

    // 書式を更新
    updateFormat(formatId, updates) {
      try {
        const formatIndex = this.formats.findIndex(f => f.id === formatId);
        if (formatIndex === -1) {
          return false;
        }

        // 更新可能なフィールドのみを更新
        const allowedFields = ['name', 'description'];
        const updatedFormat = { ...this.formats[formatIndex] };

        for (const [key, value] of Object.entries(updates)) {
          if (allowedFields.includes(key)) {
            updatedFormat[key] = value;
          }
        }

        this.formats[formatIndex] = updatedFormat;
        Utils.saveFormats(this.formats);
        return true;
      } catch (error) {
        console.error('書式の更新に失敗:', error);
        return false;
      }
    }

    // 書式を取得
    getFormat(formatId) {
      return this.formats.find(f => f.id === formatId);
    }

    // 全書式を取得
    getAllFormats() {
      return this.formats;
    }

    // 書式をクリップボードにコピー
    async copyFormatToClipboard(formatId) {
      const format = this.getFormat(formatId);
      if (!format) return false;

      const exportData = {
        name: format.name,
        description: format.description,
        columnType: format.columnType,
        formatJson: format.formatJson,
        exportedAt: Utils.getCurrentTimestamp(),
        exportedFrom: 'Microsoft Lists Column Formatter',
      };

      try {
        await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
        return true;
      } catch (error) {
        console.error('クリップボードへのコピーに失敗:', error);
        return false;
      }
    }

    // クリップボードから書式をインポート
    async importFormatFromClipboard() {
      try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text); // 内部書式形式（メタデータ付き）の場合
        if (data.formatJson && data.name) {
          const originalColumnType = data.columnType || 'Unknown';
          const normalizedType = ColumnFormatManager.normalizeColumnType(originalColumnType);

          const importedFormat = {
            name: `${data.name} (インポート)`,
            description: data.description || '',
            columnType: normalizedType,
            formatJson: data.formatJson,
            sourceList: 'インポート',
            sourceColumn: '',
          };

          return this.saveFormat(importedFormat);
        }

        // 純粋なJSON列書式（Microsoft公式スキーマ）の場合
        if (this.isValidColumnFormat(data)) {
          const timestamp = new Date().toLocaleString('ja-JP');
          const importedFormat = {
            name: `列書式 (${timestamp})`,
            description: 'クリップボードからインポートされた列書式',
            columnType: 'Generic', // インポート書式は汎用タイプとして扱う
            formatJson: data,
            sourceList: 'インポート',
            sourceColumn: '',
          };

          return this.saveFormat(importedFormat);
        }

        return null;
      } catch (error) {
        console.error('クリップボードからのインポートに失敗:', error);
        return null;
      }
    }

    // JSON列書式の妥当性チェック
    isValidColumnFormat(data) {
      // Microsoft Lists列書式の基本構造をチェック
      return (
        typeof data === 'object' &&
        data !== null &&
        (data.elmType || data.$schema || data.txtContent || data.style)
      );
    }

    // SharePointの列タイプを正規化（API由来の正確な型情報用）
    static normalizeColumnType(typeAsString) {
      if (!typeAsString) return 'Unknown';

      // SharePoint内部タイプを一般的な表示名に正規化
      const typeMapping = {
        Text: 'Text',
        Note: 'Text', // 複数行テキスト
        Number: 'Number',
        DateTime: 'DateTime',
        Boolean: 'Boolean',
        Choice: 'Choice',
        MultiChoice: 'Choice',
        Lookup: 'Lookup',
        LookupMulti: 'Lookup',
        User: 'Person', // User は Person として表示
        UserMulti: 'Person',
        URL: 'URL',
        Currency: 'Number',
        Integer: 'Number',
        Counter: 'Number',
        Guid: 'Text',
        File: 'File',
        Attachments: 'File',
        Calculated: 'Calculated',
        Threading: 'Text',
        GridChoice: 'Choice',
        Computed: 'Calculated',
        TaxonomyFieldType: 'Taxonomy',
        TaxonomyFieldTypeMulti: 'Taxonomy',
      };

      return typeMapping[typeAsString] || typeAsString;
    }
  }

  // =============================================================================
  // SharePoint API クライアント
  // =============================================================================
  class SharePointApiClient {
    constructor(siteInfo) {
      this.siteInfo = siteInfo;
      this.apiBaseUrl = `${siteInfo.baseUrl}/_api`;
    }

    // リスト一覧を取得
    async getLists() {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/web/lists?$select=Id,Title,BaseType&$filter=Hidden eq false`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.d.results.filter(list => list.BaseType === 0); // GenericList のみ
      } catch (error) {
        console.error('リスト取得エラー:', error);
        return [];
      }
    }

    // リストの列情報を取得
    async getListFields(listId) {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields?$select=Id,Title,InternalName,TypeAsString,SchemaXml&$filter=Hidden eq false and ReadOnlyField eq false`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.d.results;
      } catch (error) {
        console.error('列情報取得エラー:', error);
        return [];
      }
    }

    // デフォルトビューで表示される列のみを取得
    async getDefaultViewFields(listId) {
      try {
        // まずデフォルトビューを取得
        const viewResponse = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/defaultView?$select=Id,Title,ViewFields&$expand=ViewFields`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!viewResponse.ok) {
          throw new Error(`HTTP ${viewResponse.status}`);
        }

        const viewData = await viewResponse.json();
        const defaultView = viewData.d;

        if (!defaultView.ViewFields || !defaultView.ViewFields.Items) {
          // ViewFieldsが取得できない場合は全列を返す
          return await this.getListFields(listId);
        }

        const viewFieldNames = defaultView.ViewFields.Items;

        // ビューで表示される列の詳細情報を取得
        const fieldsResponse = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields?$select=Id,Title,InternalName,TypeAsString,SchemaXml&$filter=Hidden eq false`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!fieldsResponse.ok) {
          throw new Error(`HTTP ${fieldsResponse.status}`);
        }

        const fieldsData = await fieldsResponse.json();
        const allFields = fieldsData.d.results;

        // ビューに表示される列のみをフィルタリング
        const viewFields = allFields.filter(
          field => viewFieldNames.includes(field.InternalName) && !field.ReadOnlyField // 読み取り専用列は除外
        );

        // ビュー情報も含めて返す
        return {
          viewTitle: defaultView.Title,
          viewId: defaultView.Id,
          fields: viewFields,
          viewFieldCount: viewFieldNames.length,
          totalFieldCount: allFields.length,
        };
      } catch (error) {
        console.error('デフォルトビュー列取得エラー:', error);
        // エラーの場合は従来の方法にフォールバック
        const fallbackFields = await this.getListFields(listId);
        return {
          viewTitle: 'デフォルトビュー',
          viewId: null,
          fields: fallbackFields,
          viewFieldCount: fallbackFields.length,
          totalFieldCount: fallbackFields.length,
        };
      }
    }

    // 列の書式設定を取得
    async getColumnFormatting(listId, fieldId) {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields('${fieldId}')`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json;odata=verbose',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const field = data.d;

        // CustomFormatter がある場合はそれを返す
        if (field.CustomFormatter) {
          return JSON.parse(field.CustomFormatter);
        }

        return null;
      } catch (error) {
        console.error('列書式取得エラー:', error);
        return null;
      }
    }

    // 列の書式設定を適用
    async applyColumnFormatting(listId, fieldId, formatJson) {
      try {
        // Request digest の取得
        const digestResponse = await fetch(`${this.apiBaseUrl}/contextinfo`, {
          method: 'POST',
          headers: {
            Accept: 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
          },
        });

        if (!digestResponse.ok) {
          throw new Error('Request digest の取得に失敗');
        }

        const digestData = await digestResponse.json();
        const requestDigest = digestData.d.GetContextWebInformation.FormDigestValue;

        // 列の書式設定を更新
        const updateResponse = await fetch(
          `${this.apiBaseUrl}/web/lists('${listId}')/fields('${fieldId}')`,
          {
            method: 'PATCH',
            headers: {
              Accept: 'application/json;odata=verbose',
              'Content-Type': 'application/json;odata=verbose',
              'X-RequestDigest': requestDigest,
              'IF-MATCH': '*',
              'X-HTTP-Method': 'MERGE',
            },
            body: JSON.stringify({
              __metadata: { type: 'SP.Field' },
              CustomFormatter: JSON.stringify(formatJson),
            }),
          }
        );

        if (!updateResponse.ok) {
          throw new Error(`HTTP ${updateResponse.status}`);
        }

        return true;
      } catch (error) {
        console.error('列書式適用エラー:', error);
        return false;
      }
    }
  }

  // =============================================================================
  // UI 管理クラス
  // =============================================================================
  class UIManager {
    constructor(apiClient, formatManager) {
      this.apiClient = apiClient;
      this.formatManager = formatManager;
      this.currentView = 'main'; // main, extract, apply, manage
      this.selectedList = null;
      this.selectedField = null;
    }

    // パネルを作成
    createPanel() {
      // 既存パネルがあれば削除
      const existingPanel = document.getElementById(CONSTANTS.PANEL_ID);
      if (existingPanel) {
        memoryManager.cleanup(); // メモリクリーンアップ
        existingPanel.remove();
      }

      const panel = document.createElement('div');
      panel.id = CONSTANTS.PANEL_ID;
      panel.style.cssText = this.getPanelStyles();

      document.body.appendChild(panel);

      // パネルのコンテンツが設定された後にドラッグ機能を有効化
      setTimeout(() => {
        this.makeDraggable(panel);
      }, 100);

      return panel;
    }

    // パネルスタイル
    getPanelStyles() {
      return `
        position: fixed !important;
        top: 50px !important;
        right: 50px !important;
        width: ${CONSTANTS.PANEL_WIDTH}px !important;
        height: ${CONSTANTS.PANEL_HEIGHT}px !important;
        background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
        border: 2px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} !important;
        box-shadow: ${SHAREPOINT_DESIGN_SYSTEM.SHADOWS.PANEL} !important;
        z-index: ${CONSTANTS.Z_INDEX} !important;
        font-family: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        min-width: 350px !important;
        min-height: 400px !important;
      `;
    }

    // ドラッグ可能にする
    makeDraggable(element) {
      // 既にドラッグ機能が設定済みの場合はスキップ
      if (element.dataset.draggableSetup === 'true') {
        return;
      }

      this.setupWindowMove(element);
      this.setupResize(element);

      // 設定完了マークを付ける
      element.dataset.draggableSetup = 'true';
    }

    // ウィンドウ移動機能
    setupWindowMove(element) {
      let isDragging = false;
      let startX, startY, initialX, initialY;

      const header = element.querySelector('.formatter-header');
      if (!header) return;

      header.style.cursor = 'move';

      const handleMouseDown = e => {
        // リサイズハンドルまたはその子要素がクリックされた場合は移動しない
        if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) {
          return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = element.offsetLeft;
        initialY = element.offsetTop;

        header.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none'; // テキスト選択を無効化
        e.preventDefault();
      };

      const handleMouseMove = e => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newX = initialX + deltaX;
        let newY = initialY + deltaY;

        // ビューポート境界内に制限
        const maxX = window.innerWidth - element.offsetWidth;
        const maxY = window.innerHeight - element.offsetHeight;

        newX = Math.max(0, Math.min(maxX, newX));
        newY = Math.max(0, Math.min(maxY, newY));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
        element.style.right = 'auto';
      };

      const handleMouseUp = () => {
        if (isDragging) {
          isDragging = false;
          header.style.cursor = 'move';
          document.body.style.userSelect = ''; // テキスト選択を再有効化
        }
      };

      memoryManager.addEventListener(header, 'mousedown', handleMouseDown);
      memoryManager.addEventListener(document, 'mousemove', handleMouseMove);
      memoryManager.addEventListener(document, 'mouseup', handleMouseUp);
    }

    // リサイズ機能
    setupResize(element) {
      // 既にリサイズハンドルが存在する場合はスキップ
      if (element.querySelector('.resize-handle')) {
        return;
      }

      // リサイズハンドルを追加
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'resize-handle';
      resizeHandle.style.cssText = `
        position: absolute !important;
        bottom: -2px !important;
        right: -2px !important;
        width: 24px !important;
        height: 24px !important;
        cursor: se-resize !important;
        background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 !important;
        z-index: 1001 !important;
        opacity: 0.7 !important;
        transition: all 0.2s ease !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
      `;

      // リサイズアイコン追加（標準的なグリップスタイル）
      resizeHandle.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 14 14" style="
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          fill: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
        ">
          <!-- 対角線のドット -->
          <circle cx="8" cy="8" r="1.5"/>
          <circle cx="5" cy="11" r="1.5"/>
          <circle cx="11" cy="5" r="1.5"/>
          <circle cx="11" cy="8" r="1.5"/>
          <circle cx="8" cy="11" r="1.5"/>
          <circle cx="11" cy="11" r="1.5"/>
        </svg>
      `;

      element.appendChild(resizeHandle);

      let isResizing = false;
      let startX, startY, startWidth, startHeight;
      const handleMouseDown = e => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(element).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(element).height, 10);

        // カーソルスタイルの統一
        document.body.style.cursor = 'se-resize';
        resizeHandle.style.cursor = 'se-resize';
        document.body.style.userSelect = 'none'; // テキスト選択を無効化
        resizeHandle.style.opacity = '1';
        resizeHandle.style.transform = 'scale(1.1)';

        e.preventDefault();
        e.stopPropagation();
      };

      const handleMouseMove = e => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const newWidth = startWidth + deltaX;
        const newHeight = startHeight + deltaY;

        // 最小サイズ制限
        const minWidth = 350;
        const minHeight = 400;

        // 最大サイズ制限（ビューポートの90%）
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.9;

        const finalWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        const finalHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

        element.style.width = `${finalWidth}px`;
        element.style.height = `${finalHeight}px`;

        // パネルが画面外に出ないように位置を調整
        const rect = element.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          element.style.left = `${window.innerWidth - finalWidth}px`;
          element.style.right = 'auto';
        }
        if (rect.bottom > window.innerHeight) {
          element.style.top = `${window.innerHeight - finalHeight}px`;
        }
      };

      const handleMouseUp = () => {
        if (isResizing) {
          isResizing = false;
          document.body.style.cursor = '';
          resizeHandle.style.cursor = 'se-resize';
          document.body.style.userSelect = ''; // テキスト選択を再有効化
          resizeHandle.style.opacity = '0.7';
          resizeHandle.style.transform = 'scale(1)';
        }
      };

      // ホバー効果
      const handleMouseEnter = () => {
        if (!isResizing) {
          resizeHandle.style.opacity = '1';
          resizeHandle.style.transform = 'scale(1.05)';
        }
      };

      const handleMouseLeave = () => {
        if (!isResizing) {
          resizeHandle.style.opacity = '0.7';
          resizeHandle.style.transform = 'scale(1)';
        }
      }; // イベントリスナーの登録
      memoryManager.addEventListener(resizeHandle, 'mousedown', handleMouseDown);
      memoryManager.addEventListener(document, 'mousemove', handleMouseMove);
      memoryManager.addEventListener(document, 'mouseup', handleMouseUp);
      memoryManager.addEventListener(resizeHandle, 'mouseenter', handleMouseEnter);
      memoryManager.addEventListener(resizeHandle, 'mouseleave', handleMouseLeave);
    }

    // メインビューを表示
    showMainView() {
      this.currentView = 'main';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      panel.innerHTML = this.generateMainViewHTML();
      this.attachMainViewEvents();

      // ドラッグ機能を再有効化（まだ設定されていない場合のみ）
      setTimeout(() => {
        this.makeDraggable(panel);
      }, 50);
    } // メインビューHTML生成
    generateMainViewHTML() {
      const currentList = Utils.getCurrentListInfo();
      const savedFormatsCount = this.formatManager.getAllFormats().length;

      // 保存された書式がある場合は管理ボタンを目立つ色にする
      const manageButtonStyle = savedFormatsCount > 0 ? 'primary' : 'secondary';

      return `        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;
             cursor: move !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <span style="font-size: 12px !important; opacity: 0.8 !important;" title="ドラッグしてウィンドウを移動">⋮⋮</span>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              📊 Lists Column Formatter
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          ${
            currentList.title
              ? `
            <div style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                 padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                 border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                 margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <div style="font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                   color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                現在のリスト: ${Utils.escapeHtml(currentList.title)}
              </div>
              <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                   color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                   margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important;">
                列書式の取得・適用が可能です
              </div>
            </div>
          `
              : ''
          }

          <div style="display: grid !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
            <button id="extract-format" class="action-button" style="${this.getButtonStyles('primary')}">
              📤 列書式を取得・保存
            </button>

            <button id="apply-format" class="action-button" style="${this.getButtonStyles('primary')}">
              📥 列書式を適用
            </button>

            <button id="manage-formats" class="action-button" style="${this.getButtonStyles(manageButtonStyle)}"
              title="${savedFormatsCount > 0 ? `${savedFormatsCount}件の書式が保存されています` : '保存された書式はありません'}">
              🗂️ 保存された書式を管理${savedFormatsCount > 0 ? ` (${savedFormatsCount})` : ''}
            </button>

            <hr style="border: none !important; border-top: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                 margin: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} 0 !important;">            <button id="import-format" class="action-button" style="${this.getButtonStyles('info')}"
              title="Microsoft公式のJSON列書式または、このツールでエクスポートした書式をインポートできます">
              📋 クリップボードから書式をインポート
            </button>

            <button id="export-all" class="action-button" style="${this.getButtonStyles('info')}">
              💾 全ての書式をエクスポート
            </button>
          </div>          <div style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XL} !important;
               padding-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
               border-top: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
               font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
               color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
            保存数: ${this.formatManager.getAllFormats().length} 件<br>
            📝 インポート可能形式: Microsoft公式JSON列書式、このツールのエクスポート形式
          </div>
        </div>
      `;
    }

    // ボタンスタイル
    getButtonStyles(type = 'primary') {
      const colors = {
        primary: SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY,
        secondary: SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.MUTED,
        info: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.INFO,
        success: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.SUCCESS,
        warning: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING,
        error: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.ERROR,
      };

      return `
        background: ${colors[type]} !important;
        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
        border: none !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
        padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
        font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.MEDIUM} !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        text-align: left !important;
        width: 100% !important;
      `;
    }

    // メインビューイベント追加
    attachMainViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const extractBtn = document.getElementById('extract-format');
      if (extractBtn) {
        memoryManager.addEventListener(extractBtn, 'click', () => {
          this.showExtractView();
        });
      }

      const applyBtn = document.getElementById('apply-format');
      if (applyBtn) {
        memoryManager.addEventListener(applyBtn, 'click', () => {
          this.showApplyView();
        });
      }

      const manageBtn = document.getElementById('manage-formats');
      if (manageBtn) {
        memoryManager.addEventListener(manageBtn, 'click', () => {
          this.showManageView();
        });
      }

      const importBtn = document.getElementById('import-format');
      if (importBtn) {
        memoryManager.addEventListener(importBtn, 'click', async () => {
          const imported = await this.formatManager.importFormatFromClipboard();
          if (imported) {
            this.showMessage('書式をインポートしました', 'success');
            memoryManager.setTimeout(() => this.showMainView(), 1500);
          } else {
            this.showMessage('インポートに失敗しました', 'error');
          }
        });
      }

      const exportBtn = document.getElementById('export-all');
      if (exportBtn) {
        memoryManager.addEventListener(exportBtn, 'click', () => {
          this.exportAllFormats();
        });
      }

      // ボタンホバー効果
      document.querySelectorAll('.action-button').forEach(button => {
        memoryManager.addEventListener(button, 'mouseenter', () => {
          button.style.opacity = '0.9';
          button.style.transform = 'translateY(-1px)';
        });

        memoryManager.addEventListener(button, 'mouseleave', () => {
          button.style.opacity = '1';
          button.style.transform = 'translateY(0)';
        });
      });
    }

    // 書式取得ビューを表示
    async showExtractView() {
      this.currentView = 'extract';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      panel.innerHTML = this.generateLoadingHTML('リスト情報を取得中...');

      try {
        const lists = await this.apiClient.getLists();
        panel.innerHTML = this.generateExtractViewHTML(lists);
        this.attachExtractViewEvents();
      } catch (error) {
        this.showMessage('リスト情報の取得に失敗しました', 'error');
      }
    }

    // 書式取得ビューHTML生成
    generateExtractViewHTML(lists) {
      return `
        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <button id="back-to-main" style="background: transparent !important; border: none !important;
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    font-size: 16px !important; cursor: pointer !important; padding: 4px !important;">←</button>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              📤 書式を取得
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
            <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
              リストを選択:
            </label>
            <select id="list-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                    border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                    border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                    font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;">
              <option value="">リストを選択してください</option>
              ${lists
                .map(
                  list => `
                <option value="${list.Id}">${Utils.escapeHtml(list.Title)}</option>
              `
                )
                .join('')}
            </select>
          </div>          <div id="fields-container" style="display: none !important;">
            <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
              列を選択:
            </label>
            <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                 margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
              📋 デフォルトビューで表示される列のみが対象です
            </div>
            <select id="field-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                    border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                    border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                    font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                    margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <option value="">列を選択してください</option>
            </select>
          </div>

          <div id="format-preview" style="display: none !important;"></div>

          <div id="save-container" style="display: none !important;">
            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
              <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                書式名:
              </label>
              <input type="text" id="format-name" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                     border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                     font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;"
                     placeholder="例: 進捗バー書式">
            </div>

            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                説明:
              </label>
              <textarea id="format-description" style="width: 100% !important; height: 60px !important;
                        padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                        border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                        resize: vertical !important;"
                        placeholder="書式の説明（オプション）"></textarea>
            </div>

            <button id="save-format" style="${this.getButtonStyles('success')}">
              💾 書式を保存
            </button>
          </div>
        </div>
      `;
    }

    // 書式取得ビューイベント追加
    attachExtractViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const backBtn = document.getElementById('back-to-main');
      if (backBtn) {
        memoryManager.addEventListener(backBtn, 'click', () => {
          this.showMainView();
        });
      }

      const listSelect = document.getElementById('list-select');
      if (listSelect) {
        memoryManager.addEventListener(listSelect, 'change', async e => {
          const listId = e.target.value;
          if (!listId) {
            document.getElementById('fields-container').style.display = 'none';
            return;
          }
          try {
            // デフォルトビューで表示される列のみを取得
            const viewInfo = await this.apiClient.getDefaultViewFields(listId);
            const fieldSelect = document.getElementById('field-select');
            fieldSelect.innerHTML = '<option value="">列を選択してください</option>';

            if (viewInfo.fields.length === 0) {
              fieldSelect.innerHTML += '<option disabled>表示可能な列がありません</option>';
            } else {
              // リストタイトルとビュー情報を表示
              const listTitle =
                document.getElementById('list-select').selectedOptions[0].textContent;
              fieldSelect.innerHTML += `<option disabled>--- ${Utils.escapeHtml(listTitle)} (${Utils.escapeHtml(viewInfo.viewTitle)}: ${viewInfo.fields.length}/${viewInfo.viewFieldCount}列) ---</option>`;
              viewInfo.fields.forEach(field => {
                const normalizedType = ColumnFormatManager.normalizeColumnType(field.TypeAsString);
                fieldSelect.innerHTML += `
                  <option value="${field.Id}" data-type="${normalizedType}" data-original-type="${field.TypeAsString}">
                    ${Utils.escapeHtml(field.Title)} (${normalizedType})
                  </option>
                `;
              });

              // 除外された列がある場合の説明を追加
              if (viewInfo.fields.length < viewInfo.viewFieldCount) {
                fieldSelect.innerHTML += `<option disabled>--- ${viewInfo.viewFieldCount - viewInfo.fields.length}列が読み取り専用のため除外されました ---</option>`;
              }
            }

            document.getElementById('fields-container').style.display = 'block';
          } catch (error) {
            this.showMessage('列情報の取得に失敗しました', 'error');
          }
        });
      }

      const fieldSelect = document.getElementById('field-select');
      if (fieldSelect) {
        memoryManager.addEventListener(fieldSelect, 'change', async e => {
          const fieldId = e.target.value;
          const listId = document.getElementById('list-select').value;

          if (!fieldId || !listId) {
            document.getElementById('format-preview').style.display = 'none';
            document.getElementById('save-container').style.display = 'none';
            return;
          }

          try {
            const formatJson = await this.apiClient.getColumnFormatting(listId, fieldId);
            const previewContainer = document.getElementById('format-preview');

            if (formatJson) {
              previewContainer.innerHTML = `
                <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                  <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} 0 !important;
                     color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                    📋 現在の書式設定:
                  </h4>
                  <pre style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                       padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                       border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                       font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                       max-height: 200px !important; overflow-y: auto !important;
                       white-space: pre-wrap !important; word-break: break-word !important;">
  ${Utils.escapeHtml(JSON.stringify(formatJson, null, 2))}
                  </pre>
                </div>
              `;

              // 自動で書式名を設定
              const fieldName = document
                .getElementById('field-select')
                .selectedOptions[0].textContent.split(' (')[0];
              document.getElementById('format-name').value = `${fieldName}の書式`;

              document.getElementById('save-container').style.display = 'block';
            } else {
              previewContainer.innerHTML = `
                <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;
                     background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING} !important;
                     color: white !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                     border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;">
                  ⚠️ この列には書式設定がありません
                </div>
              `;
              document.getElementById('save-container').style.display = 'none';
            }

            previewContainer.style.display = 'block';
          } catch (error) {
            this.showMessage('書式情報の取得に失敗しました', 'error');
          }
        });
      }

      const saveBtn = document.getElementById('save-format');
      if (saveBtn) {
        memoryManager.addEventListener(saveBtn, 'click', async () => {
          const listId = document.getElementById('list-select').value;
          const fieldId = document.getElementById('field-select').value;
          const formatName = document.getElementById('format-name').value.trim();
          const formatDescription = document.getElementById('format-description').value.trim();

          if (!formatName) {
            this.showMessage('書式名を入力してください', 'warning');
            return;
          }

          try {
            const formatJson = await this.apiClient.getColumnFormatting(listId, fieldId);
            if (!formatJson) {
              this.showMessage('取得可能な書式設定がありません', 'warning');
              return;
            }

            const listSelect = document.getElementById('list-select');
            const fieldSelect = document.getElementById('field-select');

            const formatData = {
              name: formatName,
              description: formatDescription,
              columnType: fieldSelect.selectedOptions[0].dataset.type,
              formatJson: formatJson,
              sourceList: listSelect.selectedOptions[0].textContent,
              sourceColumn: fieldSelect.selectedOptions[0].textContent.split(' (')[0],
            };

            this.formatManager.saveFormat(formatData);
            this.showMessage('書式を保存しました', 'success');

            memoryManager.setTimeout(() => this.showMainView(), 1500);
          } catch (error) {
            this.showMessage('書式の保存に失敗しました', 'error');
          }
        });
      }
    }

    // ローディングHTML生成
    generateLoadingHTML(message) {
      return `
        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: center !important; align-items: center !important;">
          <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
            📊 Lists Column Formatter
          </h3>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important;
             display: flex !important; flex-direction: column !important; justify-content: center !important;
             align-items: center !important; text-align: center !important;">
          <div style="font-size: 24px !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
            ⏳
          </div>
          <div style="color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
            ${Utils.escapeHtml(message)}
          </div>
        </div>
      `;
    }

    // メッセージを表示
    showMessage(message, type = 'info') {
      const colors = {
        info: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.INFO,
        success: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.SUCCESS,
        warning: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING,
        error: SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.ERROR,
      };

      const messageDiv = document.createElement('div');
      messageDiv.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: ${colors[type]} !important;
        color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
        padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
        box-shadow: ${SHAREPOINT_DESIGN_SYSTEM.SHADOWS.PANEL} !important;
        z-index: ${CONSTANTS.Z_INDEX + 1} !important;
        font-family: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important;
        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
        max-width: 300px !important;
      `;
      messageDiv.textContent = message;

      document.body.appendChild(messageDiv);

      setTimeout(() => {
        messageDiv.remove();
      }, 3000);
    }

    // 全書式をエクスポート
    exportAllFormats() {
      const formats = this.formatManager.getAllFormats();
      if (formats.length === 0) {
        this.showMessage('エクスポートする書式がありません', 'warning');
        return;
      }

      const exportData = {
        exportedAt: Utils.getCurrentTimestamp(),
        exportedFrom: 'Microsoft Lists Column Formatter',
        formatCount: formats.length,
        formats: formats,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lists-column-formats-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showMessage(`${formats.length}件の書式をエクスポートしました`, 'success');
    }

    // 書式適用ビューを表示
    async showApplyView() {
      this.currentView = 'apply';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      panel.innerHTML = this.generateLoadingHTML('リスト情報を取得中...');

      try {
        const lists = await this.apiClient.getLists();
        const formats = this.formatManager.getAllFormats();
        panel.innerHTML = this.generateApplyViewHTML(lists, formats);
        this.attachApplyViewEvents();
      } catch (error) {
        this.showMessage('リスト情報の取得に失敗しました', 'error');
      }
    }

    // 書式適用ビューHTML生成
    generateApplyViewHTML(lists, formats) {
      return `
        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <button id="back-to-main" style="background: transparent !important; border: none !important;
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    font-size: 16px !important; cursor: pointer !important; padding: 4px !important;">←</button>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              📥 書式を適用
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          ${
            formats.length === 0
              ? `
            <div style="text-align: center !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XL} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
              <div style="font-size: 48px !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">📋</div>
              <div>保存された書式がありません</div>
              <div style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;">
                まず書式を取得・保存してください
              </div>
            </div>
          `
              : `
            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                     font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                適用する書式を選択:
              </label>
              <select id="format-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                      border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                      border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                      font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;">
                <option value="">書式を選択してください</option>
                ${formats
                  .map(
                    format => `
                  <option value="${format.id}" data-type="${format.columnType}">
                    ${Utils.escapeHtml(format.name)} (${format.columnType})
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>

            <div id="format-details" style="display: none !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} 0 !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                📋 書式の詳細:
              </h4>
              <div id="format-info"></div>
            </div>

            <div id="target-selection" style="display: none !important;">
              <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
                <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                       font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                  適用先のリストを選択:
                </label>
                <select id="target-list-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                        border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;">
                  <option value="">リストを選択してください</option>
                  ${lists
                    .map(
                      list => `
                    <option value="${list.Id}">${Utils.escapeHtml(list.Title)}</option>
                  `
                    )
                    .join('')}
                </select>
              </div>

              <div id="target-fields-container" style="display: none !important;">
                <label style="display: block !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                       font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;">
                  適用先の列を選択:
                </label>
                <select id="target-field-select" style="width: 100% !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                        border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                        border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                        font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                        margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                  <option value="">列を選択してください</option>
                </select>

                <div id="column-mapping" style="display: none !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                  <div style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                       padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                       border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;">
                    <h5 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} 0 !important;
                       color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                      🔄 列名マッピング
                    </h5>
                    <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                         color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                         margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                      書式内の列参照を新しい列名に自動変更します
                    </div>
                    <div id="mapping-info"></div>
                  </div>
                </div>

                <button id="apply-format-btn" style="${this.getButtonStyles('success')}">
                  🎨 書式を適用
                </button>
              </div>
            </div>
          `
          }
        </div>
      `;
    }

    // 書式適用ビューイベント追加
    attachApplyViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const backBtn = document.getElementById('back-to-main');
      if (backBtn) {
        memoryManager.addEventListener(backBtn, 'click', () => {
          this.showMainView();
        });
      }

      const formatSelect = document.getElementById('format-select');
      if (formatSelect) {
        memoryManager.addEventListener(formatSelect, 'change', e => {
          const formatId = e.target.value;
          const detailsContainer = document.getElementById('format-details');
          const targetContainer = document.getElementById('target-selection');

          if (!formatId) {
            detailsContainer.style.display = 'none';
            targetContainer.style.display = 'none';
            return;
          }

          const format = this.formatManager.getFormat(formatId);
          if (format) {
            document.getElementById('format-info').innerHTML = `
            <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                 margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
              <strong>説明:</strong> ${Utils.escapeHtml(format.description || 'なし')}<br>
              <strong>列タイプ:</strong> ${Utils.escapeHtml(format.columnType)}<br>
              <strong>取得元:</strong> ${Utils.escapeHtml(format.sourceList)} - ${Utils.escapeHtml(format.sourceColumn)}<br>
              <strong>作成日:</strong> ${Utils.escapeHtml(format.createdAt)}
            </div>
            <details style="margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
              <summary style="cursor: pointer !important; font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.MEDIUM} !important;">
                JSON書式を表示
              </summary>
              <pre style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
                   padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                   border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                   font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                   max-height: 150px !important; overflow-y: auto !important;
                   white-space: pre-wrap !important; word-break: break-word !important;
                   margin-top: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
${Utils.escapeHtml(JSON.stringify(format.formatJson, null, 2))}
              </pre>
            </details>
          `;

            detailsContainer.style.display = 'block';
            targetContainer.style.display = 'block';
          }
        });
      }

      const targetListSelect = document.getElementById('target-list-select');
      if (targetListSelect) {
        memoryManager.addEventListener(targetListSelect, 'change', async e => {
          const listId = e.target.value;
          const fieldsContainer = document.getElementById('target-fields-container');

          if (!listId) {
            fieldsContainer.style.display = 'none';
            return;
          }

          try {
            const formatId = document.getElementById('format-select').value;
            const format = this.formatManager.getFormat(formatId);
            const fields = await this.apiClient.getListFields(listId);
            const compatibleFields = fields.filter(
              field =>
                ColumnFormatManager.normalizeColumnType(field.TypeAsString) === format.columnType
            );

            const fieldSelect = document.getElementById('target-field-select');
            fieldSelect.innerHTML = '<option value="">列を選択してください</option>';

            if (compatibleFields.length === 0) {
              fieldSelect.innerHTML += `<option disabled>互換性のある列がありません (${format.columnType})</option>`;
            } else {
              compatibleFields.forEach(field => {
                fieldSelect.innerHTML += `
                  <option value="${field.Id}" data-internal="${field.InternalName}" data-title="${field.Title}">
                    ${Utils.escapeHtml(field.Title)} (${field.TypeAsString})
                  </option>
                `;
              });
            }

            fieldsContainer.style.display = 'block';
          } catch (error) {
            this.showMessage('列情報の取得に失敗しました', 'error');
          }
        });
      }

      const targetFieldSelect = document.getElementById('target-field-select');
      if (targetFieldSelect) {
        memoryManager.addEventListener(targetFieldSelect, 'change', e => {
          const fieldId = e.target.value;
          const mappingContainer = document.getElementById('column-mapping');

          if (!fieldId) {
            mappingContainer.style.display = 'none';
            return;
          }

          const selectedOption = e.target.selectedOptions[0];
          const newColumnName = selectedOption.dataset.title;
          const formatId = document.getElementById('format-select').value;
          const format = this.formatManager.getFormat(formatId);

          document.getElementById('mapping-info').innerHTML = `
            <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;">
              <strong>元の列:</strong> ${Utils.escapeHtml(format.sourceColumn)}<br>
              <strong>新しい列:</strong> ${Utils.escapeHtml(newColumnName)}
            </div>
          `;

          mappingContainer.style.display = 'block';
        });
      }

      const applyFormatBtn = document.getElementById('apply-format-btn');
      if (applyFormatBtn) {
        memoryManager.addEventListener(applyFormatBtn, 'click', async () => {
          const formatId = document.getElementById('format-select').value;
          const listId = document.getElementById('target-list-select').value;
          const fieldId = document.getElementById('target-field-select').value;

          if (!formatId || !listId || !fieldId) {
            this.showMessage('すべての項目を選択してください', 'warning');
            return;
          }

          try {
            const format = this.formatManager.getFormat(formatId);
            const selectedField = document.getElementById('target-field-select').selectedOptions[0];
            const newColumnTitle = selectedField.dataset.title; // 書式JSONの列参照を新しい列名に変更
            let modifiedFormatJson = JSON.parse(JSON.stringify(format.formatJson));

            // デバッグ用ログ
            console.log('置換情報:', {
              sourceColumn: format.sourceColumn,
              newColumnTitle: newColumnTitle,
              formatName: format.name,
              sourceList: format.sourceList,
            });

            // インポートされた書式の場合は列名置換をスキップ（より安全）
            if (
              format.sourceList === 'インポート' ||
              !format.sourceColumn ||
              format.sourceColumn.trim() === ''
            ) {
              console.log('インポート書式または空のsourceColumnのため置換をスキップ');
            } else {
              modifiedFormatJson = this.replaceColumnReferences(
                modifiedFormatJson,
                format.sourceColumn,
                newColumnTitle
              );
            }

            const success = await this.apiClient.applyColumnFormatting(
              listId,
              fieldId,
              modifiedFormatJson
            );

            if (success) {
              this.showMessage('書式を適用しました', 'success');
              memoryManager.setTimeout(() => this.showMainView(), 1500);
            } else {
              this.showMessage('書式の適用に失敗しました', 'error');
            }
          } catch (error) {
            this.showMessage('書式の適用中にエラーが発生しました', 'error');
          }
        });
      }
    }

    // 書式管理ビューを表示
    showManageView() {
      this.currentView = 'manage';
      const panel = document.getElementById(CONSTANTS.PANEL_ID);
      if (!panel) return;

      const formats = this.formatManager.getAllFormats();
      panel.innerHTML = this.generateManageViewHTML(formats);
      this.attachManageViewEvents();

      // ドラッグ機能を再有効化（まだ設定されていない場合のみ）
      setTimeout(() => {
        this.makeDraggable(panel);
      }, 50);
    }

    // 書式管理ビューHTML生成
    generateManageViewHTML(formats) {
      return `        <div class="formatter-header" style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
             color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
             padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
             border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.XL} 0 0 !important;
             display: flex !important; justify-content: space-between !important; align-items: center !important;
             cursor: move !important;">
          <div style="display: flex !important; align-items: center !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
            <span style="font-size: 12px !important; opacity: 0.8 !important;" title="ドラッグしてウィンドウを移動">⋮⋮</span>
            <button id="back-to-main" style="background: transparent !important; border: none !important;
                    color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                    font-size: 16px !important; cursor: pointer !important; padding: 4px !important;">←</button>
            <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
              🗂️ 書式管理
            </h3>
          </div>
          <button id="close-panel" style="background: transparent !important; border: none !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  font-size: 18px !important; cursor: pointer !important; padding: 4px !important;">✕</button>
        </div>

        <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important; flex: 1 !important; overflow-y: auto !important;">
          ${
            formats.length === 0
              ? `
            <div style="text-align: center !important; padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XL} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
              <div style="font-size: 48px !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">📋</div>
              <div>保存された書式がありません</div>
            </div>
          `
              : `
            <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;
                 font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                 color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
              ${formats.length} 件の書式が保存されています
            </div>

            <div style="display: grid !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
              ${formats
                .map(
                  format => `                <div style="border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                     border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                     padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
                     background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
                     box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;">
                  <div style="display: flex !important; justify-content: space-between !important;
                       align-items: flex-start !important; margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;">
                    <div style="flex: 1 !important;">
                      <h4 style="margin: 0 0 ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} 0 !important;
                         color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
                         font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H4} !important;">
                        ${Utils.escapeHtml(format.name)}
                      </h4>
                      <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                           color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
                        ${Utils.escapeHtml(format.description || '説明なし')}
                      </div>
                    </div>
                    <div style="display: flex !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} !important;">
                      <button class="edit-format" data-id="${format.id}"
                              style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.WARNING} !important;
                              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                              border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                              font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                              cursor: pointer !important;" title="編集">
                        ✏️
                      </button>
                      <button class="copy-format" data-id="${format.id}"
                              style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.INFO} !important;
                              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                              border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                              font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                              cursor: pointer !important;" title="クリップボードにコピー">
                        📋
                      </button>
                      <button class="delete-format" data-id="${format.id}"
                              style="background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.STATUS.ERROR} !important;
                              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                              border: none !important; border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
                              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.XS} ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                              font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
                              cursor: pointer !important;" title="削除">
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div style="font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                       color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
                    <div><strong>列タイプ:</strong> ${Utils.escapeHtml(format.columnType)}</div>
                    <div><strong>取得元:</strong> ${Utils.escapeHtml(format.sourceList)} - ${Utils.escapeHtml(format.sourceColumn)}</div>
                    <div><strong>作成日:</strong> ${Utils.escapeHtml(format.createdAt)}</div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
          }
        </div>
      `;
    }

    // 書式管理ビューイベント追加
    attachManageViewEvents() {
      const closeBtn = document.getElementById('close-panel');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          memoryManager.cleanup();
          document.getElementById(CONSTANTS.PANEL_ID)?.remove();
        });
      }

      const backBtn = document.getElementById('back-to-main');
      if (backBtn) {
        memoryManager.addEventListener(backBtn, 'click', () => {
          this.showMainView();
        });
      }

      // 編集ボタンのイベント
      document.querySelectorAll('.edit-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', e => {
          const formatId = e.target.dataset.id;
          this.showEditFormatDialog(formatId);
        });
      });

      // コピーボタンのイベント
      document.querySelectorAll('.copy-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', async e => {
          const formatId = e.target.dataset.id;
          const success = await this.formatManager.copyFormatToClipboard(formatId);

          if (success) {
            this.showMessage('クリップボードにコピーしました', 'success');

            // ボタンを一時的に変更
            const originalText = e.target.textContent;
            e.target.textContent = '✓';
            memoryManager.setTimeout(() => {
              e.target.textContent = originalText;
            }, 1000);
          } else {
            this.showMessage('コピーに失敗しました', 'error');
          }
        });
      });

      // 削除ボタンのイベント
      document.querySelectorAll('.delete-format').forEach(button => {
        memoryManager.addEventListener(button, 'click', e => {
          const formatId = e.target.dataset.id;
          const format = this.formatManager.getFormat(formatId);

          if (confirm(`書式「${format.name}」を削除しますか？\nこの操作は取り消せません。`)) {
            this.formatManager.deleteFormat(formatId);
            this.showMessage('書式を削除しました', 'success');

            // ビューを再表示
            memoryManager.setTimeout(() => this.showManageView(), 1000);
          }
        });
      });
    }
    replaceColumnReferences(obj, oldColumnName, newColumnName) {
      // より厳密な置換条件チェック
      if (
        !oldColumnName ||
        oldColumnName.trim() === '' ||
        !newColumnName ||
        newColumnName.trim() === '' ||
        oldColumnName === newColumnName
      ) {
        console.log('置換をスキップ:', {
          oldColumnName: JSON.stringify(oldColumnName),
          newColumnName: JSON.stringify(newColumnName),
          reason: '無効な列名または同じ名前',
        });
        return obj;
      }

      if (typeof obj === 'string') {
        // より安全な置換: 完全な単語マッチのみ
        const trimmedOldName = oldColumnName.trim();
        const trimmedNewName = newColumnName.trim();

        // 特殊文字をエスケープ
        const escapedOldName = trimmedOldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // より厳密な正規表現: 英数字の境界のみを対象
        const regex = new RegExp(`\\b${escapedOldName}\\b`, 'g');
        const result = obj.replace(regex, trimmedNewName);

        // 実際に置換が発生した場合のみログ出力
        if (result !== obj) {
          console.log('文字列置換:', {
            original: obj,
            result: result,
            oldName: trimmedOldName,
            newName: trimmedNewName,
          });
        }

        return result;
      } else if (Array.isArray(obj)) {
        // 配列の各要素を再帰的に処理
        return obj.map(item => this.replaceColumnReferences(item, oldColumnName, newColumnName));
      } else if (obj && typeof obj === 'object') {
        // オブジェクトの各プロパティを再帰的に処理
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = this.replaceColumnReferences(value, oldColumnName, newColumnName);
        }
        return result;
      }
      return obj;
    }

    // 書式編集ダイアログを表示
    showEditFormatDialog(formatId) {
      const format = this.formatManager.getFormat(formatId);
      if (!format) {
        this.showMessage('書式が見つかりません', 'error');
        return;
      }

      // ダイアログHTMLを生成
      const dialogHTML = `
        <div id="edit-format-dialog" style="
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(0,0,0,0.5) !important;
          z-index: ${CONSTANTS.Z_INDEX + 1} !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;">

          <div style="
            background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important;
            border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.LG} !important;
            width: 90% !important;
            max-width: 500px !important;
            max-height: 90% !important;
            overflow-y: auto !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;">

            <div style="
              background: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.PRIMARY} !important;
              color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
              padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;
              border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.LG} ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.LG} 0 0 !important;
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;">
              <h3 style="margin: 0 !important; font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H3} !important;">
                ✏️ 書式編集
              </h3>
              <button id="close-edit-dialog" style="
                background: transparent !important;
                border: none !important;
                color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                font-size: 18px !important;
                cursor: pointer !important;
                padding: 4px !important;">✕</button>
            </div>

            <div style="padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
              <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important;">
                <label style="
                  display: block !important;
                  margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                  書式名:
                </label>
                <input type="text" id="edit-format-name" value="${Utils.escapeHtml(format.name)}" style="
                  width: 100% !important;
                  padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                  border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                  font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                  box-sizing: border-box !important;">
              </div>

              <div style="margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.LG} !important;">
                <label style="
                  display: block !important;
                  margin-bottom: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  font-weight: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                  color: ${SHAREPOINT_DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;">
                  説明:
                </label>
                <textarea id="edit-format-description" style="
                  width: 100% !important;
                  height: 80px !important;
                  padding: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.SM} !important;
                  border: 1px solid ${SHAREPOINT_DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
                  border-radius: ${SHAREPOINT_DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                  font-size: ${SHAREPOINT_DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important;
                  resize: vertical !important;
                  box-sizing: border-box !important;">${Utils.escapeHtml(format.description || '')}</textarea>
              </div>

              <div style="display: flex !important; gap: ${SHAREPOINT_DESIGN_SYSTEM.SPACING.MD} !important; justify-content: flex-end !important;">
                <button id="cancel-edit" style="${this.getButtonStyles('secondary')}">
                  キャンセル
                </button>
                <button id="save-edit" style="${this.getButtonStyles('success')}">
                  💾 保存
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // ダイアログを挿入
      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      // イベントハンドラーを追加
      this.attachEditDialogEvents(formatId);
    }

    // 編集ダイアログのイベントハンドラー
    attachEditDialogEvents(formatId) {
      const dialog = document.getElementById('edit-format-dialog');

      // 閉じるボタン
      const closeBtn = document.getElementById('close-edit-dialog');
      if (closeBtn) {
        memoryManager.addEventListener(closeBtn, 'click', () => {
          dialog?.remove();
        });
      }

      // キャンセルボタン
      const cancelBtn = document.getElementById('cancel-edit');
      if (cancelBtn) {
        memoryManager.addEventListener(cancelBtn, 'click', () => {
          dialog?.remove();
        });
      }

      // 保存ボタン
      const saveBtn = document.getElementById('save-edit');
      if (saveBtn) {
        memoryManager.addEventListener(saveBtn, 'click', () => {
          const name = document.getElementById('edit-format-name')?.value.trim();
          const description = document.getElementById('edit-format-description')?.value.trim();

          if (!name) {
            this.showMessage('書式名を入力してください', 'error');
            return;
          }

          // 書式を更新
          const success = this.formatManager.updateFormat(formatId, { name, description });

          if (success) {
            this.showMessage('書式を更新しました', 'success');
            dialog?.remove();

            // 管理画面を再表示
            memoryManager.setTimeout(() => this.showManageView(), 1000);
          } else {
            this.showMessage('更新に失敗しました', 'error');
          }
        });
      }

      // 背景クリックで閉じる
      if (dialog) {
        memoryManager.addEventListener(dialog, 'click', e => {
          if (e.target === dialog) {
            dialog?.remove();
          }
        });
      }
    }
  }

  // =============================================================================
  // メインアプリケーションクラス
  // =============================================================================
  class ListsColumnFormatter {
    constructor() {
      this.siteInfo = Utils.getSiteInfo();
      this.formatManager = new ColumnFormatManager();

      if (!this.siteInfo) {
        alert('このページはSharePointサイトではありません。');
        return;
      }

      this.apiClient = new SharePointApiClient(this.siteInfo);
      this.uiManager = new UIManager(this.apiClient, this.formatManager);

      this.init();
    }

    init() {
      // パネルを作成して表示
      this.uiManager.createPanel();
      this.uiManager.showMainView();
    }
  }

  // =============================================================================
  // エントリーポイント
  // =============================================================================

  // 既存のパネルがあるかチェック
  if (document.getElementById(CONSTANTS.PANEL_ID)) {
    document.getElementById(CONSTANTS.PANEL_ID).remove();
    return;
  }

  // アプリケーションを開始
  new ListsColumnFormatter();
})();
