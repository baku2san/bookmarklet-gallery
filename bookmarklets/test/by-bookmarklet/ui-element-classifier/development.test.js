/**
 * UI Element Classifier - Development Tests
 * UI要素分類器用開発テスト
 *
 * このファイルは UI Element Classifier ブックマークレット専用の開発テストです。
 * 案4（自動抽出アーキテクチャ）に対応した最新版です。
 *
 * ソースファイル: src/development/ui-element-classifier.js
 * 抽出ロジック: generated/extracted-classifier-logic.js (自動生成)
 *
 * @fileoverview UI Element Classifier の開発用テスト集
 * @author Assistant
 * @version 2.0.0 (案4対応版)
 */

// 自動抽出されたロジックを使用（案4実装）
// パスを新しい構造に対応
const UIElementClassifierLogic = require('./generated/extracted-classifier-logic');

// ===================================
// テストユーティリティ関数
// ===================================

/**
 * テストレポート用の統計情報
 */
const TestStats = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  errors: [],

  reset() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.errors = [];
  },

  addTest(passed, error = null) {
    this.totalTests++;
    if (passed) {
      this.passedTests++;
    } else {
      this.failedTests++;
      if (error) {
        this.errors.push(error);
      }
    }
  },

  getReport() {
    const successRate =
      this.totalTests > 0 ? ((this.passedTests / this.totalTests) * 100).toFixed(1) : 0;
    return {
      total: this.totalTests,
      passed: this.passedTests,
      failed: this.failedTests,
      successRate: `${successRate}%`,
      errors: this.errors,
    };
  },
};

/**
 * 分類器のインスタンスを作成
 */
function createClassifier(options = {}) {
  const { UIElementClassifier } = UIElementClassifierLogic;
  const classifier = new UIElementClassifier();

  if (options.debug) {
    classifier.enableDebug = true;
  }

  return classifier;
}

/**
 * テストケースの一括実行
 */
function runTestCases(testCases, classifier, options = {}) {
  const { verbose = false, stopOnError = false } = options;
  const { runClassificationTest } = UIElementClassifierLogic;

  testCases.forEach((testCase, index) => {
    try {
      console.log(`🧪 テストケース ${index + 1}: ${testCase.description}`);

      const result = runClassificationTest(
        testCase.element,
        testCase.expected.type,
        testCase.description
      );

      const status = result.passed ? '✅' : '❌';
      console.log(
        `${status} ${testCase.description}: ${result.actual} (期待値: ${result.expected})`
      );

      TestStats.addTest(
        result.passed,
        !result.passed
          ? {
              description: testCase.description,
              expected: result.expected,
              actual: result.actual,
            }
          : null
      );

      if (verbose && !result.passed) {
        console.log(
          `   🔍 詳細: 要素=${result.element.tagName}, クラス=${result.element.className}`
        );
      }
    } catch (error) {
      console.error(`❌ テストケース ${index + 1} でエラーが発生しました:`, error.message);
      TestStats.addTest(false, { testCase: testCase.description, error: error.message });

      if (stopOnError) return;
    }
  });
}

// ===================================
// テストデータファクトリー（UI Element Classifier 専用）
// ===================================

/**
 * UI要素データファクトリー
 */
const UIElementFactory = {
  create(overrides = {}) {
    const { createMockElement } = UIElementClassifierLogic;
    const defaults = {
      tagName: 'div',
      className: '',
      role: null,
      type: null,
      href: null,
      onclick: null,
      tabindex: null,
      textContent: '',
    };

    const mergedData = { ...defaults, ...overrides };
    const attributes = {};

    // dataAttributesを適切に処理
    if (mergedData.dataAttributes && Array.isArray(mergedData.dataAttributes)) {
      mergedData.dataAttributes.forEach(attr => {
        attributes[attr.name] = attr.value;
      });
    }

    // 基本属性を追加
    Object.keys(mergedData).forEach(key => {
      if (
        key !== 'tagName' &&
        key !== 'textContent' &&
        key !== 'dataAttributes' &&
        mergedData[key] !== null
      ) {
        attributes[key] = mergedData[key];
      }
    });

    return createMockElement(mergedData.tagName, attributes, mergedData.textContent);
  },

  // UI要素専用のファクトリーメソッド
  createTriggerElement(attributes, overrides = {}) {
    return this.create({
      dataAttributes: attributes,
      ...overrides,
    });
  },

  createTranslocoElement(translocoValue, overrides = {}) {
    return this.create({
      dataAttributes: [{ name: 'transloco', value: translocoValue }],
      ...overrides,
    });
  },

  createRoleElement(role, overrides = {}) {
    return this.create({
      role: role,
      ...overrides,
    });
  },
};

