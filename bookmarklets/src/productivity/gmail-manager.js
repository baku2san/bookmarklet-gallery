/**
 * 🔖 Gmail Manager - Gmail管理効率化ツール
 *
 * Gmail APIを使用して、メール管理を効率化するブックマークレット
 *
 * 機能:
 * - ラベル・フォルダ一覧表示
 * - 送信者別メール統計
 * - 一括削除（送信者指定）
 * - 自動ラベル設定
 * - Gmail API認証管理
 *
 * 対象: Gmail (mail.google.com)
 * 作成日: 2025-06-24
 *
 * @author Shima
 * @version 2.0.0
 */

(function () {
  'use strict';

  // Gmail ドメイン確認
  if (!window.location.hostname.includes('mail.google.com')) {
    alert(
      '🔖 Gmail Manager\n\nこのツールはGmailでのみ使用できます。\nmail.google.com でお試しください。'
    );
    return;
  }

  // =============================================================================
  // MemoryManager - メモリーリーク対策ユーティリティ（Gmail Manager 用）
  // =============================================================================
  class MemoryManager {
    constructor(options = {}) {
      this.eventListeners = new Map();
      this.intervals = new Set();
      this.timeouts = new Set();
      this.isCleanedUp = false;
      this.config = {
        enableWarnings: options.enableWarnings !== false,
        debugMode: options.debugMode || false,
        ...options,
      };
    }

    addEventListener(element, type, handler, options = {}) {
      if (this.isCleanedUp || !element || typeof handler !== 'function') return;

      element.addEventListener(type, handler, options);

      if (!this.eventListeners.has(element)) {
        this.eventListeners.set(element, []);
      }

      this.eventListeners.get(element).push({ type, handler, options });
    }

    setInterval(callback, delay, ...args) {
      if (this.isCleanedUp) return null;

      const intervalId = setInterval(callback, delay, ...args);
      this.intervals.add(intervalId);
      return intervalId;
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
            console.warn('Gmail Manager MemoryManager: Error removing event listener:', error);
          }
        }
      }
      this.eventListeners.clear();

      // インターバルのクリーンアップ
      for (const intervalId of this.intervals) {
        try {
          clearInterval(intervalId);
        } catch (error) {
          console.warn('Gmail Manager MemoryManager: Error clearing interval:', error);
        }
      }
      this.intervals.clear();

      // タイムアウトのクリーンアップ
      for (const timeoutId of this.timeouts) {
        try {
          clearTimeout(timeoutId);
        } catch (error) {
          console.warn('Gmail Manager MemoryManager: Error clearing timeout:', error);
        }
      }
      this.timeouts.clear();

      this.isCleanedUp = true;

      if (this.config.debugMode) {
        console.log('🧠 Gmail Manager: メモリークリーンアップ完了');
      }
    }
  }

  /**
   * Gmail Manager メインクラス
   */
  class GmailManager {
    constructor() {
      this.config = new ConfigManager();
      this.security = new SecurityManager();
      this.ui = new UIManager();
      this.apiManager = new GmailAPIManager();
      this.memoryManager = new MemoryManager({ debugMode: false }); // メモリーマネージャー追加

      this.state = {
        isAuthenticated: false,
        isApiLoaded: false,
        currentUser: null,
        labels: [],
        selectedLabel: null,
        senderStats: new Map(),
        isProcessing: false,
      };

      this.initialize();
    }

    async initialize() {
      try {
        // グローバル参照を設定（SecurityManagerがmemoryManagerにアクセスできるように）
        window.gmailManagerInstance = this;

        // セキュリティ初期化
        await this.security.initialize();

        // UI初期化
        this.ui.createPanel();

        // API設定読み込み
        await this.config.loadApiConfig();

        // イベントリスナー設定
        this.setupEventListeners();

        console.log('📬 Gmail Manager 初期化完了');
      } catch (error) {
        console.error('Gmail Manager 初期化エラー:', error);
        this.security.logSecurityEvent('INITIALIZATION_ERROR', { error: error.message });
      }
    }

    setupEventListeners() {
      // UI イベントの設定
      this.ui.setupEventListeners(this);
    }

    // 状態管理メソッド
    updateState(newState) {
      Object.assign(this.state, newState);
    }

    // メモリーリーク対策: 完全クリーンアップ
    cleanup() {
      try {
        console.log('🧠 Gmail Manager: クリーンアップ開始');

        // メモリーマネージャーでのクリーンアップ
        if (this.memoryManager) {
          this.memoryManager.cleanup();
        }

        // パネルの削除
        if (this.ui) {
          this.ui.removePanel();
        }

        // グローバル参照をクリア
        if (window.gmailManagerInstance === this) {
          delete window.gmailManagerInstance;
        }

        console.log('🧠 Gmail Manager: クリーンアップ完了');
      } catch (error) {
        console.error('Gmail Manager クリーンアップエラー:', error);
      }
    }
  }

  /**
   * 設定管理クラス
   */
  class ConfigManager {
    constructor() {
      this.CONFIG = {
        APP_NAME: 'Gmail Manager',
        VERSION: '2.0.0',
        CLIENT_ID: '',
        API_KEY: '',
        DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest'],
        SCOPES: 'https://www.googleapis.com/auth/gmail.modify',
        PANEL_ID: 'gmail-manager-panel',
        Z_INDEX: 2147483647,
        MAX_MESSAGES_PER_REQUEST: 100,
        BATCH_SIZE: 50,
      };
    }

    async loadApiConfig() {
      try {
        // セッション設定から読み込み
        const sessionConfig = this.getSessionConfig();
        if (sessionConfig.clientId && sessionConfig.apiKey) {
          this.CONFIG.CLIENT_ID = sessionConfig.clientId;
          this.CONFIG.API_KEY = sessionConfig.apiKey;
          return { clientId: sessionConfig.clientId, apiKey: sessionConfig.apiKey };
        }

        // 暗号化設定から読み込み
        const encryptedConfig = this.getEncryptedConfig();
        if (encryptedConfig.clientId && encryptedConfig.apiKey) {
          this.CONFIG.CLIENT_ID = encryptedConfig.clientId;
          this.CONFIG.API_KEY = encryptedConfig.apiKey;
          return encryptedConfig;
        }

        return { clientId: '', apiKey: '' };
      } catch (error) {
        console.error('API設定読み込みエラー:', error);
        return { clientId: '', apiKey: '' };
      }
    }

    getSessionConfig() {
      try {
        return {
          clientId: sessionStorage.getItem('gmail-manager-client-id') || '',
          apiKey: sessionStorage.getItem('gmail-manager-api-key') || '',
        };
      } catch {
        return { clientId: '', apiKey: '' };
      }
    }

    getEncryptedConfig() {
      try {
        const encClientId = localStorage.getItem('gmail-manager-client-id-enc');
        const encApiKey = localStorage.getItem('gmail-manager-api-key-enc');

        return {
          clientId: encClientId ? this.simpleDecrypt(encClientId) : '',
          apiKey: encApiKey ? this.simpleDecrypt(encApiKey) : '',
        };
      } catch {
        return { clientId: '', apiKey: '' };
      }
    }

    saveConfig(clientId, apiKey, securityLevel = 'sessionOnly') {
      try {
        if (securityLevel === 'sessionOnly') {
          sessionStorage.setItem('gmail-manager-client-id', clientId);
          sessionStorage.setItem('gmail-manager-api-key', apiKey);
        } else {
          localStorage.setItem('gmail-manager-client-id-enc', this.simpleEncrypt(clientId));
          localStorage.setItem('gmail-manager-api-key-enc', this.simpleEncrypt(apiKey));
        }

        this.CONFIG.CLIENT_ID = clientId;
        this.CONFIG.API_KEY = apiKey;

        return true;
      } catch (error) {
        console.error('設定保存エラー:', error);
        return false;
      }
    }

    clearConfig() {
      try {
        // セッション設定をクリア
        sessionStorage.removeItem('gmail-manager-client-id');
        sessionStorage.removeItem('gmail-manager-api-key');

        // 暗号化設定をクリア
        localStorage.removeItem('gmail-manager-client-id-enc');
        localStorage.removeItem('gmail-manager-api-key-enc');

        this.CONFIG.CLIENT_ID = '';
        this.CONFIG.API_KEY = '';

        return true;
      } catch (error) {
        console.error('設定クリアエラー:', error);
        return false;
      }
    }

    simpleEncrypt(text) {
      return btoa(
        text
          .split('')
          .map(char => String.fromCharCode(char.charCodeAt(0) + 3))
          .join('')
      );
    }

    simpleDecrypt(encodedText) {
      return atob(encodedText)
        .split('')
        .map(char => String.fromCharCode(char.charCodeAt(0) - 3))
        .join('');
    }
  }

  /**
   * セキュリティ管理クラス
   */
  class SecurityManager {
    constructor() {
      this.SECURITY_CONFIG = {
        SESSION_TIMEOUT: 30 * 60 * 1000,
        MAX_FAILED_ATTEMPTS: 3,
        LOCKOUT_DURATION: 15 * 60 * 1000,
        ALLOWED_DOMAINS: ['mail.google.com'],
      };

      this.securityState = {
        sessionStartTime: Date.now(),
        lastActivityTime: Date.now(),
        failedAttempts: 0,
        isLockedOut: false,
        lockoutTime: null,
        sessionId: this.generateSessionId(),
        cspViolations: [],
      };
    }

    async initialize() {
      this.setupCSPMonitoring();
      this.startSecurityChecks();
      this.logSecurityEvent('SECURITY_INITIALIZED');
    }

    generateSessionId() {
      return 'gm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    sanitizeHTML(input) {
      if (typeof input !== 'string') return input;

      return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    detectXSSPatterns(input) {
      if (typeof input !== 'string') return false;

      const dangerousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /<iframe[^>]*>.*?<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\s*\(/gi,
      ];

      return dangerousPatterns.some(pattern => pattern.test(input));
    }

    isSessionValid() {
      const now = Date.now();
      const sessionAge = now - this.securityState.sessionStartTime;
      const inactivityTime = now - this.securityState.lastActivityTime;

      if (sessionAge > this.SECURITY_CONFIG.SESSION_TIMEOUT) {
        this.expireSession('セッションがタイムアウトしました');
        return false;
      }

      if (inactivityTime > 15 * 60 * 1000) {
        this.expireSession('非アクティブのためセッションを終了しました');
        return false;
      }

      return true;
    }

    recordActivity() {
      this.securityState.lastActivityTime = Date.now();
    }

    expireSession(reason) {
      console.warn(`🚨 セッション終了: ${reason}`);

      // UI要素を削除
      const panel = document.getElementById('gmail-manager-panel');
      if (panel) {
        panel.remove();
      }

      alert(`🔒 セキュリティ: ${reason}\n\nGmail Managerを再起動してください。`);
    }

    checkIntegrity() {
      const panel = document.getElementById('gmail-manager-panel');
      if (!panel) return true;

      // 不正なスクリプトタグをチェック
      const scripts = panel.querySelectorAll('script');
      if (scripts.length > 0) {
        console.error('🚨 インテグリティ違反: 不正なスクリプトタグを検出');
        return false;
      }

      // 危険な属性をチェック
      const dangerousElements = panel.querySelectorAll('[onclick], [onload], [onerror]');
      if (dangerousElements.length > 0) {
        console.error('🚨 インテグリティ違反: 危険なイベントハンドラーを検出');
        return false;
      }

      return true;
    }

    setupCSPMonitoring() {
      // parent GmailManager インスタンスからmemoryManagerを取得
      const memoryManager = window.gmailManagerInstance?.memoryManager;

      if (memoryManager) {
        memoryManager.addEventListener(document, 'securitypolicyviolation', event => {
          console.error('🚨 CSP違反:', event);
          this.securityState.cspViolations.push({
            violatedDirective: event.violatedDirective,
            blockedURI: event.blockedURI,
            timestamp: Date.now(),
          });

          if (event.violatedDirective.includes('script-src')) {
            this.expireSession('CSPセキュリティ違反を検出');
          }
        });
      } else {
        // フォールバック（従来の方法）
        document.addEventListener('securitypolicyviolation', event => {
          console.error('🚨 CSP違反:', event);
          this.securityState.cspViolations.push({
            violatedDirective: event.violatedDirective,
            blockedURI: event.blockedURI,
            timestamp: Date.now(),
          });

          if (event.violatedDirective.includes('script-src')) {
            this.expireSession('CSPセキュリティ違反を検出');
          }
        });
      }
    }

    startSecurityChecks() {
      // parent GmailManager インスタンスからmemoryManagerを取得
      const memoryManager = window.gmailManagerInstance?.memoryManager;

      if (memoryManager) {
        this.securityCheckInterval = memoryManager.setInterval(() => {
          if (!this.checkIntegrity() || !this.isSessionValid()) {
            this.expireSession('セキュリティチェック失敗');
          }
        }, 60000);
      } else {
        // フォールバック（従来の方法）
        this.securityCheckInterval = setInterval(() => {
          if (!this.checkIntegrity() || !this.isSessionValid()) {
            this.expireSession('セキュリティチェック失敗');
          }
        }, 60000);
      }
    }

    logSecurityEvent(event, details = {}) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        sessionId: this.securityState.sessionId,
        event: event,
        details: details,
        url: window.location.href,
      };

      console.log('🔒 セキュリティログ:', logEntry);

      if (event.includes('ATTACK') || event.includes('VIOLATION')) {
        this.securityState.failedAttempts++;

        if (this.securityState.failedAttempts >= this.SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
          this.securityState.isLockedOut = true;
          this.expireSession('セキュリティ攻撃を検知：アカウントをロックアウト');
        }
      }
    }
  }

  /**
   * UI管理クラス
   */
  class UIManager {
    constructor() {
      this.PANEL_ID = 'gmail-manager-panel';
      this.Z_INDEX = 2147483647;
    }

    createPanel() {
      // 既存パネルをチェック・削除
      const existingPanel = document.getElementById(this.PANEL_ID);
      if (existingPanel) {
        existingPanel.remove();
      }

      // スタイル追加
      this.addStyles();

      // メインパネル
      const panel = this.createElement('div');
      panel.id = this.PANEL_ID;

      // パネル構成要素を作成
      panel.appendChild(this.createHeader());
      panel.appendChild(this.createTabs());
      panel.appendChild(this.createContent());

      document.body.appendChild(panel);
    }

    createElement(tag, className = '', textContent = '') {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (textContent) element.textContent = textContent;
      return element;
    }

    createHeader() {
      const header = this.createElement('div', 'gm-header');
      const title = this.createElement('div', 'gm-title', '📬 Gmail Manager');
      const closeBtn = this.createElement('button', 'gm-close-btn', '×');

      header.appendChild(title);
      header.appendChild(closeBtn);
      return header;
    }

    createTabs() {
      const tabs = this.createElement('div', 'gm-tabs');
      const tabsData = [
        { id: 'auth', label: '🔐 認証', active: true },
        { id: 'labels', label: '📁 ラベル' },
        { id: 'senders', label: '👥 送信者' },
        { id: 'delete', label: '🗑️ 削除' },
      ];

      tabsData.forEach(tab => {
        const tabBtn = this.createElement(
          'button',
          `gm-tab${tab.active ? ' active' : ''}`,
          tab.label
        );
        tabBtn.dataset.tab = tab.id;
        tabs.appendChild(tabBtn);
      });

      return tabs;
    }

    createContent() {
      const content = this.createElement('div', 'gm-content');

      content.appendChild(this.createAuthTab());
      content.appendChild(this.createLabelsTab());
      content.appendChild(this.createSendersTab());
      content.appendChild(this.createDeleteTab());

      return content;
    }

    createAuthTab() {
      const tab = this.createElement('div', 'gm-tab-content active');
      tab.id = 'gm-tab-auth';

      // 認証状態表示
      const authStatus = this.createElement('div', 'gm-status');
      authStatus.id = 'gm-auth-status';
      authStatus.textContent = 'Gmail APIへの認証が必要です';

      // API設定フォーム
      const configForm = this.createConfigForm();

      tab.appendChild(authStatus);
      tab.appendChild(configForm);

      return tab;
    }

    createConfigForm() {
      const form = this.createElement('div', 'gm-config-form');

      // Client ID入力
      const clientIdGroup = this.createElement('div', 'gm-form-group');
      clientIdGroup.appendChild(this.createElement('label', '', 'Client ID:'));
      const clientIdInput = this.createElement('input');
      clientIdInput.type = 'text';
      clientIdInput.id = 'gm-client-id';
      clientIdInput.placeholder = 'Google Cloud Console で取得したClient IDを入力';
      clientIdGroup.appendChild(clientIdInput);

      // API Key入力
      const apiKeyGroup = this.createElement('div', 'gm-form-group');
      apiKeyGroup.appendChild(this.createElement('label', '', 'API Key:'));
      const apiKeyInput = this.createElement('input');
      apiKeyInput.type = 'text';
      apiKeyInput.id = 'gm-api-key';
      apiKeyInput.placeholder = 'Google Cloud Console で取得したAPI Keyを入力';
      apiKeyGroup.appendChild(apiKeyInput);

      // セキュリティレベル選択
      const securityGroup = this.createElement('div', 'gm-form-group');
      securityGroup.appendChild(this.createElement('label', '', '🔒 セキュリティレベル:'));
      const securitySelect = this.createElement('select');
      securitySelect.id = 'gm-security-level';

      const sessionOption = this.createElement('option');
      sessionOption.value = 'sessionOnly';
      sessionOption.textContent = '🔐 セッションのみ（推奨・最も安全）';
      sessionOption.selected = true;

      const encryptedOption = this.createElement('option');
      encryptedOption.value = 'encrypted';
      encryptedOption.textContent = '🔒 暗号化保存（永続保存）';

      securitySelect.appendChild(sessionOption);
      securitySelect.appendChild(encryptedOption);
      securityGroup.appendChild(securitySelect);

      // ボタン群
      const buttonGroup = this.createElement('div', 'gm-button-group');
      buttonGroup.appendChild(this.createElement('button', 'gm-btn primary', '💾 設定を保存'));
      buttonGroup.appendChild(this.createElement('button', 'gm-btn', '🗑️ 設定をクリア'));
      buttonGroup.appendChild(this.createElement('button', 'gm-btn', '📖 設定ガイド'));

      form.appendChild(clientIdGroup);
      form.appendChild(apiKeyGroup);
      form.appendChild(securityGroup);
      form.appendChild(buttonGroup);

      return form;
    }

    createLabelsTab() {
      const tab = this.createElement('div', 'gm-tab-content');
      tab.id = 'gm-tab-labels';

      const labelsStatus = this.createElement('div', 'gm-status');
      labelsStatus.textContent = 'ラベル一覧を読み込み中...';

      const labelsList = this.createElement('div', 'gm-list');
      labelsList.id = 'gm-labels-list';

      tab.appendChild(labelsStatus);
      tab.appendChild(labelsList);

      return tab;
    }

    createSendersTab() {
      const tab = this.createElement('div', 'gm-tab-content');
      tab.id = 'gm-tab-senders';

      const sendersStatus = this.createElement('div', 'gm-status');
      sendersStatus.textContent = '送信者統計を読み込み中...';

      const sendersList = this.createElement('div', 'gm-list');
      sendersList.id = 'gm-senders-list';

      tab.appendChild(sendersStatus);
      tab.appendChild(sendersList);

      return tab;
    }

    createDeleteTab() {
      const tab = this.createElement('div', 'gm-tab-content');
      tab.id = 'gm-tab-delete';

      const deleteStatus = this.createElement('div', 'gm-status');
      deleteStatus.textContent = '一括削除機能';

      const deleteControls = this.createElement('div', 'gm-delete-controls');
      deleteControls.appendChild(this.createElement('button', 'gm-btn primary', '🗑️ 選択削除'));

      tab.appendChild(deleteStatus);
      tab.appendChild(deleteControls);

      return tab;
    }

    setupEventListeners(gmailManager) {
      // MemoryManager を取得
      const memoryManager = gmailManager.memoryManager;

      // タブ切り替え
      if (memoryManager) {
        memoryManager.addEventListener(document, 'click', e => {
          if (e.target.classList.contains('gm-tab')) {
            this.switchTab(e.target.dataset.tab);
          }

          // 閉じるボタン
          if (e.target.classList.contains('gm-close-btn')) {
            // クリーンアップを実行してからパネルを削除
            gmailManager.cleanup();
            const panel = document.getElementById(this.PANEL_ID);
            if (panel) panel.remove();
          }

          // 設定保存ボタン
          if (e.target.textContent.includes('設定を保存')) {
            this.saveConfig(gmailManager);
          }

          // 設定クリアボタン
          if (e.target.textContent.includes('設定をクリア')) {
            this.clearConfig(gmailManager);
          }
        });
      } else {
        // フォールバック（従来の方法）
        document.addEventListener('click', e => {
          if (e.target.classList.contains('gm-tab')) {
            this.switchTab(e.target.dataset.tab);
          }

          // 閉じるボタン
          if (e.target.classList.contains('gm-close-btn')) {
            const panel = document.getElementById(this.PANEL_ID);
            if (panel) panel.remove();
          }

          // 設定保存ボタン
          if (e.target.textContent.includes('設定を保存')) {
            this.saveConfig(gmailManager);
          }

          // 設定クリアボタン
          if (e.target.textContent.includes('設定をクリア')) {
            this.clearConfig(gmailManager);
          }
        });
      }
    }

    switchTab(tabId) {
      // タブボタンの状態更新
      document.querySelectorAll('.gm-tab').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

      // タブコンテンツの表示切り替え
      document.querySelectorAll('.gm-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`gm-tab-${tabId}`).classList.add('active');
    }

    saveConfig(gmailManager) {
      const clientId = document.getElementById('gm-client-id').value.trim();
      const apiKey = document.getElementById('gm-api-key').value.trim();
      const securityLevel = document.getElementById('gm-security-level').value;

      if (!clientId || !apiKey) {
        alert('Client IDとAPI Keyの両方を入力してください。');
        return;
      }

      if (gmailManager.config.saveConfig(clientId, apiKey, securityLevel)) {
        alert('設定を保存しました。');
        this.updateAuthStatus('設定保存完了');
      } else {
        alert('設定の保存に失敗しました。');
      }
    }

    clearConfig(gmailManager) {
      if (confirm('設定をクリアしますか？')) {
        if (gmailManager.config.clearConfig()) {
          document.getElementById('gm-client-id').value = '';
          document.getElementById('gm-api-key').value = '';
          alert('設定をクリアしました。');
          this.updateAuthStatus('設定がクリアされました');
        }
      }
    }

    updateAuthStatus(message) {
      const authStatus = document.getElementById('gm-auth-status');
      if (authStatus) {
        authStatus.textContent = message;
      }
    }

    // メモリーリーク対策: パネル削除
    removePanel() {
      const panel = document.getElementById(this.PANEL_ID);
      if (panel) {
        panel.remove();
      }

      // 注入したスタイルも削除
      const style = document.getElementById('gm-styles');
      if (style) {
        style.remove();
      }
    }

    addStyles() {
      const style = document.createElement('style');
      style.id = 'gm-styles';
      style.textContent = this.getCSS();
      document.head.appendChild(style);
    }

    getCSS() {
      return `
        #${this.PANEL_ID} {
          position: fixed;
          top: 50px;
          right: 50px;
          width: 450px;
          max-height: 600px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: ${this.Z_INDEX};
          color: white;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        #${this.PANEL_ID} * {
          box-sizing: border-box;
        }

        .gm-header {
          background: rgba(255,255,255,0.1);
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.2);
        }

        .gm-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
        }

        .gm-close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .gm-close-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.1);
        }

        .gm-tabs {
          display: flex;
          background: rgba(255,255,255,0.1);
        }

        .gm-tab {
          flex: 1;
          padding: 15px 10px;
          background: none;
          border: none;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
          text-align: center;
        }

        .gm-tab.active {
          background: rgba(255,255,255,0.2);
          color: white;
          font-weight: 600;
        }

        .gm-tab:hover {
          background: rgba(255,255,255,0.15);
          color: white;
        }

        .gm-content {
          padding: 20px;
          max-height: 450px;
          overflow-y: auto;
        }

        .gm-tab-content {
          display: none;
        }

        .gm-tab-content.active {
          display: block;
        }

        .gm-form-group {
          margin-bottom: 15px;
        }

        .gm-form-group label {
          display: block;
          margin-bottom: 5px;
          font-size: 12px;
        }

        .gm-form-group input,
        .gm-form-group select {
          width: 100%;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.1);
          color: white;
          font-size: 12px;
        }

        .gm-form-group input::placeholder {
          color: rgba(255,255,255,0.6);
        }

        .gm-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 10px 15px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          margin: 5px 5px 5px 0;
          transition: all 0.2s ease;
          min-width: 80px;
        }

        .gm-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-1px);
        }

        .gm-btn.primary {
          background: linear-gradient(45deg, #FF6B6B, #4ECDC4);
          font-weight: 600;
        }

        .gm-btn.primary:hover {
          background: linear-gradient(45deg, #FF5252, #26A69A);
        }

        .gm-status {
          background: rgba(255,255,255,0.1);
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
          font-size: 14px;
          line-height: 1.4;
        }

        .gm-list {
          max-height: 200px;
          overflow-y: auto;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 10px;
        }

        .gm-button-group {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
      `;
    }
  }

  /**
   * Gmail API管理クラス
   */
  class GmailAPIManager {
    constructor(config) {
      this.config = config;
      this.isLoaded = false;
      this.isAuthenticated = false;
    }

    async loadGoogleAPI() {
      return new Promise((resolve, reject) => {
        if (typeof gapi !== 'undefined') {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Google API読み込み失敗'));
        document.head.appendChild(script);
      });
    }

    async initializeAPI() {
      try {
        await this.loadGoogleAPI();

        await new Promise(resolve => {
          gapi.load('client:auth2', resolve);
        });

        await gapi.client.init({
          apiKey: this.config.CONFIG.API_KEY,
          clientId: this.config.CONFIG.CLIENT_ID,
          discoveryDocs: this.config.CONFIG.DISCOVERY_DOCS,
          scope: this.config.CONFIG.SCOPES,
        });

        this.isLoaded = true;
        return true;
      } catch (error) {
        console.error('Gmail API初期化エラー:', error);
        return false;
      }
    }

    async authenticate() {
      try {
        if (!this.isLoaded) {
          throw new Error('APIが初期化されていません');
        }

        const authInstance = gapi.auth2.getAuthInstance();
        if (!authInstance.isSignedIn.get()) {
          await authInstance.signIn();
        }

        this.isAuthenticated = true;
        return true;
      } catch (error) {
        console.error('認証エラー:', error);
        return false;
      }
    }

    async getLabels() {
      try {
        if (!this.isAuthenticated) {
          throw new Error('認証が必要です');
        }

        const response = await gapi.client.gmail.users.labels.list({
          userId: 'me',
        });

        return response.result.labels || [];
      } catch (error) {
        console.error('ラベル取得エラー:', error);
        return [];
      }
    }

    async getMessages(labelId = null, maxResults = 100) {
      try {
        if (!this.isAuthenticated) {
          throw new Error('認証が必要です');
        }

        const params = {
          userId: 'me',
          maxResults: maxResults,
        };

        if (labelId) {
          params.labelIds = [labelId];
        }

        const response = await gapi.client.gmail.users.messages.list(params);
        return response.result.messages || [];
      } catch (error) {
        console.error('メッセージ取得エラー:', error);
        return [];
      }
    }
  }

  /**
   * Gmail Manager を初期化して開始
   */
  function initializeGmailManager() {
    try {
      const gmailManager = new GmailManager();
      console.log('📬 Gmail Manager が正常に初期化されました');

      // グローバルアクセス用（デバッグ目的）
      window.gmailManager = gmailManager;
    } catch (error) {
      console.error('Gmail Manager 初期化エラー:', error);
      alert('Gmail Manager の起動に失敗しました: ' + error.message);
    }
  }

  // 初期化実行
  initializeGmailManager();
})();
