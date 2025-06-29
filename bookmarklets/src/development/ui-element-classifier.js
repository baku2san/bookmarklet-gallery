/**
 * UI Element Classifier Bookmarklet
 * ページ内のUIコンポーネントを分類・視覚化するツール
 *
 * 機能:
 * - インタラクティブ要素の検出と分類
 * - 各要素タイプに応じた視覚的差別化
 * - 要素の機能性を明確に表示
 * - 汎用的なUI要素分析
 *
 * 対応要素タイプ:
 * 1. ナビゲーション要素 (リンク、メニュー、ブレッドクラム)
 * 2. アクション要素 (ボタン、クリッカブル要素)
 * 3. フォーム要素 (入力フィールド、選択肢)
 * 4. 切り替え要素 (チェックボックス、ラジオ、スイッチ)
 * 5. 分類不明要素 (分類困難な要素)
 */

javascript: (function () {
  'use strict';

  // 設定
  const CONFIG = {
    PANEL_ID: 'shima-ui-classifier',
    Z_INDEX: 2147483647,
    HIGHLIGHT_DURATION: 3000, // ハイライト表示時間（ミリ秒）
  };

  // デザインシステム
  const DESIGN_SYSTEM = {
    COLORS: {
      PRIMARY: '#007acc',
      SUCCESS: '#28a745',
      WARNING: '#ffc107',
      DANGER: '#dc3545',
      INFO: '#17a2b8',
      SECONDARY: '#6c757d',
      LIGHT: '#f8f9fa',
      DARK: '#343a40',
      // 要素タイプ別カラー（新しい5分類システム）
      NAVIGATION: '#6f42c1', // 紫色 - ナビゲーション
      ACTION: '#ff6b35', // オレンジ赤 - アクション
      FORM: '#28a745', // 緑色 - フォーム要素
      TOGGLE: '#ffc107', // 黄色 - 切り替え
      UNKNOWN: '#dc3545', // 赤色 - 分類不明
    },
    SHADOWS: {
      LIGHT: '0 2px 4px rgba(0,0,0,0.1)',
      MEDIUM: '0 4px 8px rgba(0,0,0,0.15)',
      HEAVY: '0 8px 16px rgba(0,0,0,0.2)',
    },
    BORDERS: {
      THIN: '1px solid',
      MEDIUM: '2px solid',
      THICK: '3px solid',
    },
  };

  // 要素分類器クラス
  class UIElementClassifier {
    constructor() {
      this.elements = [];
      this.classifications = {
        navigation: [], // ナビゲーション（リンク、メニュー）
        action: [], // アクション（ボタン、クリック可能要素）
        form: [], // フォーム（入力フィールド、選択肢）
        toggle: [], // 切り替え（チェックボックス、ラジオ、スイッチ）
        unknown: [], // 分類不明
      };
      this.originalStyles = new Map();
      this.hoverListeners = new Map(); // ホバーイベントリスナーを管理
    }

    // 要素を検索・分類
    classifyElements() {
      // デバッグモードの設定
      const debugMode = window.localStorage?.getItem('ui-classifier-debug') === 'true';

      // 全てのインタラクティブ要素を検索
      const interactiveElements = document.querySelectorAll(`
        a, button, input, select, textarea, label,
        [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"],
        [role="switch"], [role="option"], [role="listitem"], [role="treeitem"], [role="gridcell"],
        [onclick], [onmousedown], [onmouseup], [onkeydown], [onkeyup],
        [tabindex]:not([tabindex="-1"]),
        .btn, .button, .link, .toggle, .switch, .dropdown, .nav-link, .menu-item,
        .clickable, .interactive, .action, .control,
        span[onclick], div[onclick], li[onclick], td[onclick],
        [data-toggle], [data-dismiss], [data-target], [data-action], [triggers], [transloco], [placement]
      `);

      if (debugMode) {
        console.log(
          `[UI Classifier Debug] querySelectorAllで検出された要素数: ${interactiveElements.length}`
        );
      }

      // 重複排除のためのSetを使用
      const uniqueElements = new Set(interactiveElements);
      const seenElements = new Set();
      let duplicateCount = 0;

      // 要素を分類に追加（重複チェック付き）
      uniqueElements.forEach(element => {
        if (!seenElements.has(element)) {
          seenElements.add(element);
          this.elements.push(element);
          this.classifyElement(element);

          if (debugMode) {
            const elementInfo = `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}${element.className ? '.' + element.className.split(' ').join('.') : ''}`;
            console.log(`[UI Classifier Debug] 分類中: ${elementInfo}`);
          }
        } else {
          duplicateCount++;
          if (debugMode) {
            console.warn(`[UI Classifier Debug] 重複要素をスキップ:`, element);
          }
        }
      });

      // 重複検出の統計
      const totalFound = interactiveElements.length;
      const actualProcessed = this.elements.length;

      if (debugMode || duplicateCount > 0) {
        console.log(`[UI Classifier] 処理統計:`);
        console.log(`  検出要素数: ${totalFound}`);
        console.log(`  処理要素数: ${actualProcessed}`);
        console.log(`  重複排除数: ${duplicateCount}`);
        console.log(
          `  分類結果: ナビ${this.classifications.navigation.length}, アクション${this.classifications.action.length}, フォーム${this.classifications.form.length}, 切替${this.classifications.toggle.length}, 不明${this.classifications.unknown.length}`
        );
      }

      return this.classifications;
    }

    // 静的なtranslocoテキストかどうかを判定
    isStaticTranslocoText(translocoValue, element) {
      if (!translocoValue) return false;

      // button要素は常にアクション要素として扱う
      if (element.tagName.toLowerCase() === 'button') {
        return false;
      }

      // 一般的な静的表示用のtranslocoパターン
      const staticPatterns = [
        /^status\./i, // status.* (ステータス表示)
        /^report\./i, // report.* (レポート関連)
        /^label\./i, // label.* (ラベル表示)
        /^text\./i, // text.* (テキスト表示)
        /^message\./i, // message.* (メッセージ表示)
        /^info\./i, // info.* (情報表示)
        /^description\./i, // description.* (説明文)
        /^title\./i, // title.* (タイトル表示)
        /^header\./i, // header.* (ヘッダー表示)
        /^footer\./i, // footer.* (フッター表示)
      ];

      // インタラクティブなアクション系パターン（静的ではない）
      const interactivePatterns = [
        /^action\.(save|edit|delete|cancel|confirm|submit|click|trigger|open|close)/i,
        /^button\.(save|edit|delete|cancel|confirm|submit|click|trigger|open|close)/i,
        /^menu\.(open|close|toggle|click|trigger|show|hide)/i,
      ];

      // パターンマッチによる判定
      // まずインタラクティブパターンをチェック（優先）
      if (interactivePatterns.some(pattern => pattern.test(translocoValue))) {
        return false; // インタラクティブ要素
      }

      if (staticPatterns.some(pattern => pattern.test(translocoValue))) {
        return true;
      }

      // 要素の内容とコンテキストによる判定
      const elementText = element.textContent?.trim() || '';
      const className = element.className || '';

      // 明らかに静的な表示を示すクラス名
      if (className.match(/status|state|info|text|label|title|header|footer|description/i)) {
        return true;
      }

      // 要素にクリック可能性を示す属性がない場合
      const hasInteractiveAttributes =
        element.hasAttribute('onclick') ||
        element.hasAttribute('tabindex') ||
        element.hasAttribute('role') ||
        className.match(/clickable|button|link|action/i);

      if (!hasInteractiveAttributes) {
        return true;
      }

      return false;
    }

    // 個別要素の分類
    classifyElement(element) {
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const type = element.getAttribute('type');
      const href = element.getAttribute('href');
      const onclick = element.getAttribute('onclick') || element.onclick;
      const className = element.className || '';
      const dataAttributes = [...element.attributes].filter(
        attr =>
          attr.name.startsWith('data-') ||
          attr.name.match(/^(transloco|containerclass|triggers|placement)$/)
      );

      // 1. 切り替え要素（最優先 - フォーム要素より先に判定）
      if (
        (type === 'checkbox' && tagName === 'input') ||
        (type === 'radio' && tagName === 'input') ||
        role === 'switch' ||
        role === 'checkbox' ||
        role === 'radio' ||
        (className.match(/(^|\s|-)(?:toggle|switch|check|radio)(?:\s|-|$)/i) &&
          !className.match(/dropdown-toggle|modal-trigger|action-/i)) ||
        dataAttributes.some(
          attr =>
            attr.name.match(/switch/i) ||
            (attr.name === 'data-toggle' &&
              attr.value &&
              ['switch', 'checkbox', 'radio'].includes(attr.value.toLowerCase()))
        )
      ) {
        this.classifications.toggle.push({
          element,
          type: 'toggle',
          description: '切り替え要素',
        });
        return;
      }

      // 2. フォーム要素（ただし、submit/button/reset type の input は除外）
      if (
        (['input', 'select', 'textarea'].includes(tagName) &&
          !['submit', 'button', 'reset'].includes(type)) ||
        element.hasAttribute('contenteditable') ||
        element.getAttribute('contenteditable') === 'true'
      ) {
        const isContentEditable = element.hasAttribute('contenteditable');
        this.classifications.form.push({
          element,
          type: 'form',
          subType: isContentEditable ? 'contenteditable' : type || tagName,
          description: isContentEditable
            ? 'フォーム要素: 編集可能コンテンツ'
            : `フォーム要素: ${type || tagName}`,
        });
        return;
      }

      // 3. ナビゲーション要素（リンク）
      if (tagName === 'a' && href && href !== '') {
        const isExternal = href.startsWith('http') || href.startsWith('//');
        const isAnchor = href.startsWith('#');
        const isSpecial = href.startsWith('mailto:') || href.startsWith('tel:');

        // role="button"が設定されているリンクはアクション要素として扱う
        if (role === 'button') {
          this.classifications.action.push({
            element,
            type: 'action',
            description: 'リンクボタン',
          });
          return;
        }

        // href="#" は通常アクション要素として扱われるべき
        if (href === '#') {
          this.classifications.action.push({
            element,
            type: 'action',
            description: 'アクション要素',
          });
          return;
        }

        this.classifications.navigation.push({
          element,
          type: 'navigation',
          subType: isExternal
            ? 'external'
            : isAnchor
              ? 'anchor'
              : isSpecial
                ? 'special'
                : 'internal',
          description: isExternal
            ? '外部リンク'
            : isAnchor
              ? 'アンカーリンク'
              : isSpecial
                ? '特殊リンク'
                : '内部リンク',
        });
        return;
      }

      // 4. ナビゲーション要素（role や親要素での判定）
      if (
        role === 'link' ||
        element.closest('nav') ||
        element.closest('[role="navigation"]') ||
        className.match(/nav|menu|breadcrumb|tab/i) ||
        (tagName === 'li' && className.match(/tab|nav/i)) ||
        (tagName === 'li' && element.hasAttribute('tabindex')) // tabindexを持つli要素（タブナビゲーション）
      ) {
        this.classifications.navigation.push({
          element,
          type: 'navigation',
          description: 'ナビゲーション要素',
        });
        return;
      }

      // 5. アクション要素
      if (
        tagName === 'button' ||
        role === 'button' ||
        role === 'tab' ||
        role === 'menuitem' ||
        onclick ||
        className.match(/btn|button|action|dropdown-toggle|modal-trigger/i) ||
        dataAttributes.some(
          attr =>
            attr.name.match(/action|target|trigger|popover|placement/i) ||
            (attr.name === 'transloco' &&
              ['a', 'button', 'div', 'span'].includes(tagName) &&
              !className.match(/control-label|form-control-static|label|text-only|display-only/i) &&
              !this.isStaticTranslocoText(attr.value, element))
        ) ||
        tagName === 'summary' ||
        (tagName === 'th' && onclick) ||
        (tagName === 'td' && onclick) ||
        (tagName === 'a' && (!href || href === '' || href === '#')) // hrefがない、空、またはアンカーのみのaタグ
      ) {
        this.classifications.action.push({
          element,
          type: 'action',
          description: 'アクション要素',
        });
        return;
      }

      // 6. 分類不明
      this.classifications.unknown.push({
        element,
        type: 'unknown',
        description: '分類不明',
      });
    }

    // 要素のハイライト表示
    highlightElements() {
      Object.entries(this.classifications).forEach(([type, elements]) => {
        elements.forEach(({ element }) => {
          this.applyHighlight(element, type);
        });
      });
    }

    // 特定タイプのみハイライト表示
    highlightElementsByType(targetType) {
      // 全てのハイライトを一旦削除
      this.removeHighlights();

      const elements = this.classifications[targetType] || [];
      elements.forEach(({ element }) => {
        this.applyHighlight(element, targetType);
      });
    }

    // ハイライトスタイルの適用
    applyHighlight(element, type) {
      // 元のスタイルを保存
      if (!this.originalStyles.has(element)) {
        this.originalStyles.set(element, {
          outline: element.style.outline,
          backgroundColor: element.style.backgroundColor,
          border: element.style.border,
          boxShadow: element.style.boxShadow,
          position: element.style.position,
          zIndex: element.style.zIndex,
        });
      }

      const colorMap = {
        navigation: DESIGN_SYSTEM.COLORS.NAVIGATION,
        action: DESIGN_SYSTEM.COLORS.ACTION,
        form: DESIGN_SYSTEM.COLORS.FORM,
        toggle: DESIGN_SYSTEM.COLORS.TOGGLE,
        unknown: DESIGN_SYSTEM.COLORS.UNKNOWN,
      };

      const color = colorMap[type] || DESIGN_SYSTEM.COLORS.SECONDARY;

      // スタイルを適用
      element.style.outline = `${DESIGN_SYSTEM.BORDERS.MEDIUM} ${color}`;
      element.style.backgroundColor = `${color}15`; // 透明度15%
      element.style.boxShadow = `${DESIGN_SYSTEM.SHADOWS.MEDIUM}, inset 0 0 0 1px ${color}`;
      element.style.position = 'relative';
      element.style.zIndex = '1000';

      // 既存のホバーリスナーを削除
      this.removeHoverListeners(element);

      // ホバーエフェクトを追加
      const mouseEnterHandler = () => {
        element.style.backgroundColor = `${color}25`; // 透明度25%
        element.style.transform = 'scale(1.02)';
        element.style.transition = 'all 0.2s ease';
      };

      const mouseLeaveHandler = () => {
        element.style.backgroundColor = `${color}15`; // 元に戻す
        element.style.transform = 'scale(1)';
      };

      element.addEventListener('mouseenter', mouseEnterHandler);
      element.addEventListener('mouseleave', mouseLeaveHandler);

      // リスナーを保存
      this.hoverListeners.set(element, {
        mouseenter: mouseEnterHandler,
        mouseleave: mouseLeaveHandler,
      });
    }

    // ホバーリスナーを削除
    removeHoverListeners(element) {
      const listeners = this.hoverListeners.get(element);
      if (listeners) {
        element.removeEventListener('mouseenter', listeners.mouseenter);
        element.removeEventListener('mouseleave', listeners.mouseleave);
        this.hoverListeners.delete(element);
      }
    }

    // ハイライトを削除
    removeHighlights() {
      this.originalStyles.forEach((originalStyle, element) => {
        // ホバーリスナーを削除
        this.removeHoverListeners(element);
        // スタイルを復元
        Object.assign(element.style, originalStyle);
        element.style.transform = '';
        element.style.transition = '';
      });
      this.originalStyles.clear();
    }

    // 統計情報を取得
    getStatistics() {
      const stats = {};
      Object.entries(this.classifications).forEach(([type, elements]) => {
        stats[type] = elements.length;
      });
      return stats;
    }
  }

  // UIマネージャークラス
  class UIManager {
    constructor() {
      this.classifier = new UIElementClassifier();
      this.panel = null;
      this.isHighlighted = false;
      this.currentHighlightType = null; // 現在ハイライト表示中のタイプ
      this.isDragging = false;
      this.isResizing = false;
      this.dragOffset = { x: 0, y: 0 };
      this.resizeOffset = { x: 0, y: 0 };
    }

    // メインパネルを作成
    createPanel() {
      // 既存パネルを削除
      const existing = document.getElementById(CONFIG.PANEL_ID);
      if (existing) {
        existing.remove();
        if (this.isHighlighted) {
          this.classifier.removeHighlights();
        }
        return;
      }

      this.panel = document.createElement('div');
      this.panel.id = CONFIG.PANEL_ID;
      this.panel.style.cssText = this.getPanelStyles();

      // 要素を分類
      const classifications = this.classifier.classifyElements();
      const stats = this.classifier.getStatistics();

      this.panel.innerHTML = this.generatePanelContent(stats, classifications);
      this.attachEventListeners();
      this.setupWindowResize();

      document.body.appendChild(this.panel);
    }

    // パネルスタイル
    getPanelStyles() {
      return `
        all: initial;
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        width: 380px !important;
        max-height: 80vh !important;
        min-width: 320px !important;
        min-height: 200px !important;
        background: white !important;
        border: ${DESIGN_SYSTEM.BORDERS.MEDIUM} ${DESIGN_SYSTEM.COLORS.PRIMARY} !important;
        border-radius: 12px !important;
        box-shadow: ${DESIGN_SYSTEM.SHADOWS.HEAVY} !important;
        z-index: ${CONFIG.Z_INDEX} !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        color: ${DESIGN_SYSTEM.COLORS.DARK} !important;
        overflow: hidden !important;
        resize: both !important;
        cursor: default !important;
      `;
    }

    // パネルコンテンツを生成
    generatePanelContent(stats, classifications) {
      const totalElements = Object.values(stats).reduce((sum, count) => sum + count, 0);

      return `
        <div style="height: 100% !important; display: flex !important; flex-direction: column !important;">
          <!-- ドラッグ可能なヘッダー -->
          <div id="classifier-header" style="padding: 20px 20px 15px 20px !important; border-bottom: 1px solid #eee !important; cursor: move !important; flex-shrink: 0 !important; user-select: none !important;">
            <div style="display: flex !important; justify-content: space-between !important; align-items: center !important;">
              <h3 style="margin: 0 !important; color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; font-size: 18px !important; font-weight: bold !important;">
                🎯 UI Element Classifier
              </h3>
              <div style="display: flex !important; gap: 8px !important; align-items: center !important;">
                <button id="classifier-minimize" style="background: ${DESIGN_SYSTEM.COLORS.WARNING} !important; color: white !important; border: none !important; border-radius: 4px !important; padding: 4px 8px !important; cursor: pointer !important; font-size: 12px !important;" title="最小化">−</button>
                <button id="classifier-close" style="background: ${DESIGN_SYSTEM.COLORS.DANGER} !important; color: white !important; border: none !important; border-radius: 4px !important; padding: 4px 8px !important; cursor: pointer !important; font-size: 12px !important;" title="閉じる">✕</button>
              </div>
            </div>
          </div>

          <!-- スクロール可能なコンテンツエリア -->
          <div id="classifier-content" style="flex: 1 !important; overflow-y: auto !important; padding: 20px !important;">
            <!-- 統計情報 -->
            <div style="margin-bottom: 20px !important; padding: 15px !important; background: ${DESIGN_SYSTEM.COLORS.LIGHT} !important; border-radius: 8px !important;">
              <h4 style="margin: 0 0 10px 0 !important; color: ${DESIGN_SYSTEM.COLORS.DARK} !important; font-size: 16px !important;">📊 検出統計</h4>
              <div style="font-size: 13px !important;">
                <div><strong>総要素数:</strong> ${totalElements}</div>
              </div>
            </div>

            <!-- 要素タイプ別統計 -->
            <div style="margin-bottom: 20px !important;">
              <h4 style="margin: 0 0 15px 0 !important; color: ${DESIGN_SYSTEM.COLORS.DARK} !important; font-size: 16px !important;">🏷️ 分類結果</h4>
              ${this.generateTypesList(stats, classifications)}
            </div>

            <!-- アクションボタン -->
            <div style="margin-bottom: 20px !important; padding-top: 15px !important; border-top: 1px solid #eee !important;">
              <div style="display: flex !important; gap: 10px !important; flex-wrap: wrap !important;">
                <button id="toggle-highlight" style="background: ${DESIGN_SYSTEM.COLORS.SUCCESS} !important; color: white !important; border: none !important; border-radius: 6px !important; padding: 8px 12px !important; cursor: pointer !important; font-size: 12px !important; flex: 1 !important;">
                  💡 ハイライト表示
                </button>
                <button id="export-results" style="background: ${DESIGN_SYSTEM.COLORS.INFO} !important; color: white !important; border: none !important; border-radius: 6px !important; padding: 8px 12px !important; cursor: pointer !important; font-size: 12px !important; flex: 1 !important;">
                  📋 結果コピー
                </button>
              </div>
            </div>

            <!-- 凡例 -->
            <div style="padding: 15px !important; background: #f8f9fa !important; border-radius: 8px !important; font-size: 12px !important;">
              <h5 style="margin: 0 0 10px 0 !important; color: ${DESIGN_SYSTEM.COLORS.DARK} !important;">🎨 カラーコード凡例</h5>
              ${this.generateLegend()}
            </div>
          </div>
        </div>
      `;
    }

    // 要素タイプリストを生成
    generateTypesList(stats, classifications) {
      const typeInfo = {
        navigation: { name: '🧭 ナビゲーション', color: DESIGN_SYSTEM.COLORS.NAVIGATION },
        action: { name: '🔘 アクション', color: DESIGN_SYSTEM.COLORS.ACTION },
        form: { name: '📝 フォーム要素', color: DESIGN_SYSTEM.COLORS.FORM },
        toggle: { name: '🔄 切り替え', color: DESIGN_SYSTEM.COLORS.TOGGLE },
        unknown: { name: '❓ 分類不明', color: DESIGN_SYSTEM.COLORS.UNKNOWN },
      };

      return Object.entries(stats)
        .filter(([type, count]) => count > 0)
        .map(([type, count]) => {
          const info = typeInfo[type];
          return `
            <div class="type-item" data-type="${type}" style="display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 8px 12px !important; margin-bottom: 6px !important; border-left: 4px solid ${info.color} !important; background: ${info.color}10 !important; border-radius: 4px !important; cursor: pointer !important; transition: all 0.2s ease !important;" title="クリックで${info.name}のみハイライト表示">
              <span style="font-weight: 500 !important;">${info.name}</span>
              <span style="background: ${info.color} !important; color: white !important; padding: 2px 8px !important; border-radius: 12px !important; font-size: 11px !important; font-weight: bold !important;">${count}</span>
            </div>
          `;
        })
        .join('');
    }

    // 凡例を生成
    generateLegend() {
      const colors = [
        { name: 'ナビゲーション', color: DESIGN_SYSTEM.COLORS.NAVIGATION },
        { name: 'アクション', color: DESIGN_SYSTEM.COLORS.ACTION },
        { name: 'フォーム', color: DESIGN_SYSTEM.COLORS.FORM },
        { name: '切り替え', color: DESIGN_SYSTEM.COLORS.TOGGLE },
        { name: '分類不明', color: DESIGN_SYSTEM.COLORS.UNKNOWN },
      ];

      return colors
        .map(
          ({ name, color }) => `
          <div style="display: flex !important; align-items: center !important; margin-bottom: 4px !important;">
            <div style="width: 16px !important; height: 16px !important; background: ${color} !important; border-radius: 3px !important; margin-right: 8px !important;"></div>
            <span>${name}</span>
          </div>
        `
        )
        .join('');
    }

    // イベントリスナーを追加
    attachEventListeners() {
      // 閉じるボタン
      this.panel.querySelector('#classifier-close').addEventListener('click', () => {
        this.panel.remove();
        if (this.isHighlighted) {
          this.classifier.removeHighlights();
        }
      });

      // 最小化ボタン
      this.panel.querySelector('#classifier-minimize').addEventListener('click', () => {
        this.toggleMinimize();
      });

      // ドラッグ機能
      this.setupDragFunctionality();

      // ハイライト切り替えボタン
      const highlightBtn = this.panel.querySelector('#toggle-highlight');
      highlightBtn.addEventListener('click', () => {
        if (this.isHighlighted) {
          this.classifier.removeHighlights();
          highlightBtn.textContent = '💡 ハイライト表示';
          highlightBtn.style.background = DESIGN_SYSTEM.COLORS.SUCCESS;
          this.isHighlighted = false;
          this.currentHighlightType = null;

          // 分類項目の選択状態もリセット
          this.resetTypeItemSelection();
        } else {
          this.classifier.highlightElements();
          highlightBtn.textContent = '🚫 ハイライト解除';
          highlightBtn.style.background = DESIGN_SYSTEM.COLORS.WARNING;
          this.isHighlighted = true;
          this.currentHighlightType = 'all';

          // 自動解除タイマー
          setTimeout(() => {
            if (this.isHighlighted && this.panel && this.currentHighlightType === 'all') {
              this.classifier.removeHighlights();
              highlightBtn.textContent = '💡 ハイライト表示';
              highlightBtn.style.background = DESIGN_SYSTEM.COLORS.SUCCESS;
              this.isHighlighted = false;
              this.currentHighlightType = null;
            }
          }, CONFIG.HIGHLIGHT_DURATION);
        }
      });

      // 結果エクスポートボタン
      this.panel.querySelector('#export-results').addEventListener('click', () => {
        this.exportResults();
      });

      // 分類項目のクリックイベント
      this.setupTypeItemClickEvents();
    }

    // 分類項目のクリックイベントを設定
    setupTypeItemClickEvents() {
      const typeItems = this.panel.querySelectorAll('.type-item');
      typeItems.forEach(item => {
        item.addEventListener('click', () => {
          const type = item.getAttribute('data-type');
          this.classifier.highlightElementsByType(type);
          this.isHighlighted = true;
          this.currentHighlightType = type;

          // すべての項目の選択状態をリセット
          typeItems.forEach(otherItem => {
            otherItem.style.opacity = '0.5';
            otherItem.style.transform = 'scale(0.98)';
          });

          // クリックされた項目を強調
          item.style.opacity = '1';
          item.style.transform = 'scale(1.02)';
          item.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';

          // 3秒後に自動的に全てを元に戻す
          setTimeout(() => {
            if (this.currentHighlightType === type) {
              this.classifier.removeHighlights();
              this.isHighlighted = false;
              this.currentHighlightType = null;

              // 項目の選択状態をリセット
              this.resetTypeItemSelection();
            }
          }, CONFIG.HIGHLIGHT_DURATION);
        });

        // ホバーエフェクト
        item.addEventListener('mouseenter', () => {
          if (item.style.opacity !== '0.5') {
            // 選択されていない場合のみ
            item.style.transform = 'scale(1.02)';
            item.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
          }
        });

        item.addEventListener('mouseleave', () => {
          if (item.style.opacity !== '0.5') {
            // 選択されていない場合のみ
            item.style.transform = 'scale(1)';
            item.style.boxShadow = '';
          }
        });
      });
    }

    // 分類項目の選択状態をリセット
    resetTypeItemSelection() {
      const typeItems = this.panel.querySelectorAll('.type-item');
      typeItems.forEach(item => {
        item.style.opacity = '1';
        item.style.transform = 'scale(1)';
        item.style.boxShadow = '';
      });
    }

    // ドラッグ機能の設定
    setupDragFunctionality() {
      const header = this.panel.querySelector('#classifier-header');

      header.addEventListener('mousedown', e => {
        if (e.target.tagName === 'BUTTON') return; // ボタンクリック時は無視

        this.isDragging = true;
        this.dragOffset.x = e.clientX - this.panel.offsetLeft;
        this.dragOffset.y = e.clientY - this.panel.offsetTop;

        header.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        e.preventDefault();
      });

      document.addEventListener('mousemove', e => {
        if (!this.isDragging) return;

        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;

        // 画面境界チェック
        const maxX = window.innerWidth - this.panel.offsetWidth;
        const maxY = window.innerHeight - this.panel.offsetHeight;

        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));

        this.panel.style.left = constrainedX + 'px';
        this.panel.style.top = constrainedY + 'px';
        this.panel.style.right = 'auto';
        this.panel.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
          header.style.cursor = 'move';
          document.body.style.userSelect = '';
        }
      });
    }

    // ウィンドウリサイズ対応
    setupWindowResize() {
      window.addEventListener('resize', () => {
        // パネルが画面外に出ないように調整
        const rect = this.panel.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;

        if (rect.left > maxX) {
          this.panel.style.left = Math.max(0, maxX) + 'px';
          this.panel.style.right = 'auto';
        }

        if (rect.top > maxY) {
          this.panel.style.top = Math.max(0, maxY) + 'px';
          this.panel.style.bottom = 'auto';
        }

        // パネルが最大サイズを超えないように調整
        const currentWidth = parseInt(this.panel.style.width) || this.panel.offsetWidth;
        const currentHeight = parseInt(this.panel.style.height) || this.panel.offsetHeight;

        if (currentWidth > window.innerWidth) {
          this.panel.style.width = window.innerWidth - 40 + 'px';
        }

        if (currentHeight > window.innerHeight) {
          this.panel.style.height = window.innerHeight - 40 + 'px';
        }
      });
    }

    // 最小化機能
    toggleMinimize() {
      const content = this.panel.querySelector('#classifier-content');
      const minimizeBtn = this.panel.querySelector('#classifier-minimize');

      if (content.style.display === 'none') {
        // 復元
        content.style.display = 'block';
        minimizeBtn.textContent = '−';
        minimizeBtn.title = '最小化';
        this.panel.style.height = '';
        this.panel.style.resize = 'both';
      } else {
        // 最小化
        content.style.display = 'none';
        minimizeBtn.textContent = '+';
        minimizeBtn.title = '復元';
        this.panel.style.height = 'auto';
        this.panel.style.resize = 'none';
      }
    }

    // 結果をエクスポート
    exportResults() {
      const stats = this.classifier.getStatistics();
      const report = this.generateReport(stats);

      // クリップボードにコピー
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(report)
          .then(() => {
            this.showNotification('📋 結果をクリップボードにコピーしました', 'success');
          })
          .catch(() => {
            this.fallbackCopy(report);
          });
      } else {
        this.fallbackCopy(report);
      }
    }

    // レポート生成
    generateReport(stats) {
      const totalElements = Object.values(stats).reduce((sum, count) => sum + count, 0);

      return `
UI ELEMENT CLASSIFICATION REPORT
===============================
URL: ${window.location.href}
Generated: ${new Date().toLocaleString()}

SUMMARY
-------
Total Elements: ${totalElements}

CLASSIFICATION RESULTS
---------------------
🧭 Navigation Elements: ${stats.navigation || 0}
� Action Elements: ${stats.action || 0}
📝 Form Elements: ${stats.form || 0}
� Toggle Elements: ${stats.toggle || 0}
❓ Unknown Elements: ${stats.unknown || 0}

RECOMMENDATIONS
--------------
- ナビゲーション要素には一貫したスタイルを適用
- アクション要素には明確な視覚的差別化を適用
- フォーム要素にはアクセシビリティ対応を確認
- トグル要素にはホバー時の状態変化を追加
- 分類不明要素の機能を確認し、適切なセマンティックマークアップを適用
      `.trim();
    }

    // フォールバック コピー
    fallbackCopy(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        this.showNotification('📋 結果をクリップボードにコピーしました', 'success');
      } catch (err) {
        this.showNotification('❌ コピーに失敗しました', 'error');
      }

      document.body.removeChild(textArea);
    }

    // 通知表示
    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      const colors = {
        success: DESIGN_SYSTEM.COLORS.SUCCESS,
        error: DESIGN_SYSTEM.COLORS.DANGER,
        info: DESIGN_SYSTEM.COLORS.INFO,
      };

      notification.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: ${colors[type]} !important;
        color: white !important;
        padding: 12px 20px !important;
        border-radius: 6px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        box-shadow: ${DESIGN_SYSTEM.SHADOWS.MEDIUM} !important;
        z-index: ${CONFIG.Z_INDEX + 1} !important;
        animation: slideDown 0.3s ease !important;
      `;

      notification.textContent = message;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease !important';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }, 3000);
    }
  }

  // CSS アニメーションを追加
  function injectAnimationCSS() {
    if (!document.getElementById('ui-classifier-animations')) {
      const style = document.createElement('style');
      style.id = 'ui-classifier-animations';
      style.textContent = `
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(0); opacity: 1; }
          to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        }

        /* UI Classifier パネル専用スタイル */
        #${CONFIG.PANEL_ID} {
          transition: box-shadow 0.2s ease !important;
        }

        #${CONFIG.PANEL_ID}:hover {
          box-shadow: 0 12px 24px rgba(0,0,0,0.25) !important;
        }

        #${CONFIG.PANEL_ID} #classifier-header:hover {
          background: rgba(0, 122, 204, 0.05) !important;
        }

        #${CONFIG.PANEL_ID} button {
          transition: all 0.2s ease !important;
        }

        #${CONFIG.PANEL_ID} button:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
        }

        #${CONFIG.PANEL_ID} button:active {
          transform: translateY(0) !important;
        }

        /* リサイズハンドル用スタイル */
        #${CONFIG.PANEL_ID}::-webkit-resizer {
          background: linear-gradient(-45deg, transparent 0%, transparent 40%, ${DESIGN_SYSTEM.COLORS.PRIMARY} 40%, ${DESIGN_SYSTEM.COLORS.PRIMARY} 60%, transparent 60%) !important;
        }

        /* スクロールバーのカスタマイズ */
        #${CONFIG.PANEL_ID} #classifier-content::-webkit-scrollbar {
          width: 6px !important;
        }

        #${CONFIG.PANEL_ID} #classifier-content::-webkit-scrollbar-track {
          background: #f1f1f1 !important;
          border-radius: 3px !important;
        }

        #${CONFIG.PANEL_ID} #classifier-content::-webkit-scrollbar-thumb {
          background: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important;
          border-radius: 3px !important;
        }

        #${CONFIG.PANEL_ID} #classifier-content::-webkit-scrollbar-thumb:hover {
          background: ${DESIGN_SYSTEM.COLORS.DARK} !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // メイン実行
  try {
    injectAnimationCSS();
    const uiManager = new UIManager();
    uiManager.createPanel();
  } catch (error) {
    console.error('UI Element Classifier Error:', error);
    alert('UI Element Classifier でエラーが発生しました:\n' + error.message);
  }

  // デバッグ用のグローバル関数を追加
  window.UIClassifierDebug = {
    enableDebug: () => {
      window.localStorage.setItem('ui-classifier-debug', 'true');
      console.log(
        '[UI Classifier] デバッグモードを有効にしました。ページを再読み込みして分析を実行してください。'
      );
    },
    disableDebug: () => {
      window.localStorage.removeItem('ui-classifier-debug');
      console.log('[UI Classifier] デバッグモードを無効にしました。');
    },
    isDebugEnabled: () => {
      return window.localStorage.getItem('ui-classifier-debug') === 'true';
    },
    analyzeDuplication: () => {
      const selector = `
        a, button, input, select, textarea, label,
        [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="radio"],
        [role="switch"], [role="option"], [role="listitem"], [role="treeitem"], [role="gridcell"],
        [onclick], [onmousedown], [onmouseup], [onkeydown], [onkeyup],
        [tabindex]:not([tabindex="-1"]),
        .btn, .button, .link, .toggle, .switch, .dropdown, .nav-link, .menu-item,
        .clickable, .interactive, .action, .control,
        span[onclick], div[onclick], li[onclick], td[onclick],
        [data-toggle], [data-dismiss], [data-target], [data-action], [triggers], [transloco], [placement]
      `.trim();

      const elements = document.querySelectorAll(selector);
      const uniqueElements = new Set(elements);

      console.log('[UI Classifier] 重複分析結果:');
      console.log(`  querySelectorAll結果: ${elements.length}個`);
      console.log(`  一意要素数: ${uniqueElements.size}個`);
      console.log(`  重複数: ${elements.length - uniqueElements.size}個`);

      // 要素ごとの詳細分析
      const elementStats = new Map();
      elements.forEach(el => {
        const key = `${el.tagName}#${el.id || 'no-id'}.${el.className || 'no-class'}`;
        elementStats.set(key, (elementStats.get(key) || 0) + 1);
      });

      const duplicates = Array.from(elementStats.entries()).filter(([key, count]) => count > 1);
      if (duplicates.length > 0) {
        console.log('  重複が検出された要素:');
        duplicates.forEach(([key, count]) => {
          console.log(`    ${key}: ${count}回`);
        });
      } else {
        console.log('  重複は検出されませんでした');
      }

      return { total: elements.length, unique: uniqueElements.size, duplicates: duplicates.length };
    },
  };

  // コンソールにデバッグ関数の使用方法を表示
  if (window.localStorage.getItem('ui-classifier-debug') === 'true') {
    console.log('%c[UI Classifier] デバッグモードが有効です', 'color: #007acc; font-weight: bold;');
    console.log('利用可能なデバッグ関数:');
    console.log('- UIClassifierDebug.enableDebug() : デバッグモードを有効にする');
    console.log('- UIClassifierDebug.disableDebug() : デバッグモードを無効にする');
    console.log('- UIClassifierDebug.analyzeDuplication() : 重複分析を実行する');
  }
})();
