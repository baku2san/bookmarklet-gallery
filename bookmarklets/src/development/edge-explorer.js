/**
 * Edge Explorer Bookmarklet
 * Microsoft Edge ブラウザの機能探索・検証ツール
 *
 * 機能:
 * - Edge ブラウザの検出と情報取得
 * - 利用可能な Web API と Edge 固有機能の調査
 * - パフォーマンス情報とメモリ使用量
 * - Edge 拡張機能関連の検出
 * - ブラウザ制約の可視化
 */

javascript: (() => {
  'use strict';

  // =============================================================================
  // 定数定義
  // =============================================================================
  const CONSTANTS = {
    PANEL_ID: 'shima-edge-explorer-panel',
    Z_INDEX: 2147483647,
    PANEL_WIDTH: '900px',
    PANEL_HEIGHT: '700px',
  };

  // デザインシステム（Fluent Design準拠）
  const DESIGN_SYSTEM = {
    COLORS: {
      PRIMARY: '#0078d4',
      PRIMARY_HOVER: '#106ebe',
      SUCCESS: '#107c10',
      WARNING: '#ff8c00',
      DANGER: '#d13438',
      BACKGROUND: {
        PRIMARY: '#ffffff',
        SECONDARY: '#f8f9fa',
        TERTIARY: '#f3f2f1',
        ACCENT: '#faf9f8',
      },
      TEXT: {
        PRIMARY: '#323130',
        SECONDARY: '#605e5c',
        MUTED: '#8a8886',
        INVERSE: '#ffffff',
      },
      BORDER: {
        DEFAULT: '#d2d0ce',
        SUBTLE: '#edebe9',
      },
    },
    SPACING: {
      XS: '4px',
      SM: '8px',
      MD: '12px',
      LG: '16px',
      XL: '20px',
      XXL: '24px',
    },
    BORDER_RADIUS: {
      SM: '4px',
      MD: '6px',
      LG: '8px',
    },
    SHADOWS: {
      CARD: '0 1px 3px rgba(0, 0, 0, 0.1)',
      PANEL: '0 8px 24px rgba(0, 0, 0, 0.15)',
      FOCUS: '0 0 0 2px rgba(0, 120, 212, 0.3)',
    },
    TYPOGRAPHY: {
      FONT_FAMILY:
        '"Segoe UI", "Segoe UI Web (West European)", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", sans-serif',
      SIZES: {
        H1: '20px',
        H2: '16px',
        H3: '14px',
        BODY: '14px',
        SMALL: '12px',
        CAPTION: '11px',
      },
      WEIGHTS: {
        REGULAR: '400',
        SEMIBOLD: '600',
        BOLD: '700',
      },
    },
    TRANSITIONS: {
      DEFAULT: '0.2s ease',
      FAST: '0.1s ease',
      SLOW: '0.3s ease',
    },
  };

  // =============================================================================
  // Edge検出・分析クラス
  // =============================================================================
  class EdgeAnalyzer {
    constructor() {
      this.results = {
        browser: {},
        apis: {},
        performance: {},
        extensions: {},
        limitations: [],
      };
    }

    // Edge ブラウザ検出
    detectEdge() {
      const userAgent = navigator.userAgent;
      const isEdge = /Edg\//.test(userAgent);
      const isEdgeLegacy = /Edge\//.test(userAgent);
      const isChromiumBased = /Chrome\//.test(userAgent) && isEdge;

      this.results.browser = {
        isEdge: isEdge || isEdgeLegacy,
        isEdgeLegacy,
        isChromiumBased,
        userAgent,
        version: this.extractVersion(userAgent),
        engine: isChromiumBased ? 'Chromium/Blink' : isEdgeLegacy ? 'EdgeHTML' : 'Unknown',
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages || [],
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
        maxTouchPoints: navigator.maxTouchPoints || 0,
        vendor: navigator.vendor || 'Unknown',
        vendorSub: navigator.vendorSub || 'Unknown',
      };
    }

    // バージョン抽出
    extractVersion(userAgent) {
      let version = 'Unknown';
      if (/Edg\//.test(userAgent)) {
        const match = userAgent.match(/Edg\/([0-9.]+)/);
        version = match ? match[1] : 'Unknown';
      } else if (/Edge\//.test(userAgent)) {
        const match = userAgent.match(/Edge\/([0-9.]+)/);
        version = match ? match[1] : 'Unknown';
      }
      return version;
    }

    // Web API 調査
    analyzeWebAPIs() {
      const apiChecks = {
        // 基本 API
        'Clipboard API': 'navigator.clipboard',
        'Geolocation API': 'navigator.geolocation',
        'Notification API': 'window.Notification',
        'Service Worker': 'navigator.serviceWorker',
        'Web Workers': 'window.Worker',
        WebAssembly: 'window.WebAssembly',
        'Fetch API': 'window.fetch',
        WebRTC: 'window.RTCPeerConnection',
        'Web Storage': 'window.localStorage',
        IndexedDB: 'window.indexedDB',
        WebGL: 'window.WebGLRenderingContext',
        'Web Audio': 'window.AudioContext || window.webkitAudioContext',
        'Fullscreen API': 'document.fullscreenEnabled',
        'Page Visibility': 'document.visibilityState',
        'Battery API': 'navigator.getBattery',
        'Vibration API': 'navigator.vibrate',
        'Device Orientation': 'window.DeviceOrientationEvent',
        'Device Motion': 'window.DeviceMotionEvent',

        // Edge/Chrome 特有
        'Chrome Runtime': 'window.chrome',
        'Chrome Extensions': 'window.chrome && window.chrome.runtime',
        'Performance Observer': 'window.PerformanceObserver',
        'Intersection Observer': 'window.IntersectionObserver',
        'Mutation Observer': 'window.MutationObserver',
        'Resize Observer': 'window.ResizeObserver',
        'Payment Request': 'window.PaymentRequest',
        'Web Authentication': 'navigator.credentials',
        'Background Sync':
          'window.ServiceWorkerRegistration && window.ServiceWorkerRegistration.prototype.sync',
        'Push Manager': 'window.PushManager',
        'Media Devices': 'navigator.mediaDevices',
        'Picture in Picture': 'document.pictureInPictureEnabled',
        'Web Share': 'navigator.share',
        'Wake Lock': 'navigator.wakeLock',

        // 実験的機能
        'File System Access': 'window.showOpenFilePicker',
        'Web Locks': 'navigator.locks',
        'Persistent Storage': 'navigator.storage && navigator.storage.persist',
        'Storage Manager': 'navigator.storage',
        'Permissions API': 'navigator.permissions',
        'Network Information': 'navigator.connection',
        'Screen Orientation': 'screen.orientation',
        'Speech Recognition': 'window.SpeechRecognition || window.webkitSpeechRecognition',
        'Speech Synthesis': 'window.speechSynthesis',
        'Web Bluetooth': 'navigator.bluetooth',
        'Web USB': 'navigator.usb',
        'Web HID': 'navigator.hid',
        'Web Serial': 'navigator.serial',
        'Gamepad API': 'navigator.getGamepads',
        'Sensor APIs': 'window.Accelerometer || window.Gyroscope',
        'Web VR/XR': 'navigator.xr || navigator.getVRDisplays',
      };

      this.results.apis = {};
      for (const [name, check] of Object.entries(apiChecks)) {
        try {
          this.results.apis[name] = {
            available: !!eval(check),
            value: this.getAPIValue(check),
          };
        } catch (e) {
          this.results.apis[name] = {
            available: false,
            error: e.message,
          };
        }
      }
    }

    // API値取得
    getAPIValue(check) {
      try {
        const value = eval(check);
        if (typeof value === 'function') return 'Function';
        if (typeof value === 'object' && value !== null) return 'Object';
        return value;
      } catch (e) {
        return null;
      }
    }

    // パフォーマンス情報取得
    analyzePerformance() {
      this.results.performance = {
        timing: performance.timing ? this.getTimingInfo() : null,
        navigation: performance.navigation
          ? {
              type: performance.navigation.type,
              redirectCount: performance.navigation.redirectCount,
            }
          : null,
        memory: performance.memory
          ? {
              usedJSHeapSize: this.formatBytes(performance.memory.usedJSHeapSize),
              totalJSHeapSize: this.formatBytes(performance.memory.totalJSHeapSize),
              jsHeapSizeLimit: this.formatBytes(performance.memory.jsHeapSizeLimit),
            }
          : null,
        timeOrigin: performance.timeOrigin,
        now: Math.round(performance.now()),
        entries: performance.getEntries ? performance.getEntries().length : 0,
      };
    }

    // タイミング情報取得
    getTimingInfo() {
      const timing = performance.timing;
      return {
        navigationStart: timing.navigationStart,
        domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
        loadEventEnd: timing.loadEventEnd,
        domComplete: timing.domComplete,
        domInteractive: timing.domInteractive,
        pageLoadTime: timing.loadEventEnd - timing.navigationStart,
        domReadyTime: timing.domContentLoadedEventEnd - timing.navigationStart,
      };
    }

    // 拡張機能検出
    analyzeExtensions() {
      this.results.extensions = {
        chromeExtensions: !!window.chrome && !!window.chrome.runtime,
        extensionInfo: this.getExtensionInfo(),
        webStoreAccess: this.checkWebStoreAccess(),
      };
    }

    // 拡張機能情報取得
    getExtensionInfo() {
      if (!window.chrome || !window.chrome.runtime) {
        return 'Chrome Extensions API not available';
      }

      try {
        return {
          id: chrome.runtime.id || 'N/A',
          manifest: chrome.runtime.getManifest ? 'Available' : 'Not Available',
          onConnect: !!chrome.runtime.onConnect,
          onMessage: !!chrome.runtime.onMessage,
        };
      } catch (e) {
        return `Error: ${e.message}`;
      }
    }

    // Web Store アクセス確認
    checkWebStoreAccess() {
      return {
        domain: location.hostname.includes('microsoftedge.microsoft.com'),
        chromeWebStore: location.hostname.includes('chrome.google.com'),
        extensionPage: location.protocol === 'chrome-extension:',
      };
    }

    // 制約事項分析
    analyzeLimitations() {
      this.results.limitations = [
        {
          category: 'お気に入り (Bookmarks)',
          limitation: '直接アクセス不可',
          reason: 'Webページからブラウザのお気に入りAPIにはアクセスできません',
          workaround: 'ブラウザ拡張機能での実装が必要',
        },
        {
          category: 'ブラウザ履歴',
          limitation: '読み取り専用制限',
          reason: 'セキュリティ上の理由で履歴の完全な読み取り・操作は制限されています',
          workaround: 'History API は現在のセッション内のみ操作可能',
        },
        {
          category: 'タブ管理',
          limitation: 'クロスオリジン制限',
          reason: '他のタブ・ウィンドウへの直接アクセスは不可',
          workaround: 'ポップアップウィンドウやブラウザ拡張機能を使用',
        },
        {
          category: 'システム設定',
          limitation: 'ブラウザ設定アクセス不可',
          reason: 'プライバシー保護のためブラウザ設定への直接アクセスは禁止',
          workaround: '一部情報は User Agent や API 経由で取得可能',
        },
        {
          category: 'ファイルシステム',
          limitation: 'サンドボックス制限',
          reason: 'セキュリティのためファイルシステムへの直接アクセスは制限',
          workaround: 'File System Access API (実験的) または File API を使用',
        },
      ];
    }

    // 完全分析実行
    async analyzeAll() {
      this.detectEdge();
      this.analyzeWebAPIs();
      this.analyzePerformance();
      this.analyzeExtensions();
      this.analyzeLimitations();

      // 追加の非同期チェック
      await this.checkAsyncAPIs();

      return this.results;
    }

    // 非同期API確認
    async checkAsyncAPIs() {
      try {
        // Battery API
        if (navigator.getBattery) {
          const battery = await navigator.getBattery();
          this.results.apis['Battery Status'] = {
            available: true,
            value: {
              charging: battery.charging,
              level: Math.round(battery.level * 100) + '%',
              chargingTime: battery.chargingTime,
              dischargingTime: battery.dischargingTime,
            },
          };
        }

        // Storage Estimate
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          this.results.apis['Storage Estimate'] = {
            available: true,
            value: {
              quota: this.formatBytes(estimate.quota),
              usage: this.formatBytes(estimate.usage),
              usagePercent: Math.round((estimate.usage / estimate.quota) * 100) + '%',
            },
          };
        }

        // Permissions
        if (navigator.permissions) {
          const permissions = [
            'camera',
            'microphone',
            'geolocation',
            'notifications',
            'push',
            'persistent-storage',
          ];
          const permissionResults = {};

          for (const permission of permissions) {
            try {
              const result = await navigator.permissions.query({ name: permission });
              permissionResults[permission] = result.state;
            } catch (e) {
              permissionResults[permission] = 'unsupported';
            }
          }

          this.results.apis['Permission States'] = {
            available: true,
            value: permissionResults,
          };
        }
      } catch (e) {
        console.warn('Async API check failed:', e);
      }
    }

    // バイトフォーマット
    formatBytes(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }

  // =============================================================================
  // UI管理クラス
  // =============================================================================
  class UIManager {
    constructor() {
      this.panel = null;
      this.currentTab = 'browser';
    }

    // パネル作成
    createPanel() {
      this.panel = document.createElement('div');
      this.panel.id = CONSTANTS.PANEL_ID;
      this.panel.style.cssText = this.getPanelStyles();
      return this.panel;
    }

    // パネルスタイル
    getPanelStyles() {
      return [
        'position: fixed !important',
        'top: 50% !important',
        'left: 50% !important',
        'transform: translate(-50%, -50%) !important',
        `width: ${CONSTANTS.PANEL_WIDTH} !important`,
        `height: ${CONSTANTS.PANEL_HEIGHT} !important`,
        `max-width: calc(100vw - 40px) !important`,
        `max-height: calc(100vh - 40px) !important`,
        `background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY} !important`,
        `border: 2px solid ${DESIGN_SYSTEM.COLORS.PRIMARY} !important`,
        `border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.LG} !important`,
        `box-shadow: ${DESIGN_SYSTEM.SHADOWS.PANEL} !important`,
        `z-index: ${CONSTANTS.Z_INDEX} !important`,
        `font-family: ${DESIGN_SYSTEM.TYPOGRAPHY.FONT_FAMILY} !important`,
        `font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.BODY} !important`,
        `color: ${DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important`,
        'overflow: hidden !important',
        'display: flex !important',
        'flex-direction: column !important',
      ].join(';');
    }

    // HTML生成
    generateHTML(results) {
      return `
        ${this.generateHeader()}
        ${this.generateTabs()}
        ${this.generateContent(results)}
      `;
    }

    // ヘッダー生成
    generateHeader() {
      return `
        <div style="padding: ${DESIGN_SYSTEM.SPACING.LG} !important; 
                    border-bottom: 1px solid ${DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important; 
                    background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
                    display: flex !important; justify-content: space-between !important; align-items: center !important;">
          <h2 style="margin: 0 !important; color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; 
                     font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H1} !important; 
                     font-weight: ${DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
                     display: flex !important; align-items: center !important; gap: ${DESIGN_SYSTEM.SPACING.SM} !important;">
            🔍 Edge Explorer
          </h2>
          <button id="edge-explorer-close" style="background: ${DESIGN_SYSTEM.COLORS.DANGER} !important; 
                  color: ${DESIGN_SYSTEM.COLORS.TEXT.INVERSE} !important;
                  border: none !important; border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; 
                  padding: ${DESIGN_SYSTEM.SPACING.SM} ${DESIGN_SYSTEM.SPACING.MD} !important;
                  cursor: pointer !important; font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                  transition: all ${DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;">
            ✕ 閉じる
          </button>
        </div>
      `;
    }

    // タブ生成
    generateTabs() {
      const tabs = [
        { id: 'browser', icon: '🌐', label: 'ブラウザ情報' },
        { id: 'apis', icon: '🔌', label: 'Web APIs' },
        { id: 'performance', icon: '⚡', label: 'パフォーマンス' },
        { id: 'extensions', icon: '🧩', label: '拡張機能' },
        { id: 'limitations', icon: '🚫', label: '制約事項' },
      ];

      return `
        <div style="display: flex !important; border-bottom: 1px solid ${DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important; 
                    background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;">
          ${tabs
            .map(
              tab => `
            <button class="edge-explorer-tab" data-tab="${tab.id}" 
                    style="flex: 1 !important; padding: ${DESIGN_SYSTEM.SPACING.MD} ${DESIGN_SYSTEM.SPACING.SM} !important;
                           border: none !important; background: ${this.currentTab === tab.id ? DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY : 'transparent'} !important;
                           color: ${this.currentTab === tab.id ? DESIGN_SYSTEM.COLORS.PRIMARY : DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
                           cursor: pointer !important; font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                           border-bottom: 2px solid ${this.currentTab === tab.id ? DESIGN_SYSTEM.COLORS.PRIMARY : 'transparent'} !important;
                           transition: all ${DESIGN_SYSTEM.TRANSITIONS.DEFAULT} !important;
                           display: flex !important; align-items: center !important; justify-content: center !important; gap: ${DESIGN_SYSTEM.SPACING.XS} !important;">
              <span>${tab.icon}</span>
              <span>${tab.label}</span>
            </button>
          `
            )
            .join('')}
        </div>
      `;
    }

    // コンテンツ生成
    generateContent(results) {
      return `
        <div style="flex: 1 !important; overflow-y: auto !important; padding: ${DESIGN_SYSTEM.SPACING.LG} !important;">
          <div id="tab-browser" style="display: ${this.currentTab === 'browser' ? 'block' : 'none'} !important;">
            ${this.generateBrowserTab(results.browser)}
          </div>
          <div id="tab-apis" style="display: ${this.currentTab === 'apis' ? 'block' : 'none'} !important;">
            ${this.generateAPIsTab(results.apis)}
          </div>
          <div id="tab-performance" style="display: ${this.currentTab === 'performance' ? 'block' : 'none'} !important;">
            ${this.generatePerformanceTab(results.performance)}
          </div>
          <div id="tab-extensions" style="display: ${this.currentTab === 'extensions' ? 'block' : 'none'} !important;">
            ${this.generateExtensionsTab(results.extensions)}
          </div>
          <div id="tab-limitations" style="display: ${this.currentTab === 'limitations' ? 'block' : 'none'} !important;">
            ${this.generateLimitationsTab(results.limitations)}
          </div>
        </div>
      `;
    }

    // ブラウザタブ生成
    generateBrowserTab(browser) {
      const edgeStatus = browser.isEdge
        ? `<span style="color: ${DESIGN_SYSTEM.COLORS.SUCCESS} !important;">✅ Microsoft Edge</span>`
        : `<span style="color: ${DESIGN_SYSTEM.COLORS.WARNING} !important;">⚠️ Edge以外のブラウザ</span>`;

      return `
        <div class="info-section">
          <h3 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin-bottom: ${DESIGN_SYSTEM.SPACING.MD} !important;">
            🌐 ブラウザ検出結果
          </h3>
          <div class="info-grid">
            <div><strong>ブラウザ:</strong> ${edgeStatus}</div>
            <div><strong>バージョン:</strong> ${browser.version || 'Unknown'}</div>
            <div><strong>エンジン:</strong> ${browser.engine || 'Unknown'}</div>
            <div><strong>Chromium ベース:</strong> ${browser.isChromiumBased ? '✅ Yes' : '❌ No'}</div>
            <div><strong>レガシー Edge:</strong> ${browser.isEdgeLegacy ? '⚠️ Yes' : '✅ No'}</div>
            <div><strong>プラットフォーム:</strong> ${browser.platform || 'Unknown'}</div>
            <div><strong>言語:</strong> ${browser.language || 'Unknown'}</div>
            <div><strong>ベンダー:</strong> ${browser.vendor || 'Unknown'}</div>
            <div><strong>CPU コア数:</strong> ${browser.hardwareConcurrency || 'Unknown'}</div>
            <div><strong>タッチポイント:</strong> ${browser.maxTouchPoints || 0}</div>
            <div><strong>Cookie 有効:</strong> ${browser.cookieEnabled ? '✅ Yes' : '❌ No'}</div>
            <div><strong>Do Not Track:</strong> ${browser.doNotTrack || 'Unknown'}</div>
          </div>
          
          <h4 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin: ${DESIGN_SYSTEM.SPACING.LG} 0 ${DESIGN_SYSTEM.SPACING.MD} 0 !important;">
            🔍 User Agent
          </h4>
          <div style="background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important; 
                      padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                      border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                      font-family: monospace !important; font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
                      word-break: break-all !important; line-height: 1.4 !important;">
            ${browser.userAgent || 'Unknown'}
          </div>

          <h4 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin: ${DESIGN_SYSTEM.SPACING.LG} 0 ${DESIGN_SYSTEM.SPACING.MD} 0 !important;">
            🌍 対応言語
          </h4>
          <div style="background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important; 
                      padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                      border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;">
            ${(browser.languages || []).join(', ') || 'Unknown'}
          </div>
        </div>
      `;
    }

    // API タブ生成
    generateAPIsTab(apis) {
      const available = Object.entries(apis).filter(([_, api]) => api.available);
      const unavailable = Object.entries(apis).filter(([_, api]) => !api.available);

      return `
        <div class="info-section">
          <div style="display: flex !important; gap: ${DESIGN_SYSTEM.SPACING.LG} !important; margin-bottom: ${DESIGN_SYSTEM.SPACING.LG} !important;">
            <div style="text-align: center !important; padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                        background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important; 
                        border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; flex: 1 !important;">
              <div style="font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H1} !important; 
                          color: ${DESIGN_SYSTEM.COLORS.SUCCESS} !important; 
                          font-weight: ${DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.BOLD} !important;">
                ${available.length}
              </div>
              <div style="color: ${DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">利用可能</div>
            </div>
            <div style="text-align: center !important; padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                        background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important; 
                        border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important; flex: 1 !important;">
              <div style="font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.H1} !important; 
                          color: ${DESIGN_SYSTEM.COLORS.WARNING} !important; 
                          font-weight: ${DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.BOLD} !important;">
                ${unavailable.length}
              </div>
              <div style="color: ${DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">利用不可</div>
            </div>
          </div>

          <h3 style="color: ${DESIGN_SYSTEM.COLORS.SUCCESS} !important; margin-bottom: ${DESIGN_SYSTEM.SPACING.MD} !important;">
            ✅ 利用可能な API (${available.length})
          </h3>
          <div class="api-grid">
            ${available
              .map(
                ([name, api]) => `
              <div class="api-item available">
                <div class="api-name">${name}</div>
                <div class="api-value">${this.formatAPIValue(api.value)}</div>
              </div>
            `
              )
              .join('')}
          </div>

          <h3 style="color: ${DESIGN_SYSTEM.COLORS.WARNING} !important; margin: ${DESIGN_SYSTEM.SPACING.LG} 0 ${DESIGN_SYSTEM.SPACING.MD} 0 !important;">
            ❌ 利用不可の API (${unavailable.length})
          </h3>
          <div class="api-grid">
            ${unavailable
              .map(
                ([name, api]) => `
              <div class="api-item unavailable">
                <div class="api-name">${name}</div>
                <div class="api-error">${api.error || 'Not supported'}</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    // API値フォーマット
    formatAPIValue(value) {
      if (value === null || value === undefined) return 'null';
      if (typeof value === 'object') {
        return `<pre>${JSON.stringify(value, null, 2)}</pre>`;
      }
      return String(value);
    }

    // パフォーマンスタブ生成
    generatePerformanceTab(performance) {
      return `
        <div class="info-section">
          <h3 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin-bottom: ${DESIGN_SYSTEM.SPACING.MD} !important;">
            ⚡ パフォーマンス情報
          </h3>
          
          ${
            performance.memory
              ? `
            <h4 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin: ${DESIGN_SYSTEM.SPACING.LG} 0 ${DESIGN_SYSTEM.SPACING.MD} 0 !important;">
              💾 メモリ使用量
            </h4>
            <div class="info-grid">
              <div><strong>使用中:</strong> ${performance.memory.usedJSHeapSize}</div>
              <div><strong>総量:</strong> ${performance.memory.totalJSHeapSize}</div>
              <div><strong>上限:</strong> ${performance.memory.jsHeapSizeLimit}</div>
            </div>
          `
              : ''
          }
          
          ${
            performance.timing
              ? `
            <h4 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin: ${DESIGN_SYSTEM.SPACING.LG} 0 ${DESIGN_SYSTEM.SPACING.MD} 0 !important;">
              ⏱️ ページロード時間
            </h4>
            <div class="info-grid">
              <div><strong>ページロード:</strong> ${performance.timing.pageLoadTime || 0}ms</div>
              <div><strong>DOM 準備:</strong> ${performance.timing.domReadyTime || 0}ms</div>
              <div><strong>DOM 完了:</strong> ${performance.timing.domComplete || 0}ms</div>
              <div><strong>インタラクティブ:</strong> ${performance.timing.domInteractive || 0}ms</div>
            </div>
          `
              : ''
          }

          <h4 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin: ${DESIGN_SYSTEM.SPACING.LG} 0 ${DESIGN_SYSTEM.SPACING.MD} 0 !important;">
            🔢 その他の情報
          </h4>
          <div class="info-grid">
            <div><strong>Time Origin:</strong> ${performance.timeOrigin || 'Unknown'}</div>
            <div><strong>現在時刻:</strong> ${performance.now || 0}ms</div>
            <div><strong>Performance Entries:</strong> ${performance.entries || 0}</div>
            ${
              performance.navigation
                ? `
              <div><strong>ナビゲーション種別:</strong> ${performance.navigation.type}</div>
              <div><strong>リダイレクト回数:</strong> ${performance.navigation.redirectCount}</div>
            `
                : ''
            }
          </div>
        </div>
      `;
    }

    // 拡張機能タブ生成
    generateExtensionsTab(extensions) {
      return `
        <div class="info-section">
          <h3 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin-bottom: ${DESIGN_SYSTEM.SPACING.MD} !important;">
            🧩 拡張機能情報
          </h3>
          
          <div class="info-grid">
            <div><strong>Chrome Extensions API:</strong> ${extensions.chromeExtensions ? '✅ 利用可能' : '❌ 利用不可'}</div>
            <div><strong>Web Store (Edge):</strong> ${extensions.webStoreAccess.domain ? '✅ Edge Add-ons' : '❌ 外部サイト'}</div>
            <div><strong>Chrome Web Store:</strong> ${extensions.webStoreAccess.chromeWebStore ? '✅ Chrome Web Store' : '❌ 外部サイト'}</div>
            <div><strong>拡張機能ページ:</strong> ${extensions.webStoreAccess.extensionPage ? '✅ 拡張機能内' : '❌ 通常ページ'}</div>
          </div>

          <h4 style="color: ${DESIGN_SYSTEM.COLORS.PRIMARY} !important; margin: ${DESIGN_SYSTEM.SPACING.LG} 0 ${DESIGN_SYSTEM.SPACING.MD} 0 !important;">
            🔍 拡張機能 API 詳細
          </h4>
          <div style="background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important; 
                      padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                      border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                      font-family: monospace !important; font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;">
            ${
              typeof extensions.extensionInfo === 'object'
                ? JSON.stringify(extensions.extensionInfo, null, 2)
                : extensions.extensionInfo
            }
          </div>

          <div style="margin-top: ${DESIGN_SYSTEM.SPACING.LG} !important; 
                      padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                      background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.ACCENT} !important; 
                      border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                      border-left: 4px solid ${DESIGN_SYSTEM.COLORS.PRIMARY} !important;">
            <strong>💡 拡張機能での機能拡張</strong><br>
            ブックマークやタブ管理などの高度な機能は、ブラウザ拡張機能として実装することで実現できます。
            Edge Add-ons や Chrome Web Store で公開されている拡張機能を参考にしてください。
          </div>
        </div>
      `;
    }

    // 制約事項タブ生成
    generateLimitationsTab(limitations) {
      return `
        <div class="info-section">
          <h3 style="color: ${DESIGN_SYSTEM.COLORS.DANGER} !important; margin-bottom: ${DESIGN_SYSTEM.SPACING.MD} !important;">
            🚫 ブックマークレットの制約事項
          </h3>
          
          <div style="margin-bottom: ${DESIGN_SYSTEM.SPACING.LG} !important; 
                      padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                      background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.ACCENT} !important; 
                      border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                      border-left: 4px solid ${DESIGN_SYSTEM.COLORS.WARNING} !important;">
            <strong>ℹ️ 重要な注意事項</strong><br>
            ブックマークレットは通常のWebページのJavaScriptとして実行されるため、
            ブラウザのセキュリティ制限により多くの内部機能にはアクセスできません。
          </div>

          ${limitations
            .map(
              limitation => `
            <div class="limitation-item">
              <h4 style="color: ${DESIGN_SYSTEM.COLORS.DANGER} !important; margin-bottom: ${DESIGN_SYSTEM.SPACING.SM} !important;">
                🚫 ${limitation.category}
              </h4>
              <div style="margin-bottom: ${DESIGN_SYSTEM.SPACING.SM} !important;">
                <strong>制限:</strong> ${limitation.limitation}
              </div>
              <div style="margin-bottom: ${DESIGN_SYSTEM.SPACING.SM} !important; color: ${DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;">
                <strong>理由:</strong> ${limitation.reason}
              </div>
              <div style="padding: ${DESIGN_SYSTEM.SPACING.SM} !important; 
                          background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important; 
                          border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;">
                <strong>回避策:</strong> ${limitation.workaround}
              </div>
            </div>
          `
            )
            .join('')}

          <div style="margin-top: ${DESIGN_SYSTEM.SPACING.LG} !important; 
                      padding: ${DESIGN_SYSTEM.SPACING.MD} !important; 
                      background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.ACCENT} !important; 
                      border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
                      border-left: 4px solid ${DESIGN_SYSTEM.COLORS.SUCCESS} !important;">
            <strong>✅ 推奨代替案</strong><br>
            より高度な機能が必要な場合は、以下を検討してください：
            <ul style="margin: ${DESIGN_SYSTEM.SPACING.SM} 0 0 ${DESIGN_SYSTEM.SPACING.LG} !important; padding: 0 !important;">
              <li>ブラウザ拡張機能の開発</li>
              <li>Progressive Web App (PWA) の活用</li>
              <li>Edge WebView2 の利用</li>
              <li>デスクトップアプリケーションの開発</li>
            </ul>
          </div>
        </div>
      `;
    }

    // イベントハンドラー設定
    setupEventHandlers() {
      // 閉じるボタン
      const closeBtn = document.getElementById('edge-explorer-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.closePanel();
        });
      }

      // タブ切り替え
      const tabs = document.querySelectorAll('.edge-explorer-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', e => {
          const tabId = e.currentTarget.getAttribute('data-tab');
          this.switchTab(tabId);
        });
      });

      // ESCキーで閉じる
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.panel) {
          this.closePanel();
        }
      });
    }

    // タブ切り替え
    switchTab(tabId) {
      this.currentTab = tabId;

      // すべてのタブコンテンツを非表示
      const contents = ['browser', 'apis', 'performance', 'extensions', 'limitations'];
      contents.forEach(id => {
        const element = document.getElementById(`tab-${id}`);
        if (element) {
          element.style.display = 'none';
        }
      });

      // 選択されたタブコンテンツを表示
      const selectedContent = document.getElementById(`tab-${tabId}`);
      if (selectedContent) {
        selectedContent.style.display = 'block';
      }

      // タブボタンのスタイル更新
      const tabButtons = document.querySelectorAll('.edge-explorer-tab');
      tabButtons.forEach(button => {
        const isActive = button.getAttribute('data-tab') === tabId;
        button.style.background = isActive
          ? DESIGN_SYSTEM.COLORS.BACKGROUND.PRIMARY
          : 'transparent';
        button.style.color = isActive
          ? DESIGN_SYSTEM.COLORS.PRIMARY
          : DESIGN_SYSTEM.COLORS.TEXT.SECONDARY;
        button.style.borderBottomColor = isActive ? DESIGN_SYSTEM.COLORS.PRIMARY : 'transparent';
      });
    }

    // パネル閉じる
    closePanel() {
      if (this.panel) {
        this.panel.remove();
        this.panel = null;
      }
    }

    // CSS注入
    injectCSS() {
      const existingStyle = document.getElementById('edge-explorer-styles');
      if (existingStyle) {
        existingStyle.remove();
      }

      const style = document.createElement('style');
      style.id = 'edge-explorer-styles';
      style.textContent = `
        .info-section {
          margin-bottom: ${DESIGN_SYSTEM.SPACING.XL} !important;
        }

        .info-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)) !important;
          gap: ${DESIGN_SYSTEM.SPACING.SM} !important;
          margin-bottom: ${DESIGN_SYSTEM.SPACING.MD} !important;
        }

        .info-grid > div {
          padding: ${DESIGN_SYSTEM.SPACING.SM} !important;
          background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
          border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
          font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.SMALL} !important;
        }

        .api-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)) !important;
          gap: ${DESIGN_SYSTEM.SPACING.SM} !important;
          margin-bottom: ${DESIGN_SYSTEM.SPACING.LG} !important;
        }

        .api-item {
          padding: ${DESIGN_SYSTEM.SPACING.MD} !important;
          border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
          border: 1px solid ${DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
        }

        .api-item.available {
          background: rgba(16, 124, 16, 0.05) !important;
          border-color: ${DESIGN_SYSTEM.COLORS.SUCCESS} !important;
        }

        .api-item.unavailable {
          background: rgba(255, 140, 0, 0.05) !important;
          border-color: ${DESIGN_SYSTEM.COLORS.WARNING} !important;
        }

        .api-name {
          font-weight: ${DESIGN_SYSTEM.TYPOGRAPHY.WEIGHTS.SEMIBOLD} !important;
          margin-bottom: ${DESIGN_SYSTEM.SPACING.XS} !important;
          color: ${DESIGN_SYSTEM.COLORS.TEXT.PRIMARY} !important;
        }

        .api-value {
          font-family: monospace !important;
          font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
          color: ${DESIGN_SYSTEM.COLORS.TEXT.SECONDARY} !important;
          word-break: break-all !important;
        }

        .api-value pre {
          margin: 0 !important;
          padding: ${DESIGN_SYSTEM.SPACING.XS} !important;
          background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
          border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.SM} !important;
          overflow-x: auto !important;
        }

        .api-error {
          font-size: ${DESIGN_SYSTEM.TYPOGRAPHY.SIZES.CAPTION} !important;
          color: ${DESIGN_SYSTEM.COLORS.WARNING} !important;
          font-style: italic !important;
        }

        .limitation-item {
          margin-bottom: ${DESIGN_SYSTEM.SPACING.LG} !important;
          padding: ${DESIGN_SYSTEM.SPACING.MD} !important;
          border: 1px solid ${DESIGN_SYSTEM.COLORS.BORDER.SUBTLE} !important;
          border-radius: ${DESIGN_SYSTEM.BORDER_RADIUS.MD} !important;
          background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
        }

        .edge-explorer-tab:hover {
          background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.SECONDARY} !important;
        }

        #edge-explorer-close:hover {
          background: #b32d32 !important;
        }

        /* スクロールバーのスタイル */
        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar {
          width: 8px !important;
        }

        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar-track {
          background: ${DESIGN_SYSTEM.COLORS.BACKGROUND.TERTIARY} !important;
        }

        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar-thumb {
          background: ${DESIGN_SYSTEM.COLORS.BORDER.DEFAULT} !important;
          border-radius: 4px !important;
        }

        #${CONSTANTS.PANEL_ID} *::-webkit-scrollbar-thumb:hover {
          background: ${DESIGN_SYSTEM.COLORS.TEXT.MUTED} !important;
        }
      `;

      document.head.appendChild(style);
    }
  }

  // =============================================================================
  // メイン実行
  // =============================================================================
  async function main() {
    // 既存パネルの削除
    const existingPanel = document.getElementById(CONSTANTS.PANEL_ID);
    if (existingPanel) {
      existingPanel.remove();
      return;
    }

    try {
      // CSS注入
      const uiManager = new UIManager();
      uiManager.injectCSS();

      // Edge分析実行
      const analyzer = new EdgeAnalyzer();
      console.log('🔍 Edge Explorer: 分析開始...');
      const results = await analyzer.analyzeAll();
      console.log('✅ Edge Explorer: 分析完了', results);

      // UIパネル作成
      const panel = uiManager.createPanel();
      panel.innerHTML = uiManager.generateHTML(results);
      document.body.appendChild(panel);

      // イベントハンドラー設定
      uiManager.setupEventHandlers();

      console.log('🚀 Edge Explorer: 起動完了');
    } catch (error) {
      console.error('❌ Edge Explorer: エラー発生', error);
      alert('Edge Explorer でエラーが発生しました: ' + error.message);
    }
  }

  // 実行
  main();
})();
