/**
 * 🔖 Memory Manager - メモリーリーク対策ユーティリティ
 *
 * ブックマークレット全体で使用する共通メモリー管理ユーティリティ
 *
 * 機能:
 * - イベントリスナーの自動管理
 * - タイマー（interval/timeout）の自動管理
 * - パネル閉鎖時の自動クリーンアップ
 * - メモリーリーク検出・警告
 *
 * 使用方法:
 * 1. const memoryManager = new MemoryManager();
 * 2. memoryManager.addEventListener(element, 'click', handler);
 * 3. memoryManager.setInterval(callback, 1000);
 * 4. パネル閉鎖時: memoryManager.cleanup();
 *
 * @author Shima
 * @version 1.0.0
 * @created 2025-01-27
 */

class MemoryManager {
  constructor(options = {}) {
    this.eventListeners = new Map(); // element -> [{type, handler, options}]
    this.intervals = new Set();
    this.timeouts = new Set();
    this.observedElements = new Set();
    this.mutationObservers = new Set();

    this.config = {
      enableWarnings: options.enableWarnings !== false,
      maxEventListeners: options.maxEventListeners || 100,
      maxTimers: options.maxTimers || 50,
      autoCleanupOnUnload: options.autoCleanupOnUnload !== false,
      debugMode: options.debugMode || false,
      ...options,
    };

    this.isCleanedUp = false;
    this.createdAt = Date.now();

    // 自動クリーンアップの設定
    if (this.config.autoCleanupOnUnload) {
      this.setupAutoCleanup();
    }

    this.log('MemoryManager initialized');
  }

