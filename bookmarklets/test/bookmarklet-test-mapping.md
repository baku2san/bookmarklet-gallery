# ブックマークレット テスト対応表

このファイルは、各ブックマークレットとそのテストファイルの対応関係を管理します。

## 📁 テスト構造

```text
test/
├── by-bookmarklet/           # ブックマークレット別テスト
│   ├── ui-element-classifier/
│   │   ├── main.test.js            # メインテスト
│   │   ├── development.test.js     # 開発用テスト
│   │   ├── fixtures/               # テストデータ
│   │   └── extracted-logic/        # 自動抽出ロジック
│   ├── api-tester/
│   │   └── api-tester.test.js
│   ├── css-inspector/
│   │   └── css-inspector.test.js
│   ├── gmail-manager/
│   │   ├── gmail-manager.test.js
│   │   └── security.test.js
│   └── sharepoint-navigator/
│       └── sharepoint-navigator.test.js
├── shared/                   # 共通テストユーティリティ
│   ├── mock-dom.js
│   ├── test-runner.js
│   └── common-assertions.js
└── integration/              # 統合テスト
    └── all-bookmarklets.test.js
```

## 🔗 ブックマークレット対応表

| カテゴリ     | ブックマークレット       | ソースファイル                                | テストファイル                                  | ステータス |
| ------------ | ------------------------ | --------------------------------------------- | ----------------------------------------------- | ---------- |
| Development  | UI Element Classifier    | `src/development/ui-element-classifier.js`    | `test/by-bookmarklet/ui-element-classifier/`    | ✅ 完了    |
| Development  | API Tester               | `src/development/api-tester.js`               | `test/by-bookmarklet/api-tester/`               | ❌ 未実装  |
| Development  | CSS Inspector            | `src/development/css-inspector.js`            | `test/by-bookmarklet/css-inspector/`            | ❌ 未実装  |
| Development  | Edge Explorer            | `src/development/edge-explorer.js`            | `test/by-bookmarklet/edge-explorer/`            | ❌ 未実装  |
| Development  | SharePoint API Navigator | `src/development/sharepoint-api-navigator.js` | `test/by-bookmarklet/sharepoint-api-navigator/` | ❌ 未実装  |
| Productivity | Gmail Manager            | `src/productivity/gmail-manager.js`           | `test/by-bookmarklet/gmail-manager/`            | ❌ 未実装  |
| Productivity | SharePoint Navigator     | `src/productivity/sharepoint-navigator.js`    | `test/by-bookmarklet/sharepoint-navigator/`     | ❌ 未実装  |
| Productivity | Lists Column Formatter   | `src/productivity/lists-column-formatter.js`  | `test/by-bookmarklet/lists-column-formatter/`   | ❌ 未実装  |
| Productivity | Page Analyzer            | `src/productivity/page-analyzer.js`           | `test/by-bookmarklet/page-analyzer/`            | ❌ 未実装  |
| Productivity | Hello World              | `src/productivity/hello-world.js`             | `test/by-bookmarklet/hello-world/`              | ❌ 未実装  |
| Productivity | Debug Test               | `src/productivity/debug-test.js`              | `test/by-bookmarklet/debug-test/`               | ❌ 未実装  |
| Productivity | Simple Test              | `src/productivity/simple-test.js`             | `test/by-bookmarklet/simple-test/`              | ❌ 未実装  |
| Utility      | File Downloader          | `src/utility/file-downloader.js`              | `test/by-bookmarklet/file-downloader/`          | ❌ 未実装  |
| Utility      | Utility Tools            | `src/utility/utility-tools.js`                | `test/by-bookmarklet/utility-tools/`            | ❌ 未実装  |

## 🚀 テスト実行方法

### 個別ブックマークレットのテスト

```bash
# UI Element Classifier のテスト
npm run test:ui-classifier

# API Tester のテスト
npm run test:api-tester

# Gmail Manager のテスト
npm run test:gmail-manager
```

### カテゴリ別テスト

```bash
# Development カテゴリ全体
npm run test:development

# Productivity カテゴリ全体
npm run test:productivity

# Utility カテゴリ全体
npm run test:utility
```

### 全テスト実行

```bash
# すべてのブックマークレット
npm run test:all
```

## 📝 テストファイル命名規則

1. **メインテストファイル**: `{bookmarklet-name}.test.js`
2. **開発用テスト**: `{bookmarklet-name}.dev.test.js`
3. **セキュリティテスト**: `{bookmarklet-name}.security.test.js`
4. **パフォーマンステスト**: `{bookmarklet-name}.perf.test.js`

## 🔧 テスト種類

### A. 基本機能テスト

- 主要機能の動作確認
- 入力検証
- 出力検証

### B. セキュリティテスト

- XSS防止
- CSP対応
- 入力サニタイゼーション

### C. パフォーマンステスト

- 実行時間測定
- メモリ使用量
- DOM操作効率

### D. 統合テスト

- 他のブックマークレットとの競合チェック
- ページ環境での動作確認

## 📋 更新履歴

| 日付       | 更新内容                               | 担当者    |
| ---------- | -------------------------------------- | --------- |
| 2025-06-29 | 初期版作成、UI Element Classifier 完了 | Assistant |
