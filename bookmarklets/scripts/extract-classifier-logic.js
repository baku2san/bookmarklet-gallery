/**
 * UI Element Classifier Logic Extractor
 * ブックマークレットから分類ロジックを自動抽出してNode.js互換モジュールを生成
 *
 * 目的:
 * - ブックマークレットとテストコードの重複を避ける（案4実装）
 * - 分類ロジックを常に最新状態でテスト可能にする
 * - ブックマークレットの変更を自動的にテストに反映
 */

const fs = require('fs');
const path = require('path');

class ClassifierLogicExtractor {
  constructor() {
    this.sourceFile = path.join(__dirname, '../src/development/ui-element-classifier.js');
    this.outputFile = path.join(
      __dirname,
      '../test/by-bookmarklet/ui-element-classifier/generated/extracted-classifier-logic.js'
    );
    this.logFile = path.join(
      __dirname,
      '../test/by-bookmarklet/ui-element-classifier/generated/extraction.log'
    );
  }

  /**
   * ブックマークレットからロジックを抽出
   */
  extractLogic() {
    try {
      console.log('🔍 ブックマークレットファイルを読み込み中...');
      const sourceCode = fs.readFileSync(this.sourceFile, 'utf8');

      console.log('⚡ 分類ロジックを抽出中...');
      const extractedLogic = this.parseAndExtractLogic(sourceCode);

      console.log('📝 Node.js互換モジュールを生成中...');
      const nodeModule = this.generateNodeModule(extractedLogic);

      console.log('💾 ファイルに保存中...');
      fs.writeFileSync(this.outputFile, nodeModule, 'utf8');

      this.logExtraction(extractedLogic);

      console.log('✅ 抽出完了!');
      console.log(`   📁 出力ファイル: ${this.outputFile}`);
      console.log(`   📊 ログファイル: ${this.logFile}`);

      return true;
    } catch (error) {
      console.error('❌ 抽出エラー:', error.message);
      this.logError(error);
      return false;
    }
  }