  /**
   * イベントリスナーを管理付きで追加
   */
  addEventListener(element, type, handler, options = {}) {
    if (this.isCleanedUp) {
      this.warn('MemoryManager is already cleaned up, ignoring addEventListener');
      return;
    }

    if (!element || typeof handler !== 'function') {
      this.warn('Invalid element or handler for addEventListener');
      return;
    }

    // 制限チェック
    if (this.getTotalEventListeners() >= this.config.maxEventListeners) {
      this.warn(`Maximum event listeners (${this.config.maxEventListeners}) reached`);
      return;
    }

    // リスナー追加
    element.addEventListener(type, handler, options);

    // 管理リストに追加
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, []);
    }

    this.eventListeners.get(element).push({
      type,
      handler,
      options,
      addedAt: Date.now(),
    });

    this.log(`Added event listener: ${type} on`, element);
  }

  /**
   * イベントリスナーを管理付きで削除
   */
  removeEventListener(element, type, handler, options = {}) {
    if (!element) return;

    element.removeEventListener(type, handler, options);

    // 管理リストから削除
    if (this.eventListeners.has(element)) {
      const listeners = this.eventListeners.get(element);
      const index = listeners.findIndex(l => l.type === type && l.handler === handler);

      if (index !== -1) {
        listeners.splice(index, 1);

        // 空になったら要素自体を削除
        if (listeners.length === 0) {
          this.eventListeners.delete(element);
        }

        this.log(`Removed event listener: ${type} from`, element);
      }
    }
  }

  /**
   * setIntervalを管理付きで実行
   */
  setInterval(callback, delay, ...args) {
    if (this.isCleanedUp) {
      this.warn('MemoryManager is already cleaned up, ignoring setInterval');
      return null;
    }

    if (this.intervals.size >= this.config.maxTimers) {
      this.warn(`Maximum intervals (${this.config.maxTimers}) reached`);
      return null;
    }

    const intervalId = setInterval(callback, delay, ...args);
    this.intervals.add(intervalId);

    this.log(`Created interval with ID: ${intervalId}`);
    return intervalId;
  }

  /**
   * setTimeoutを管理付きで実行
   */
  setTimeout(callback, delay, ...args) {
    if (this.isCleanedUp) {
      this.warn('MemoryManager is already cleaned up, ignoring setTimeout');
      return null;
    }

    if (this.timeouts.size >= this.config.maxTimers) {
      this.warn(`Maximum timeouts (${this.config.maxTimers}) reached`);
      return null;
    }

    const timeoutId = setTimeout(() => {
      // タイムアウト完了時に自動的に管理リストから削除
      this.timeouts.delete(timeoutId);
      callback(...args);
    }, delay);

    this.timeouts.add(timeoutId);

    this.log(`Created timeout with ID: ${timeoutId}`);
    return timeoutId;
  }

  /**
   * intervalを管理付きでクリア
   */
  clearInterval(intervalId) {
    if (intervalId && this.intervals.has(intervalId)) {
      clearInterval(intervalId);
      this.intervals.delete(intervalId);
      this.log(`Cleared interval with ID: ${intervalId}`);
    }
  }

  /**
   * timeoutを管理付きでクリア
   */
  clearTimeout(timeoutId) {
    if (timeoutId && this.timeouts.has(timeoutId)) {
      clearTimeout(timeoutId);
      this.timeouts.delete(timeoutId);
      this.log(`Cleared timeout with ID: ${timeoutId}`);
    }
  }

  /**
   * MutationObserverを管理付きで作成
   */
  createMutationObserver(callback, options = {}) {
    if (this.isCleanedUp) {
      this.warn('MemoryManager is already cleaned up, ignoring createMutationObserver');
      return null;
    }

    const observer = new MutationObserver(callback);
    this.mutationObservers.add(observer);

    this.log('Created MutationObserver');
    return observer;
  }

  /**
   * 要素を監視対象に追加
   */
  observeElement(element) {
    this.observedElements.add(element);
  }

  /**
   * 自動クリーンアップの設定
   */
  setupAutoCleanup() {
    // ページ離脱時のクリーンアップ
    this.addEventListener(window, 'beforeunload', () => {
      this.cleanup();
    });

    // ページ非表示時のクリーンアップ
    this.addEventListener(document, 'visibilitychange', () => {
      if (document.hidden) {
        this.log('Page hidden, performing cleanup check');
        this.checkForLeaks();
      }
    });
  }

  /**
   * メモリーリークの検出
   */
  checkForLeaks() {
    const stats = this.getStats();

    if (stats.eventListeners > 50) {
      this.warn(`High number of event listeners: ${stats.eventListeners}`);
    }

    if (stats.intervals > 10) {
      this.warn(`High number of intervals: ${stats.intervals}`);
    }

    if (stats.timeouts > 20) {
      this.warn(`High number of timeouts: ${stats.timeouts}`);
    }

    // 長時間存在するタイマーの警告
    const lifeTime = Date.now() - this.createdAt;
    if (lifeTime > 300000) {
      // 5分
      this.warn(`MemoryManager has been active for ${Math.round(lifeTime / 1000)}s`);
    }
  }

  /**
   * 統計情報の取得
   */
  getStats() {
    return {
      eventListeners: this.getTotalEventListeners(),
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      observedElements: this.observedElements.size,
      mutationObservers: this.mutationObservers.size,
      isCleanedUp: this.isCleanedUp,
      lifeTime: Date.now() - this.createdAt,
    };
  }

  /**
   * 総イベントリスナー数を取得
   */
  getTotalEventListeners() {
    let total = 0;
    for (const listeners of this.eventListeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  /**
   * デバッグ情報の出力
   */
  debug() {
    if (!this.config.debugMode) return;

    console.group('🧠 MemoryManager Debug Info');
    console.table(this.getStats());

    console.log('Event Listeners by Element:');
    for (const [element, listeners] of this.eventListeners.entries()) {
      console.log(element, listeners);
    }

    console.log('Active Intervals:', Array.from(this.intervals));
    console.log('Active Timeouts:', Array.from(this.timeouts));
    console.groupEnd();
  }

  /**
   * 完全クリーンアップ
   */
  cleanup() {
    if (this.isCleanedUp) {
      this.log('Already cleaned up');
      return;
    }

    this.log('Starting cleanup...');

    // イベントリスナーのクリーンアップ
    for (const [element, listeners] of this.eventListeners.entries()) {
      for (const listener of listeners) {
        try {
          element.removeEventListener(listener.type, listener.handler, listener.options);
        } catch (error) {
          this.warn('Error removing event listener:', error);
        }
      }
    }
    this.eventListeners.clear();

    // インターバルのクリーンアップ
    for (const intervalId of this.intervals) {
      try {
        clearInterval(intervalId);
      } catch (error) {
        this.warn('Error clearing interval:', error);
      }
    }
    this.intervals.clear();

    // タイムアウトのクリーンアップ
    for (const timeoutId of this.timeouts) {
      try {
        clearTimeout(timeoutId);
      } catch (error) {
        this.warn('Error clearing timeout:', error);
      }
    }
    this.timeouts.clear();

    // MutationObserverのクリーンアップ
    for (const observer of this.mutationObservers) {
      try {
        observer.disconnect();
      } catch (error) {
        this.warn('Error disconnecting MutationObserver:', error);
      }
    }
    this.mutationObservers.clear();

    // 監視要素のクリーンアップ
    this.observedElements.clear();

    this.isCleanedUp = true;
    this.log('Cleanup completed');
  }

  /**
   * ログ出力（デバッグモード時のみ）
   */
  log(...args) {
    if (this.config.debugMode) {
      console.log('🧠 MemoryManager:', ...args);
    }
  }

  /**
   * 警告出力
   */
  warn(...args) {
    if (this.config.enableWarnings) {
      console.warn('⚠️ MemoryManager:', ...args);
    }
  }
}

// グローバルに公開（ブックマークレットで使用するため）
if (typeof window !== 'undefined') {
  window.MemoryManager = MemoryManager;
}

// モジュールとしても公開
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemoryManager;
}
