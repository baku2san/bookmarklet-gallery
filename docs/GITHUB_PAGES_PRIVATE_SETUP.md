# GitHub Pages 設定ガイド（プライベートリポジトリ）

## 前提条件

- GitHub Pro、Team、または Enterprise プラン
- プライベートリポジトリ

## 設定手順

### 1. リポジトリ設定

1. リポジトリの **Settings** タブを開く
2. 左サイドバーの **Pages** をクリック
3. **Source** で "GitHub Actions" を選択

### 2. ワークフロー設定

上記の `.github/workflows/deploy-pages.yml` を使用

### 3. 権限設定

Settings > Actions > General で以下を確認：

- Workflow permissions: "Read and write permissions"
- Allow GitHub Actions to create and approve pull requests: チェック

### 4. Pages 設定確認

Settings > Pages で：

- Source: "GitHub Actions"
- Custom domain: 必要に応じて設定

## ビルド・デプロイの流れ

1. コードを push
2. GitHub Actions が自動実行
3. bookmarklets フォルダで npm run build
4. ビルド結果を GitHub Pages にデプロイ
5. <https://username.github.io/repository-name> でアクセス可能

## トラブルシューティング

### ビルドエラーの場合

- Actions タブでログを確認
- package.json の scripts を確認
- 依存関係の問題をチェック

### デプロイエラーの場合

- Pages 設定を再確認
- 権限設定をチェック
- ワークフロー権限を確認

## セキュリティ考慮事項

- プライベートリポジトリでも Pages は公開される
- 機密情報をビルド結果に含めない
- 必要に応じて basic 認証や IP 制限を検討