  /**
   * ソースコードから必要なロジックを解析・抽出
   */
  parseAndExtractLogic(sourceCode) {
    const extractedLogic = {
      config: null,
      designSystem: null,
      classifierClass: null,
      methods: {},
      utilities: [],
      timestamp: new Date().toISOString(),
      sourceHash: this.generateHash(sourceCode),
    };

    // 1. CONFIG の抽出
    const configMatch = sourceCode.match(/const CONFIG = \{[\s\S]*?\};/);
    if (configMatch) {
      extractedLogic.config = configMatch[0];
    }

    // 2. DESIGN_SYSTEM の抽出
    const designSystemMatch = sourceCode.match(/const DESIGN_SYSTEM = \{[\s\S]*?\};/);
    if (designSystemMatch) {
      extractedLogic.designSystem = designSystemMatch[0];
    }

    // 3. UIElementClassifier クラス全体の抽出
    const classMatch = sourceCode.match(
      /class UIElementClassifier \{[\s\S]*?(?=(?:class \w+|window\.UIClassifierDebug|\/\/ メイン実行))/
    );
    if (classMatch) {
      extractedLogic.classifierClass = classMatch[0].replace(/\s+$/, '');
    }

    // 4. 重要なメソッドの個別抽出（バックアップとして）
    this.extractMethods(sourceCode, extractedLogic);

    // 5. ユーティリティ関数の抽出
    this.extractUtilities(sourceCode, extractedLogic);

    return extractedLogic;
  }

  /**
   * 重要なメソッドを個別に抽出
   */
  extractMethods(sourceCode, extractedLogic) {
    const methods = [
      'classifyElements',
      'classifyElement',
      'isStaticTranslocoText',
      'getStatistics',
    ];

    methods.forEach(methodName => {
      // メソッド定義の開始を検索
      const methodPattern = new RegExp(`(\\s+)(${methodName})\\([^)]*\\)\\s*\\{`);
      const match = sourceCode.match(methodPattern);

      if (match) {
        const startIndex = sourceCode.indexOf(match[0]);
        const methodBody = this.extractMethodBody(sourceCode, startIndex);
        if (methodBody) {
          extractedLogic.methods[methodName] = methodBody;
        }
      }
    });
  }

  /**
   * メソッドの本体を抽出（括弧のバランスを考慮）
   */
  extractMethodBody(sourceCode, startIndex) {
    let braceCount = 0;
    let inMethod = false;
    let methodCode = '';

    for (let i = startIndex; i < sourceCode.length; i++) {
      const char = sourceCode[i];
      methodCode += char;

      if (char === '{') {
        braceCount++;
        inMethod = true;
      } else if (char === '}') {
        braceCount--;

        if (inMethod && braceCount === 0) {
          return methodCode.trim();
        }
      }
    }

    return null;
  }

  /**
   * ユーティリティ関数を抽出
   */
  extractUtilities(sourceCode, extractedLogic) {
    // DOM関連のモック関数が必要な場合
    extractedLogic.utilities.push(`
// DOM モック関数（Node.js環境用）
function mockDocument() {
  return {
    querySelectorAll: () => [],
    createElement: () => ({}),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} }
  };
}
`);

    // localStorage モック
    extractedLogic.utilities.push(`
// localStorage モック（Node.js環境用）
function mockLocalStorage() {
  const storage = {};
  return {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => storage[key] = value,
    removeItem: (key) => delete storage[key]
  };
}
`);
  }

  /**
   * Node.js互換モジュールを生成
   */
  generateNodeModule(extractedLogic) {
    const timestamp = new Date().toISOString();
    const header = `/**
 * UI Element Classifier Logic - Auto-extracted from Bookmarklet
 * 自動抽出された分類ロジック（Node.js互換版）
 *
 * ⚠️  このファイルは自動生成されます。直接編集しないでください。
 *
 * 抽出元: ../src/development/ui-element-classifier.js
 * 生成日時: ${timestamp}
 * ソースハッシュ: ${extractedLogic.sourceHash}
 *
 * 更新方法:
 *   npm run extract-logic
 *   または
 *   node scripts/extract-classifier-logic.js
 */

'use strict';

// Node.js環境の検出とモック設定
const isNodeJS = typeof window === 'undefined';
let document = isNodeJS ? mockDocument() : window.document;
let localStorage = isNodeJS ? mockLocalStorage() : window.localStorage;
let console = isNodeJS ? require('console') : window.console;

`;

    let moduleCode = header;

    // ユーティリティ関数を追加
    if (extractedLogic.utilities.length > 0) {
      moduleCode += '// ユーティリティ関数\n';
      moduleCode += extractedLogic.utilities.join('\n') + '\n\n';
    }

    // CONFIG を追加
    if (extractedLogic.config) {
      moduleCode += '// 設定\n';
      moduleCode += extractedLogic.config + '\n\n';
    }

    // DESIGN_SYSTEM を追加
    if (extractedLogic.designSystem) {
      moduleCode += '// デザインシステム\n';
      moduleCode += extractedLogic.designSystem + '\n\n';
    }

    // UIElementClassifier クラスを追加
    if (extractedLogic.classifierClass) {
      moduleCode += '// 要素分類器クラス\n';
      moduleCode += extractedLogic.classifierClass + '\n\n';
    }

    // テスト用のヘルパー関数を追加
    moduleCode += this.generateTestHelpers();

    // モジュールエクスポート
    moduleCode += `
// モジュールエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UIElementClassifier,
    CONFIG,
    DESIGN_SYSTEM,
    createMockElement,
    createTestSuite,
    runClassificationTest,
    extractTimestamp: '${timestamp}',
    sourceHash: '${extractedLogic.sourceHash}'
  };
}
`;

    return moduleCode;
  }

  /**
   * テスト用ヘルパー関数を生成
   */
  generateTestHelpers() {
    return `
// テスト用ヘルパー関数

/**
 * テスト用のモック要素を作成
 */
function createMockElement(tagName, attributes = {}, textContent = '') {
  const attributeMap = new Map();
  const attributeArray = [];

  // 属性を設定
  Object.keys(attributes).forEach(key => {
    const attr = { name: key, value: attributes[key] };
    attributeMap.set(key, attributes[key]);
    attributeArray.push(attr);
  });

  const element = {
    tagName: tagName.toUpperCase(),
    attributes: attributeArray, // 配列として実装
    style: {},
    className: attributes.class || attributes.className || '',
    textContent: textContent,
    onclick: attributes.onclick || null,

    // 属性メソッド
    getAttribute: function(name) {
      return attributeMap.get(name) || null;
    },

    setAttribute: function(name, value) {
      attributeMap.set(name, value);
      // 既存の属性を更新するか、新しい属性を追加
      const existing = this.attributes.find(attr => attr.name === name);
      if (existing) {
        existing.value = value;
      } else {
        this.attributes.push({ name, value });
      }
    },

    hasAttribute: function(name) {
      return attributeMap.has(name);
    },

    // DOM メソッドのモック
    closest: function(selector) {
      // 簡単な実装
      if (selector === 'nav' && this.tagName === 'NAV') return this;
      if (selector === '[role="navigation"]' && this.getAttribute('role') === 'navigation') return this;
      return null;
    },

    addEventListener: function() {},
    removeEventListener: function() {}
  };

  // 追加の属性プロパティを設定
  if (attributes.id) element.id = attributes.id;
  if (attributes.type) element.type = attributes.type;
  if (attributes.href) element.href = attributes.href;
  if (attributes.role) element.role = attributes.role;

  return element;
}

/**
 * 分類テストを実行
 */
function runClassificationTest(element, expectedType, description) {
  const classifier = new UIElementClassifier();
  classifier.classifyElement(element);

  const results = classifier.classifications;
  const actualType = Object.keys(results).find(type =>
    results[type].some(item => item.element === element)
  );

  const passed = actualType === expectedType;

  return {
    passed,
    description,
    expected: expectedType,
    actual: actualType,
    element: {
      tagName: element.tagName,
      attributes: Object.fromEntries(element.attributes || []),
      className: element.className,
      textContent: element.textContent
    }
  };
}

/**
 * テストスイートを作成
 */
function createTestSuite(tests) {
  const results = tests.map(test => {
    const element = createMockElement(test.tagName, test.attributes, test.textContent);
    return runClassificationTest(element, test.expectedType, test.description);
  });

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  return {
    passed,
    total,
    results,
    success: passed === total
  };
}
`;
  }

  /**
   * 抽出ログを記録
   */
  logExtraction(extractedLogic) {
    const logEntry = {
      timestamp: extractedLogic.timestamp,
      sourceHash: extractedLogic.sourceHash,
      extractedComponents: {
        config: !!extractedLogic.config,
        designSystem: !!extractedLogic.designSystem,
        classifierClass: !!extractedLogic.classifierClass,
        methodCount: Object.keys(extractedLogic.methods).length,
        utilityCount: extractedLogic.utilities.length,
      },
      methods: Object.keys(extractedLogic.methods),
      success: true,
    };

    try {
      let logs = [];
      if (fs.existsSync(this.logFile)) {
        const existingLogs = fs.readFileSync(this.logFile, 'utf8');
        logs = JSON.parse(existingLogs);
      }

      logs.push(logEntry);

      // 最新10件のみ保持
      if (logs.length > 10) {
        logs = logs.slice(-10);
      }

      fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2), 'utf8');
    } catch (error) {
      console.warn('⚠️  ログ記録に失敗:', error.message);
    }
  }

  /**
   * エラーログを記録
   */
  logError(error) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      success: false,
    };

    try {
      let logs = [];
      if (fs.existsSync(this.logFile)) {
        const existingLogs = fs.readFileSync(this.logFile, 'utf8');
        logs = JSON.parse(existingLogs);
      }

      logs.push(errorEntry);

      if (logs.length > 10) {
        logs = logs.slice(-10);
      }

      fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2), 'utf8');
    } catch (logError) {
      console.warn('⚠️  エラーログ記録に失敗:', logError.message);
    }
  }

  /**
   * ハッシュ値を生成（変更検出用）
   */
  generateHash(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }

  /**
   * 出力ファイルが最新かチェック
   */
  isUpToDate() {
    if (!fs.existsSync(this.outputFile)) {
      return false;
    }

    try {
      const sourceCode = fs.readFileSync(this.sourceFile, 'utf8');
      const outputCode = fs.readFileSync(this.outputFile, 'utf8');

      const sourceHash = this.generateHash(sourceCode);
      const hashMatch = outputCode.match(/sourceHash: '([^']+)'/);

      if (hashMatch) {
        const outputHash = hashMatch[1];
        return sourceHash === outputHash;
      }
    } catch (error) {
      console.warn('⚠️  最新性チェックでエラー:', error.message);
    }

    return false;
  }

  /**
   * 強制更新フラグなしで実行（変更がある場合のみ更新）
   */
  extractIfNeeded() {
    if (this.isUpToDate()) {
      console.log('✅ 抽出済みファイルは最新です。更新不要。');
      return true;
    }

    console.log('📁 ソースファイルに変更を検出。自動抽出を実行...');
    return this.extractLogic();
  }
}

// コマンドライン実行時の処理
if (require.main === module) {
  const extractor = new ClassifierLogicExtractor();
  const args = process.argv.slice(2);

  const forceUpdate = args.includes('--force') || args.includes('-f');
  const checkOnly = args.includes('--check') || args.includes('-c');

  if (checkOnly) {
    const isUpToDate = extractor.isUpToDate();
    console.log(isUpToDate ? '✅ ファイルは最新です' : '⚠️  更新が必要です');
    process.exit(isUpToDate ? 0 : 1);
  } else if (forceUpdate) {
    const success = extractor.extractLogic();
    process.exit(success ? 0 : 1);
  } else {
    const success = extractor.extractIfNeeded();
    process.exit(success ? 0 : 1);
  }
}

module.exports = ClassifierLogicExtractor;
