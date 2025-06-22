# 🚀 セットアップガイド

## 📋 前提条件

- **Node.js 18+** - [Node.js 公式サイト](https://nodejs.org/)からダウンロード
- **npm** - Node.js に同梱
- **Git** - バージョン管理用

## 🔧 開発環境セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/baku2san/bookmarklet-gallery.git
cd bookmarklet-gallery
```

### 2. 依存関係のインストール

```bash
cd bookmarklets
npm install
```

### 3. ビルドとテスト

```bash
# 本番ビルド
npm run build

# 開発モード（ファイル監視）
npm run watch

# ローカルサーバー起動
npm run serve
```

## 🌐 GitHub Pages デプロイ

詳細は [`docs/GITHUB_PAGES_SETUP.md`](./GITHUB_PAGES_SETUP.md) を参照してください。

## 🔄 開発ワークフロー

1. **新機能開発**: `feature/機能名` ブランチで作業
2. **テスト**: ローカルでビルド・動作確認
3. **PR 作成**: main ブランチに向けてプルリクエスト
4. **自動デプロイ**: マージ後、GitHub Pages に自動デプロイ

## 📁 プロジェクト構造

```tree
📦 bookmarklet-gallery/
├── 📁 bookmarklets/           # メインプロジェクト
│   ├── 📁 src/               # ソースコード
│   ├── 📁 dist/              # ビルド成果物
│   ├── 📄 package.json       # Node.js設定
│   └── 📄 build-production.js # ビルドスクリプト
├── 📁 docs/                  # ドキュメント
├── 📁 .github/               # GitHub設定
└── 📄 README.md              # プロジェクト概要
```

## 🆘 トラブルシューティング

### Node.js 関連エラー

```bash
# node_modulesを削除してクリーンインストール
rm -rf bookmarklets/node_modules
cd bookmarklets
npm install
```

### ビルドエラー

```bash
# ビルドファイルをクリーン
npm run clean
npm run build
```

### GitHub Pages デプロイエラー

1. Actions タブでエラーログを確認
2. リポジトリが Public であることを確認
3. Pages 設定で "GitHub Actions" が選択されていることを確認

---

❓ **その他の問題**: [Issues](https://github.com/baku2san/bookmarklet-gallery/issues) でお知らせください
