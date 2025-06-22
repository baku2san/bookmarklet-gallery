# 🏗️ 新しいディレクトリ構造

生成物と管理対象ファイルを分離し、より管理しやすい構造に変更されました。

## 📁 ディレクトリ構造

```
bookmarklets/
├── src/                          # ソースファイル（Git管理対象）
│   ├── gallery.yml               # 公開設定ファイル
│   ├── productivity/             # 生産性ツール
│   ├── development/              # 開発ツール
│   └── test-pages/               # テストページ
├── dist/                         # 生成物（Git除外）
│   ├── install.html              # メインギャラリー
│   └── dev.html                  # 開発者向けページ
├── build-production.js           # ビルドスクリプト
├── package.json                  # npm設定
└── .gitignore                    # Git除外設定
```

## ✅ 改善された点

### 🎯 ファイル管理
- **ソース**: `src/` ディレクトリで管理
- **生成物**: `dist/` ディレクトリに出力
- **Git管理**: 生成物は自動的に除外

### 🚀 ビルドプロセス
- **設定ファイル**: `src/gallery.yml`
- **出力先**: `dist/install.html`
- **テストページ**: 自動的に `dist/test-pages/` にコピー

### 🛠️ 開発体験
- **監視モード**: `src/` ディレクトリ全体を監視
- **プレビュー**: `dist/` ディレクトリでサーバー起動
- **クリーン**: `dist/` ディレクトリを削除

## 🔧 コマンド更新

```bash
# ビルド
npm run build

# 監視モード（src/を監視）
npm run watch

# プレビュー（distディレクトリでサーバー起動）
npm run preview

# クリーンアップ（distディレクトリ削除）
npm run clean

# デプロイ前確認
npm run deploy:check
```

## 📋 新しいブックマークレット追加手順

### 1. JSファイルを作成
```bash
# 適切なディレクトリに作成
src/productivity/my-tool.js
# または
src/development/my-tool.js
```

### 2. 設定ファイルに登録
`src/bookmarklets.yml` に追加:
```yaml
  - id: "my-tool"
    file: "my-tool.js"
    category: "productivity"
    title: "My Tool"
    icon: "⚡"
    description: "説明"
    enabled: true
```

### 3. ビルド
```bash
npm run build
```

## 🌐 GitHub Pages デプロイ

新しい構造に対応:
- **ソース**: `src/` から読み込み
- **ビルド**: `dist/install.html` を生成
- **デプロイ**: `dist/install.html` → `index.html`
- **テストページ**: `dist/test-pages/` → GitHub Pagesの`test-pages/`

## 🎉 利点

1. **明確な分離**: ソースと生成物が明確に分離
2. **Git管理**: 生成物は自動的に除外される
3. **クリーンな作業環境**: 不要ファイルが混在しない
4. **簡単なクリーンアップ**: `npm run clean` で一括削除
5. **GitHub Actions対応**: 新しい構造に自動対応

これでより専門的で管理しやすいプロジェクト構造になりました！🚀
