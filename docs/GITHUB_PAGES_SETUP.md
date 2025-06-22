# 🌐 GitHub Pages セットアップガイド

このガイドに従って GitHub Pages を有効化してください。

## 📋 セットアップ手順

### 1. リポジトリを Public に設定

1. GitHub 上でリポジトリページにアクセス
2. **Settings** タブをクリック
3. **General** セクションで **Change repository visibility** をクリック
4. **Change to public** を選択

### 2. GitHub Pages を有効化

1. **Settings** > **Pages** にアクセス
2. **Source** セクションで **GitHub Actions** を選択
3. 設定を保存

### 3. 初回デプロイ

1. main ブランチにコードを push:

   ```bash
   git add .
   git commit -m "feat: GitHub Pages自動デプロイ設定"
   git push origin main
   ```

2. **Actions** タブでデプロイ状況を確認
3. 完了後、以下の URL でアクセス可能:
   ```
   https://baku2san.github.io/bookmarklet-gallery
   ```

## 🔄 自動デプロイの仕組み

### トリガー条件

- ✅ main ブランチへの push
- ✅ PR の main ブランチへのマージ
- ✅ 手動実行（Actions 画面から）

### デプロイフロー

1. **🔨 ビルド**: `npm run build`で dist/install.html と dist/dev.html を生成
2. **📁 準備**: dist/install.html を index.html としてコピー
3. **🌐 デプロイ**: GitHub Pages に自動配信

## 📍 生成される URL

メインページ:

```
https://baku2san.github.io/bookmarklet-gallery/
```

テストページ（もしあれば）:

```
https://baku2san.github.io/bookmarklet-gallery/test-sharepoint.html
https://baku2san.github.io/bookmarklet-gallery/test-sharepoint-api.html
```

## ⚠️ 注意事項

1. **初回デプロイ**: 設定後、初回は 5-10 分程度かかる場合があります
2. **キャッシュ**: 変更が反映されない場合はブラウザキャッシュをクリア
3. **カスタムドメイン**: 必要に応じて Settings > Pages で Custom domain を設定可能

## 🔧 トラブルシューティング

### デプロイが失敗する場合

1. **Actions** タブでエラーログを確認
2. `bookmarklets/package.json`の依存関係を確認
3. Node.js バージョンの互換性をチェック

### ページが表示されない場合

1. GitHub Pages の設定を再確認
2. リポジトリが Public になっているか確認
3. `.nojekyll`ファイルが存在するか確認