// ===================================
// UI Element Classifier 専用テストスイート
// ===================================

/**
 * Triggers属性関連のテスト
 */
const TriggersAttributeTests = {
  run(options = {}) {
    console.log('\n=== UI Triggers属性テスト ===');
    console.log('📝 ポップオーバーやトリガー要素の分類テスト');

    const testCases = [
      {
        description: 'triggers="hover"を持つdiv要素',
        element: UIElementFactory.createTriggerElement(
          [
            { name: 'triggers', value: 'hover' },
            { name: 'aria-label', value: 'スマート時間セレクター' },
          ],
          { className: 'smartClass-icon mrgl6 icon-smart-calendar txt16' }
        ),
        expected: { type: 'action' },
      },
      {
        description: 'placement="bottom"を持つspan要素',
        element: UIElementFactory.createTriggerElement([{ name: 'placement', value: 'bottom' }], {
          tagName: 'span',
          className: 'popover-trigger',
        }),
        expected: { type: 'action' },
      },
      {
        description: 'data-target="#modal"を持つbutton要素',
        element: UIElementFactory.createTriggerElement([{ name: 'data-target', value: '#modal' }], {
          tagName: 'button',
          className: 'btn btn-modal-trigger',
        }),
        expected: { type: 'action' },
      },
    ];

    const classifier = createClassifier(options);
    runTestCases(testCases, classifier, options);
  },
};

/**
 * 静的Transloco関連のテスト
 */
const StaticTranslocoTests = {
  run(options = {}) {
    console.log('\n=== UI 静的Translocoテスト ===');
    console.log('📝 多言語表示パターンの判定テスト');

    const testCases = [
      {
        description: '静的transloco (report.status.maintenance)',
        element: UIElementFactory.createTranslocoElement('report.status.maintenance', {
          tagName: 'span',
          className: 'pull-left padrt15 ng-star-inserted',
        }),
        expected: { type: 'unknown' },
      },
      {
        description: 'インタラクティブtransloco (action.save)',
        element: UIElementFactory.createTranslocoElement('action.save', {
          tagName: 'button',
          className: 'btn btn-primary',
          type: 'button',
        }),
        expected: { type: 'action' },
      },
      {
        description: '静的transloco (status.active)',
        element: UIElementFactory.createTranslocoElement('status.active', {
          tagName: 'span',
          className: 'status-display',
        }),
        expected: { type: 'unknown' },
      },
      {
        description: 'ラベルtransloco (label.username)',
        element: UIElementFactory.createTranslocoElement('label.username', {
          tagName: 'label',
          className: 'form-label',
        }),
        expected: { type: 'unknown' },
      },
    ];

    const classifier = createClassifier(options);
    runTestCases(testCases, classifier, options);
  },
};

/**
 * Role属性関連のテスト
 */
