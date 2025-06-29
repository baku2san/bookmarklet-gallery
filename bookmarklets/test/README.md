# テストディレクトリ構造

このディレクトリには、ブックマークレットのテストファイルが整理されて配置されています。

## ディレクトリ構造

```text
test/
├── by-bookmarklet/              # ブックマークレット別のテスト
│   └── ui-element-classifier/   # UI要素分類器のテスト
│       ├── development.test.js  # 開発用テスト
│       └── generated/           # 自動生成ファイル
│           ├── extracted-classifier-logic.js
│           └── extraction.log
├── shared/                      # 共通テストユーティリティ（将来実装予定）
├── archived/                    # アーカイブされた古いテストファイル
│   └── README.md               # アーカイブファイルの説明
├── bookmarklet-test-mapping.md  # ブックマークレットとテストのマッピング表
└── README.md                   # このファイル
```

## テスト実行方法

### 全テスト実行

```bash
npm run test:all
```

### 特定のブックマークレットのテスト実行

```bash
# UI要素分類器のテスト
npm run test:ui-classifier
```

### 開発用テスト（詳細出力）

```bash
npm run test:dev
```

## テストファイルの命名規則

- `development.test.js` - 開発用テスト（デバッグ、検証用）
- `unit.test.js` - 単体テスト（将来実装予定）
- `integration.test.js` - 統合テスト（将来実装予定）

## 新しいテストの追加

1. `by-bookmarklet/` 下に新しいブックマークレット名のフォルダを作成
2. 必要なテストファイルを追加
3. `bookmarklet-test-mapping.md` にマッピング情報を追加
4. `package.json` にテスト実行スクリプトを追加

## 品質基準

- 全テストが100%パスすること
- コードカバレッジ（将来実装予定）
- ESLintの警告・エラーがないこと
- 適切なエラーハンドリングが実装されていること

## アーカイブポリシー

古いテストファイルや使用されなくなったテストは `archived/` フォルダに移動され、
履歴として保管されます。完全な削除は推奨されません。
