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
    DEBUG_KEY: 'ui-classifier-debug',
    // セレクター設定
    INTERACTIVE_SELECTORS: [
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'label',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="switch"]',
      '[role="option"]',
      '[role="listitem"]',
      '[role="treeitem"]',
      '[role="gridcell"]',
      '[onclick]',
      '[onmousedown]',
      '[onmouseup]',
      '[onkeydown]',
      '[onkeyup]',
      '[tabindex]:not([tabindex="-1"])',
      '.btn',
      '.button',
      '.link',
      '.toggle',
      '.switch',
      '.dropdown',
      '.nav-link',
      '.menu-item',
      '.clickable',
      '.interactive',
      '.action',
      '.control',
      'span[onclick]',
      'div[onclick]',
      'li[onclick]',
      'td[onclick]',
      '[data-toggle]',
      '[data-dismiss]',
      '[data-target]',
      '[data-action]',
      '[triggers]',
      '[transloco]',
      '[placement]',
    ].join(', '),
    // 分類パターン
    CLASSIFICATION_PATTERNS: {
      STATIC_TRANSLOCO: [
        /^status\./i, // status.* (ステータス表示)
        /^report\./i, // report.* (レポート表示)
        /^label\./i, // label.* (ラベル表示)
        /^text\./i, // text.* (テキスト表示)
        /^message\./i, // message.* (メッセージ表示)
        /^info\./i, // info.* (情報表示)
        /^description\./i, // description.* (説明文)
        /^title\./i, // title.* (タイトル表示)
        /^header\./i, // header.* (ヘッダー表示)
        /^footer\./i, // footer.* (フッター表示)
      ],
      INTERACTIVE_TRANSLOCO: [
        /^action\.(save|edit|delete|cancel|confirm|submit|click|trigger|open|close)/i,
        /^button\.(save|edit|delete|cancel|confirm|submit|click|trigger|open|close)/i,
        /^menu\.(open|close|toggle|click|trigger|show|hide)/i,
      ],
      TOGGLE_CLASSES: /(^|\s|-)(?:toggle|switch|check|radio)(?:\s|-|$)/i,
      EXCLUDED_TOGGLE_CLASSES: /dropdown-toggle|modal-trigger|action-/i,
    },
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
      ACTION: '#007bff', // 青色 - アクション（赤と見分けやすく）
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
      this.previewHoverListeners = new Map(); // 常時プレビューホバーリスナーを管理
      this.isPreviewModeEnabled = false; // プレビューモードの状態
    }

    // 要素を検索・分類
    classifyElements() {
      // 無効な要素をクリーンアップ
      this.cleanupInvalidElements();

      // デバッグモードの設定
      const debugMode = this._isDebugMode();

      // 全てのインタラクティブ要素を検索
      const interactiveElements = document.querySelectorAll(CONFIG.INTERACTIVE_SELECTORS);

      if (debugMode) {
        console.log(
          `[UI Classifier Debug] querySelectorAllで検出された要素数: ${interactiveElements.length}`
        );
      }

      // 重複排除して要素を処理
      const stats = this._processElements(interactiveElements, debugMode);

      // 統計情報をログ出力
      this._logStatistics(stats, debugMode);

      return this.classifications;
    }

    // デバッグモードかどうかを判定
    _isDebugMode() {
      return window.localStorage?.getItem(CONFIG.DEBUG_KEY) === 'true';
    }

    // 要素を処理し、重複を排除
    _processElements(interactiveElements, debugMode) {
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
            this._logElementInfo(element);
          }
        } else {
          duplicateCount++;
          if (debugMode) {
            console.warn(`[UI Classifier Debug] 重複要素をスキップ:`, element);
          }
        }
      });

      return {
        totalFound: interactiveElements.length,
        actualProcessed: this.elements.length,
        duplicateCount,
      };
    }

    // 要素情報をログ出力
    _logElementInfo(element) {
      const elementInfo = `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}${element.className ? '.' + element.className.split(' ').join('.') : ''}`;
      console.log(`[UI Classifier Debug] 分類中: ${elementInfo}`);
    }

    // 統計情報をログ出力
    _logStatistics(stats, debugMode) {
      if (debugMode || stats.duplicateCount > 0) {
        console.log(`[UI Classifier] 処理統計:`);
        console.log(`  検出要素数: ${stats.totalFound}`);
        console.log(`  処理要素数: ${stats.actualProcessed}`);
        console.log(`  重複排除数: ${stats.duplicateCount}`);
        console.log(
          `  分類結果: ナビ${this.classifications.navigation.length}, アクション${this.classifications.action.length}, フォーム${this.classifications.form.length}, 切替${this.classifications.toggle.length}, 不明${this.classifications.unknown.length}`
        );
      }
    }

    // 静的なtranslocoテキストかどうかを判定
    isStaticTranslocoText(translocoValue, element) {
      if (!translocoValue) return false;

      // button要素は常にアクション要素として扱う
      if (element.tagName.toLowerCase() === 'button') {
        return false;
      }

      // インタラクティブなアクション系パターンを先にチェック（優先）
      if (
        CONFIG.CLASSIFICATION_PATTERNS.INTERACTIVE_TRANSLOCO.some(pattern =>
          pattern.test(translocoValue)
        )
      ) {
        return false; // インタラクティブ要素
      }

      // 静的表示用のtranslocoパターンをチェック
      if (
        CONFIG.CLASSIFICATION_PATTERNS.STATIC_TRANSLOCO.some(pattern =>
          pattern.test(translocoValue)
        )
      ) {
        return true;
      }

      // 要素の内容とコンテキストによる追加判定
      return this._isStaticByContext(element);
    }

    // コンテキストによる静的要素判定
    _isStaticByContext(element) {
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

      return !hasInteractiveAttributes;
    }

    // 個別要素の分類
    classifyElement(element) {
      const elementInfo = this._extractElementInfo(element);

      // 分類の優先順位に従って判定
      if (this._isToggleElement(elementInfo)) {
        this._addToClassification('toggle', element, '切り替え要素');
        return;
      }

      if (this._isFormElement(elementInfo)) {
        const isContentEditable = element.hasAttribute('contenteditable');
        this._addToClassification(
          'form',
          element,
          isContentEditable
            ? 'フォーム要素: 編集可能コンテンツ'
            : `フォーム要素: ${elementInfo.type || elementInfo.tagName}`,
          isContentEditable ? 'contenteditable' : elementInfo.type || elementInfo.tagName
        );
        return;
      }

      // 特別なリンク要素をアクション要素として処理
      if (this._isSpecialLinkAction(elementInfo)) {
        this._addToClassification(
          'action',
          element,
          elementInfo.role === 'button' ? 'リンクボタン' : 'アクション要素'
        );
        return;
      }

      if (this._isNavigationElement(elementInfo)) {
        const navResult = this._classifyNavigationElement(elementInfo);
        this._addToClassification('navigation', element, navResult.description, navResult.subType);
        return;
      }

      if (this._isActionElement(elementInfo)) {
        this._addToClassification('action', element, 'アクション要素');
        return;
      }

      // 分類不明
      this._addToClassification('unknown', element, '分類不明');
    }

    // 要素情報を抽出
    _extractElementInfo(element) {
      return {
        element,
        tagName: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        type: element.getAttribute('type'),
        href: element.getAttribute('href'),
        onclick: element.getAttribute('onclick') || element.onclick,
        className: element.className || '',
        dataAttributes: [...element.attributes].filter(
          attr =>
            attr.name.startsWith('data-') ||
            attr.name.match(/^(transloco|containerclass|triggers|placement)$/)
        ),
      };
    }

    // 分類結果を追加
    _addToClassification(type, element, description, subType = null) {
      const classificationItem = {
        element,
        type,
        description,
      };

      if (subType) {
        classificationItem.subType = subType;
      }

      this.classifications[type].push(classificationItem);
    }

    // 切り替え要素の判定
    _isToggleElement({ tagName, type, role, className, dataAttributes }) {
      // 基本的な切り替え要素
      if (
        (type === 'checkbox' && tagName === 'input') ||
        (type === 'radio' && tagName === 'input') ||
        role === 'switch' ||
        role === 'checkbox' ||
        role === 'radio'
      ) {
        return true;
      }

      // クラス名による判定（除外パターンをチェック）
      if (
        className.match(CONFIG.CLASSIFICATION_PATTERNS.TOGGLE_CLASSES) &&
        !className.match(CONFIG.CLASSIFICATION_PATTERNS.EXCLUDED_TOGGLE_CLASSES)
      ) {
        return true;
      }

      // データ属性による判定
      return dataAttributes.some(
        attr =>
          attr.name.match(/switch/i) ||
          (attr.name === 'data-toggle' &&
            attr.value &&
            ['switch', 'checkbox', 'radio'].includes(attr.value.toLowerCase()))
      );
    }

    // フォーム要素の判定
    _isFormElement({ tagName, type, element }) {
      // contenteditable要素
      if (
        element.hasAttribute('contenteditable') ||
        element.getAttribute('contenteditable') === 'true'
      ) {
        return true;
      }

      // 基本的なフォーム要素（submit/button/reset typeのinputは除外）
      return (
        ['input', 'select', 'textarea'].includes(tagName) &&
        !['submit', 'button', 'reset'].includes(type)
      );
    }

    // 特別なリンク要素のアクション判定
    _isSpecialLinkAction({ tagName, role, href }) {
      if (tagName !== 'a') return false;

      // role="button"が設定されているリンクはアクション要素
      if (role === 'button') {
        return true;
      }

      // href="#"はアクション要素として扱う
      if (href === '#') {
        return true;
      }

      return false;
    }

    // ナビゲーション要素の判定
    _isNavigationElement({ tagName, role, href, className, element }) {
      // リンク要素
      if (tagName === 'a' && href && href !== '') {
        return true;
      }

      // role属性や親要素による判定
      return (
        role === 'link' ||
        element.closest('nav') ||
        element.closest('[role="navigation"]') ||
        className.match(/nav|menu|breadcrumb|tab/i) ||
        (tagName === 'li' && className.match(/tab|nav/i)) ||
        (tagName === 'li' && element.hasAttribute('tabindex'))
      );
    }

    // ナビゲーション要素の詳細分類
    _classifyNavigationElement({ tagName, href }) {
      // リンク要素の場合
      if (tagName === 'a' && href && href !== '') {
        const isExternal = href.startsWith('http') || href.startsWith('//');
        const isAnchor = href.startsWith('#');
        const isSpecial = href.startsWith('mailto:') || href.startsWith('tel:');

        const subType = isExternal
          ? 'external'
          : isAnchor
            ? 'anchor'
            : isSpecial
              ? 'special'
              : 'internal';

        const description = isExternal
          ? '外部リンク'
          : isAnchor
            ? 'アンカーリンク'
            : isSpecial
              ? '特殊リンク'
              : '内部リンク';

        return { subType, description };
      }

      // その他のナビゲーション要素
      return { description: 'ナビゲーション要素' };
    }

    // アクション要素の判定
    _isActionElement({ tagName, role, onclick, className, dataAttributes, href, element }) {
      // 基本的なアクション要素
      if (
        tagName === 'button' ||
        role === 'button' ||
        role === 'tab' ||
        role === 'menuitem' ||
        onclick ||
        tagName === 'summary'
      ) {
        return true;
      }

      // テーブル要素でクリック可能
      if ((tagName === 'th' || tagName === 'td') && onclick) {
        return true;
      }

      // hrefがない、空、またはアンカーのみのaタグ
      if (tagName === 'a' && (!href || href === '' || href === '#')) {
        return true;
      }

      // role="button"が設定されているリンク
      if (tagName === 'a' && role === 'button') {
        return true;
      }

      // クラス名による判定
      if (className.match(/btn|button|action|dropdown-toggle|modal-trigger/i)) {
        return true;
      }

      // データ属性による判定
      return dataAttributes.some(
        attr =>
          attr.name.match(/action|target|trigger|popover|placement/i) ||
          (attr.name === 'transloco' &&
            ['a', 'button', 'div', 'span'].includes(tagName) &&
            !className.match(/control-label|form-control-static|label|text-only|display-only/i) &&
            !this.isStaticTranslocoText(attr.value, element))
      );
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

    // プレビューホバーエフェクトを有効化
    enablePreviewHover() {
      this.isPreviewModeEnabled = true;
      Object.entries(this.classifications).forEach(([type, elements]) => {
        elements.forEach(({ element }) => {
          this.addPreviewHoverEffect(element, type);
        });
      });
    }

    // プレビューホバーエフェクトを無効化
    disablePreviewHover() {
      this.isPreviewModeEnabled = false;
      this.previewHoverListeners.forEach((listeners, element) => {
        element.removeEventListener('mouseenter', listeners.mouseenter);
        element.removeEventListener('mouseleave', listeners.mouseleave);

        // タイマーがあればクリア
        if (listeners.timerManager) {
          listeners.timerManager.clearTimer();
        }

        // 一時的なスタイルがあれば元に戻す
        if (element._tempPreviewStyles) {
          Object.assign(element.style, element._tempPreviewStyles);
          delete element._tempPreviewStyles;
        }

        // 必要に応じて即座にリセット
        if (listeners.resetHoverEffect) {
          listeners.resetHoverEffect();
        }
      });
      this.previewHoverListeners.clear();
    } // プレビューホバーエフェクトを追加
    addPreviewHoverEffect(element, type) {
      // 既存のプレビューホバーリスナーを削除
      this.removePreviewHoverListeners(element);

      const colorMap = {
        navigation: DESIGN_SYSTEM.COLORS.NAVIGATION,
        action: DESIGN_SYSTEM.COLORS.ACTION,
        form: DESIGN_SYSTEM.COLORS.FORM,
        toggle: DESIGN_SYSTEM.COLORS.TOGGLE,
        unknown: DESIGN_SYSTEM.COLORS.UNKNOWN,
      };

      const color = colorMap[type] || DESIGN_SYSTEM.COLORS.SECONDARY;

      // タイマーを外部で管理するためのオブジェクト
      const timerManager = {
        autoResetTimer: null,
        clearTimer: function () {
          if (this.autoResetTimer) {
            clearTimeout(this.autoResetTimer);
            this.autoResetTimer = null;
          }
        },
      };

      const applyHoverEffect = () => {
        if (!this.originalStyles.has(element)) {
          // 現在のスタイルを一時保存
          const tempStyles = {
            outline: element.style.outline,
            backgroundColor: element.style.backgroundColor,
            boxShadow: element.style.boxShadow,
            transform: element.style.transform,
            transition: element.style.transition,
            filter: element.style.filter,
          };

          // 薄い背景色とボーダーでプレビュー表示
          element.style.backgroundColor = `${color}15`; // 透明度15%（少し濃く）
          element.style.outline = `2px solid ${color}50`; // 透明度50%（少し濃く）
          element.style.boxShadow = `0 0 8px ${color}40, inset 0 0 20px ${color}10`; // より目立つグロー
          element.style.transform = 'scale(1.02)'; // 少し大きく
          element.style.transition = 'all 0.2s ease-out';
          element.style.filter = 'brightness(1.08)'; // より明度アップ

          // 一時的にスタイルを保存
          element._tempPreviewStyles = tempStyles;
        }
      };

      const resetHoverEffect = () => {
        if (!this.originalStyles.has(element) && element._tempPreviewStyles) {
          // プレビュー前のスタイルに戻す（スムーズなアニメーション付き）
          element.style.transition = 'all 0.3s ease-in';
          Object.assign(element.style, element._tempPreviewStyles);
          delete element._tempPreviewStyles;
        }
        // タイマーをクリア
        timerManager.clearTimer();
      };

      const mouseEnterHandler = e => {
        // 既存のタイマーをクリア
        timerManager.clearTimer();

        applyHoverEffect();

        // 2秒後に自動的に元に戻す
        timerManager.autoResetTimer = setTimeout(() => {
          resetHoverEffect();
        }, 2000);
      };

      const mouseLeaveHandler = e => {
        // ホバーが外れたら即座に元に戻す
        resetHoverEffect();
      };

      element.addEventListener('mouseenter', mouseEnterHandler);
      element.addEventListener('mouseleave', mouseLeaveHandler);

      // リスナーを保存（タイマー管理オブジェクトも含める）
      this.previewHoverListeners.set(element, {
        mouseenter: mouseEnterHandler,
        mouseleave: mouseLeaveHandler,
        timerManager: timerManager,
        resetHoverEffect: resetHoverEffect, // 直接参照を保存
      });
    }

    // プレビューホバーリスナーを削除
    removePreviewHoverListeners(element) {
      const listeners = this.previewHoverListeners.get(element);
      if (listeners) {
        element.removeEventListener('mouseenter', listeners.mouseenter);
        element.removeEventListener('mouseleave', listeners.mouseleave);

        // タイマーがあればクリア
        if (listeners.timerManager) {
          listeners.timerManager.clearTimer();
        }

        // 一時的なスタイルがあれば元に戻す
        if (element._tempPreviewStyles) {
          Object.assign(element.style, element._tempPreviewStyles);
          delete element._tempPreviewStyles;
        }

        // 必要に応じて即座にリセット
        if (listeners.resetHoverEffect) {
          listeners.resetHoverEffect();
        }

        this.previewHoverListeners.delete(element);
      }
    }

    // 無効になった要素をクリーンアップ
    cleanupInvalidElements() {
      // 無効な要素のプレビューホバーリスナーをクリーンアップ
      this.previewHoverListeners.forEach((listeners, element) => {
        if (!document.contains(element)) {
          // 要素がDOMから削除されている場合
          if (listeners.timerManager) {
            listeners.timerManager.clearTimer();
          }
          this.previewHoverListeners.delete(element);
        }
      });

      // 無効な要素のハイライトもクリーンアップ
      this.originalStyles.forEach((styles, element) => {
        if (!document.contains(element)) {
          this.originalStyles.delete(element);
        }
      });

      // 無効な要素のホバーリスナーもクリーンアップ
      this.hoverListeners.forEach((listeners, element) => {
        if (!document.contains(element)) {
          this.hoverListeners.delete(element);
        }
      });
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
      this.currentUrl = window.location.href; // 現在のURL
      this.urlCheckInterval = null; // URL監視用インターバル
      this.isAutoRefreshEnabled = true; // 自動再分析の有効/無効
      this.isPreviewModeEnabled = false; // プレビューモードの有効/無効
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
        this.stopUrlMonitoring(); // URL監視を停止
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
      this.startUrlMonitoring(); // URL監視を開始

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
          ${this._generatePanelHeader()}
          ${this._generatePanelBody(totalElements, stats, classifications)}
        </div>
      `;
    }

    // パネルヘッダーを生成
    _generatePanelHeader() {
      return `
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
      `;
    }

    // パネルボディを生成
    _generatePanelBody(totalElements, stats, classifications) {
      return `
        <!-- スクロール可能なコンテンツエリア -->
        <div id="classifier-content" style="flex: 1 !important; overflow-y: auto !important; padding: 20px !important;">
          ${this._generateStatisticsSection(totalElements)}
          ${this._generateClassificationSection(stats, classifications)}
          ${this._generateActionButtonsSection()}
          ${this._generateLegendSection()}
        </div>
      `;
    }

    // 統計情報セクションを生成
    _generateStatisticsSection(totalElements) {
      return `
        <!-- 統計情報 -->
        <div style="margin-bottom: 20px !important; padding: 15px !important; background: ${DESIGN_SYSTEM.COLORS.LIGHT} !important; border-radius: 8px !important;">
          <h4 style="margin: 0 0 10px 0 !important; color: ${DESIGN_SYSTEM.COLORS.DARK} !important; font-size: 16px !important;">📊 検出統計</h4>
          <div style="font-size: 13px !important;">
            <div><strong>総要素数:</strong> ${totalElements}</div>
          </div>
        </div>
      `;
    }

    // 分類結果セクションを生成
    _generateClassificationSection(stats, classifications) {
      return `
        <!-- 要素タイプ別統計 -->
        <div style="margin-bottom: 20px !important;">
          <h4 style="margin: 0 0 15px 0 !important; color: ${DESIGN_SYSTEM.COLORS.DARK} !important; font-size: 16px !important;">🏷️ 分類結果</h4>
          ${this.generateTypesList(stats, classifications)}
        </div>
      `;
    }

    // アクションボタンセクションを生成
    _generateActionButtonsSection() {
      return `
        <!-- アクションボタン -->
        <div style="margin-bottom: 20px !important; padding-top: 15px !important; border-top: 1px solid #eee !important;">
          <div style="display: flex !important; gap: 8px !important; flex-wrap: wrap !important; margin-bottom: 10px !important;">
            <button id="toggle-highlight" style="background: ${DESIGN_SYSTEM.COLORS.SUCCESS} !important; color: white !important; border: none !important; border-radius: 6px !important; padding: 8px 12px !important; cursor: pointer !important; font-size: 12px !important; flex: 1 !important;">
              💡 ハイライト表示
            </button>
            <button id="export-results" style="background: ${DESIGN_SYSTEM.COLORS.INFO} !important; color: white !important; border: none !important; border-radius: 6px !important; padding: 8px 12px !important; cursor: pointer !important; font-size: 12px !important; flex: 1 !important;">
              📋 結果コピー
            </button>
          </div>
          <div style="display: flex !important; gap: 8px !important; flex-wrap: wrap !important; margin-bottom: 10px !important;">
            <button id="toggle-preview-hover" style="background: #8e44ad !important; color: white !important; border: none !important; border-radius: 6px !important; padding: 8px 12px !important; cursor: pointer !important; font-size: 12px !important; flex: 1 !important;" title="ホバー時の色プレビューのオン/オフ">
              ✨ プレビュー: OFF
            </button>
            <button id="refresh-analysis" style="background: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; color: white !important; border: none !important; border-radius: 6px !important; padding: 8px 12px !important; cursor: pointer !important; font-size: 12px !important; flex: 1 !important;" title="手動で再分析を実行">
              🔄 再分析
            </button>
          </div>
          <div style="display: flex !important; gap: 8px !important; flex-wrap: wrap !important;">
            <button id="toggle-auto-refresh" style="background: ${DESIGN_SYSTEM.COLORS.SECONDARY} !important; color: white !important; border: none !important; border-radius: 6px !important; padding: 8px 12px !important; cursor: pointer !important; font-size: 12px !important; flex: 1 !important;" title="ページ遷移時の自動再分析のオン/オフ">
              🔁 自動更新: ON
            </button>
          </div>
        </div>
      `;
    }

    // 凡例セクションを生成
    _generateLegendSection() {
      return `
        <!-- 凡例 -->
        <div style="padding: 15px !important; background: #f8f9fa !important; border-radius: 8px !important; font-size: 12px !important;">
          <h5 style="margin: 0 0 10px 0 !important; color: ${DESIGN_SYSTEM.COLORS.DARK} !important;">🎨 カラーコード凡例</h5>
          ${this.generateLegend()}
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
        this.stopUrlMonitoring(); // URL監視を停止
        if (this.isHighlighted) {
          this.classifier.removeHighlights();
        }
        if (this.isPreviewModeEnabled) {
          this.classifier.disablePreviewHover();
        }
        this.panel.remove();
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

      // 再分析ボタン
      this.panel.querySelector('#refresh-analysis').addEventListener('click', () => {
        this.refreshAnalysis();
      });

      // 自動更新トグルボタン
      this.panel.querySelector('#toggle-auto-refresh').addEventListener('click', () => {
        this.toggleAutoRefresh();
      });

      // プレビューモードトグルボタン
      this.panel.querySelector('#toggle-preview-hover').addEventListener('click', () => {
        this.togglePreviewMode();
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

    /**
     * URL監視を開始
     * ページ遷移やSPA内での遷移を検出して自動再分析
     */
    startUrlMonitoring() {
      // 既存の監視を停止
      this.stopUrlMonitoring();

      if (!this.isAutoRefreshEnabled) return;

      // 定期的にURLをチェック（SPAでのURL変更を検出）
      this.urlCheckInterval = setInterval(() => {
        const newUrl = window.location.href;
        if (newUrl !== this.currentUrl) {
          this.currentUrl = newUrl;
          this.onUrlChange();
        }
      }, 1000); // 1秒間隔でチェック

      // Popstate イベント（ブラウザの戻る/進むボタン）
      window.addEventListener('popstate', this.onUrlChange.bind(this));

      // History API の監視（pushState/replaceState）
      this.monitorHistoryChanges();
    }

    /**
     * URL監視を停止
     */
    stopUrlMonitoring() {
      if (this.urlCheckInterval) {
        clearInterval(this.urlCheckInterval);
        this.urlCheckInterval = null;
      }
      window.removeEventListener('popstate', this.onUrlChange.bind(this));
    }

    /**
     * History API の変更を監視
     */
    monitorHistoryChanges() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        setTimeout(() => this.onUrlChange(), 100); // 少し遅延させてDOM更新を待つ
      };

      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        setTimeout(() => this.onUrlChange(), 100);
      };
    }

    /**
     * URL変更時の処理
     */
    onUrlChange() {
      if (!this.isAutoRefreshEnabled || !this.panel) return;

      this.showNotification('🔄 ページ遷移を検出しました。分析を更新中...', 'info');

      // 少し遅延させてDOM更新を待つ
      setTimeout(() => {
        this.refreshAnalysis(false); // 通知なしで実行
      }, 500);
    }

    /**
     * 分析をリフレッシュ
     */
    refreshAnalysis(showNotification = true) {
      if (!this.panel) return;

      try {
        // 現在のハイライトを削除
        if (this.isHighlighted) {
          this.classifier.removeHighlights();
        }

        // 現在のプレビューモード状態を保存
        const wasPreviewModeEnabled = this.isPreviewModeEnabled;

        // プレビューモードが有効な場合は一旦無効化
        if (wasPreviewModeEnabled) {
          this.classifier.disablePreviewHover();
        }

        // 分類器をリセット
        this.classifier = new UIElementClassifier();

        // 新しい分析を実行
        const classifications = this.classifier.classifyElements();
        const stats = this.classifier.getStatistics();

        // パネルのコンテンツを更新
        this.updatePanelContent(stats, classifications);

        // プレビューモードの状態を復元
        if (wasPreviewModeEnabled) {
          this.isPreviewModeEnabled = true;
          this.classifier.enablePreviewHover();
          this.updatePreviewModeButtonDisplay();
        }

        // 状態をリセット
        this.isHighlighted = false;
        this.currentHighlightType = null;

        if (showNotification) {
          this.showNotification('✅ 分析が完了しました', 'success');
        }
      } catch (error) {
        console.error('[UI Classifier] 再分析エラー:', error);
        if (showNotification) {
          this.showNotification('❌ 分析の更新に失敗しました', 'error');
        }
      }
    }

    /**
     * パネルコンテンツを更新
     */
    updatePanelContent(stats, classifications) {
      const totalElements = Object.values(stats).reduce((sum, count) => sum + count, 0);

      // 統計情報セクションを更新
      const statsSection = this.panel.querySelector('#classifier-content');
      if (statsSection) {
        statsSection.innerHTML = `
          ${this._generateStatisticsSection(totalElements)}
          ${this._generateClassificationSection(stats, classifications)}
          ${this._generateActionButtonsSection()}
          ${this._generateLegendSection()}
        `;

        // イベントリスナーを再設定
        this.reattachContentEventListeners();

        // 注意: プレビューモードの復元は refreshAnalysis で行うため、ここでは行わない
      }
    }

    /**
     * コンテンツ部分のイベントリスナーを再設定
     */
    reattachContentEventListeners() {
      // ハイライト切り替えボタン
      const highlightBtn = this.panel.querySelector('#toggle-highlight');
      if (highlightBtn) {
        highlightBtn.addEventListener('click', () => {
          if (this.isHighlighted) {
            this.classifier.removeHighlights();
            highlightBtn.textContent = '💡 ハイライト表示';
            highlightBtn.style.background = DESIGN_SYSTEM.COLORS.SUCCESS;
            this.isHighlighted = false;
            this.currentHighlightType = null;
            this.resetTypeItemSelection();
          } else {
            this.classifier.highlightElements();
            highlightBtn.textContent = '🚫 ハイライト解除';
            highlightBtn.style.background = DESIGN_SYSTEM.COLORS.WARNING;
            this.isHighlighted = true;
            this.currentHighlightType = 'all';

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
      }

      // 結果エクスポートボタン
      const exportBtn = this.panel.querySelector('#export-results');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          this.exportResults();
        });
      }

      // 再分析ボタン
      const refreshBtn = this.panel.querySelector('#refresh-analysis');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this.refreshAnalysis();
        });
      }

      // 自動更新トグルボタン
      const autoRefreshBtn = this.panel.querySelector('#toggle-auto-refresh');
      if (autoRefreshBtn) {
        autoRefreshBtn.addEventListener('click', () => {
          this.toggleAutoRefresh();
        });
        // ボタンの表示を現在の状態に合わせて更新
        this.updateAutoRefreshButtonDisplay();
      }

      // プレビューモードトグルボタン
      const previewBtn = this.panel.querySelector('#toggle-preview-hover');
      if (previewBtn) {
        previewBtn.addEventListener('click', () => {
          this.togglePreviewMode();
        });
        // ボタンの表示を現在の状態に合わせて更新
        this.updatePreviewModeButtonDisplay();
      }

      // 分類項目のクリックイベント
      this.setupTypeItemClickEvents();
    }

    /**
     * 自動更新機能のオン/オフ切り替え
     */
    toggleAutoRefresh() {
      this.isAutoRefreshEnabled = !this.isAutoRefreshEnabled;

      if (this.isAutoRefreshEnabled) {
        this.startUrlMonitoring();
        this.showNotification('🔁 自動更新が有効になりました', 'success');
      } else {
        this.stopUrlMonitoring();
        this.showNotification('⏹️ 自動更新が無効になりました', 'info');
      }

      this.updateAutoRefreshButtonDisplay();
    }

    /**
     * 自動更新ボタンの表示を更新
     */
    updateAutoRefreshButtonDisplay() {
      const autoRefreshBtn = this.panel.querySelector('#toggle-auto-refresh');
      if (autoRefreshBtn) {
        autoRefreshBtn.textContent = `🔁 自動更新: ${this.isAutoRefreshEnabled ? 'ON' : 'OFF'}`;
        autoRefreshBtn.style.background = this.isAutoRefreshEnabled
          ? DESIGN_SYSTEM.COLORS.SECONDARY
          : DESIGN_SYSTEM.COLORS.WARNING;
      }
    }

    /**
     * プレビューモードの切り替え
     */
    togglePreviewMode() {
      this.isPreviewModeEnabled = !this.isPreviewModeEnabled;

      if (this.isPreviewModeEnabled) {
        this.classifier.enablePreviewHover();
        this.showNotification('✨ プレビューモードを有効にしました', 'success');
      } else {
        this.classifier.disablePreviewHover();
        this.showNotification('✨ プレビューモードを無効にしました', 'info');
      }

      this.updatePreviewModeButtonDisplay();
    }

    /**
     * プレビューモードボタンの表示を更新
     */
    updatePreviewModeButtonDisplay() {
      const previewBtn = this.panel.querySelector('#toggle-preview-hover');
      if (previewBtn) {
        previewBtn.textContent = `✨ プレビュー: ${this.isPreviewModeEnabled ? 'ON' : 'OFF'}`;
        previewBtn.style.background = this.isPreviewModeEnabled
          ? '#27ae60' // 緑色（有効）
          : '#8e44ad'; // 紫色（無効）
      }
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