const RoleAttributeTests = {
  run(options = {}) {
    console.log('\n=== UI Role属性テスト ===');
    console.log('📝 ARIA role属性による分類テスト');

    const testCases = [
      {
        description: 'role="button"を持つdiv要素',
        element: UIElementFactory.createRoleElement('button', {
          tagName: 'div',
          className: 'padtop30 mon-smry-crcl-orange',
          dataAttributes: [
            { name: 'tabindex', value: '0' },
            { name: 'aria-label', value: '秒' },
          ],
        }),
        expected: { type: 'action' },
      },
      {
        description: 'role="link"を持つspan要素',
        element: UIElementFactory.createRoleElement('link', {
          tagName: 'span',
          className: 'custom-link',
        }),
        expected: { type: 'navigation' },
      },
      {
        description: 'role="checkbox"を持つdiv要素',
        element: UIElementFactory.createRoleElement('checkbox', {
          tagName: 'div',
          className: 'custom-checkbox',
        }),
        expected: { type: 'toggle' },
      },
    ];

    const classifier = createClassifier(options);
    runTestCases(testCases, classifier, options);
  },
};

/**
 * ContentEditable関連のテスト
 */
const ContentEditableTests = {
  run(options = {}) {
    console.log('\n=== UI ContentEditableテスト ===');
    console.log('📝 編集可能要素の分類テスト');

    const testCases = [
      {
        description: 'contenteditable="true"を持つdiv',
        element: UIElementFactory.create({
          tagName: 'div',
          className: 'editable-content',
          dataAttributes: [{ name: 'contenteditable', value: 'true' }],
        }),
        expected: { type: 'form' },
      },
      {
        description: 'type="submit"を持つinput',
        element: UIElementFactory.create({
          tagName: 'input',
          type: 'submit',
          className: 'submit-button',
        }),
        expected: { type: 'action' },
      },
    ];

    const classifier = createClassifier(options);
    runTestCases(testCases, classifier, options);
  },
};

// ===================================
// メイン実行関数
// ===================================

/**
 * UI Element Classifier の開発テストを実行
 */
function runUIClassifierDevelopmentTests(options = {}) {
  console.log('🧪 UI Element Classifier - Development Tests');
  console.log('==============================================================');
  console.log(
    `📋 実行オプション: verbose=${options.verbose || false}, stopOnError=${options.stopOnError || false}`
  );

  TestStats.reset();
  const startTime = performance.now();

  // テストスイートを実行
  try {
    console.log('📦 Triggers属性テスト を開始...');
    TriggersAttributeTests.run(options);
    console.log('✅ Triggers属性テスト 完了');

    console.log('\n📦 静的Translocoテスト を開始...');
    StaticTranslocoTests.run(options);
    console.log('✅ 静的Translocoテスト 完了');

    console.log('\n📦 Role属性テスト を開始...');
    RoleAttributeTests.run(options);
    console.log('✅ Role属性テスト 完了');

    console.log('\n📦 ContentEditableテスト を開始...');
    ContentEditableTests.run(options);
    console.log('✅ ContentEditableテスト 完了');
  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
    TestStats.addTest(false, { error: error.message });
  }

  const endTime = performance.now();
  const report = TestStats.getReport();

  // 結果レポート
  console.log('\n📊 テスト実行結果');
  console.log('==================');
  console.log(`🏁 実行時間: ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`📦 テストスイート: ✅ 4/4 完了`);
  console.log(
    `🧪 個別テスト: ✅ ${report.passed}/${report.total} 成功 (成功率: ${report.successRate})`
  );

  if (report.failed > 0) {
    console.log(`❌ 失敗したテスト: ${report.failed}個`);
    console.log('⚠️ 一部のテストでエラーまたは失敗が発生しました。');
    console.log('📋 詳細を確認して必要に応じて修正してください。');
  } else {
    console.log('🎉 すべてのテストが正常に完了しました！');
    console.log('🚀 UI Element Classifier は期待通りに動作しています。');
  }

  return report;
}

// ===================================
// コマンドライン実行対応
// ===================================

if (require.main === module) {
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    stopOnError: args.includes('--stop-on-error') || args.includes('-s'),
  };

  runUIClassifierDevelopmentTests(options);
}

module.exports = {
  runUIClassifierDevelopmentTests,
  UIElementFactory,
  TestStats,
  // 個別テストスイートもエクスポート
  TriggersAttributeTests,
  StaticTranslocoTests,
  RoleAttributeTests,
  ContentEditableTests,
};
