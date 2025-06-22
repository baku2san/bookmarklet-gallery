# 📋 ブックマークレット設定ガイド

## 🎯 新しい設定ファイルシステム

ブックマークレットの管理が大幅に簡単になりました！

### ✅ 改善点

**Before (従来)**:
- ❌ JavaScriptファイルを作成
- ❌ `build-production.js` の `BOOKMARKLETS` 配列を手動編集
- ❌ ハードコードされた設定

**After (新システム)**:
- ✅ JavaScriptファイルを作成
- ✅ `gallery.yml` に設定を追加
- ✅ 自動ビルド・検出

## 📝 新しいブックマークレットの追加方法

### 1. JavaScriptファイルを作成

```javascript
// productivity/my-tool.js
/**
 * My Awesome Tool
 * @description ここに説明を書く
 */
(function() {
  'use strict';
  
  // ここにコードを書く
  alert('Hello from My Tool!');
})();
```

### 2. 設定ファイルに登録

`gallery.yml` に追加:

```yaml
  - id: "my-tool"
    file: "my-tool.js"
    category: "productivity"  # or "development"
    title: "My Awesome Tool"
    icon: "⚡"
    description: "素晴らしいツールの説明"
    features:
      - "機能1"
      - "機能2"
      - "機能3"
    enabled: true
```

### 3. ビルド実行

```bash
npm run build
```

これだけ！🎉

## 📁 ファイル構造

```
bookmarklets/
├── gallery.yml                # 📋 公開設定ファイル（重要！）
├── build-production.js        # ビルドスクリプト
├── productivity/              # 生産性ツール
│   ├── hello-world.js
│   ├── debug-test.js
│   └── ...
├── development/               # 開発ツール
│   ├── api-tester.js
│   ├── css-inspector.js
│   └── ...
└── install.html              # 生成されるギャラリー
```

## ⚙️ 設定オプション

### カテゴリ設定

```yaml
categories:
  productivity:
    name: "🎯 Productivity Tools"
    description: "日常業務の効率化ツール"
    order: 1
  
  custom-category:
    name: "🔧 Custom Tools"
    description: "カスタムツール"
    order: 3
```

### ブックマークレット設定

```yaml
  - id: "unique-id"           # 一意のID
    file: "script.js"         # JSファイル名
    category: "productivity"  # カテゴリ
    title: "Display Name"     # 表示名
    icon: "🚀"               # アイコン（絵文字）
    description: "説明文"     # 詳細説明
    features:                # 機能リスト
      - "機能1"
      - "機能2"
    enabled: true            # true/false (無効化可能)
```

### ビルド設定

```yaml
build:
  autoDetect: true           # 自動検出有効
  searchDirs:               # 検索ディレクトリ
    - "./productivity"
    - "./development"
    - "./custom"
  outputFile: "./install.html"
  minify: true              # 圧縮有効/無効
  development: false        # 開発モード
```

## 🛠️ 高度な使用方法

### 無効化/有効化

一時的に無効にする:
```yaml
  - id: "temporary-disabled"
    enabled: false  # この行を追加
```

### カスタムディレクトリ

```yaml
build:
  searchDirs:
    - "./productivity"
    - "./development"
    - "./experimental"  # 新しいディレクトリ
```

### 非圧縮モード（デバッグ用）

```yaml
build:
  minify: false  # 圧縮無効
```

## 🎮 開発コマンド

```bash
# 一度だけビルド
npm run build

# 監視モード（自動リビルド）
npm run watch

# ローカルプレビュー
npm run preview

# デプロイ前確認
npm run deploy:check
```

## 💡 Tips

1. **アイコン**: 絵文字を使用すると見た目が良い
2. **カテゴリ**: 用途別に分類すると管理しやすい
3. **説明**: わかりやすい説明を心がける
4. **機能**: 主要機能を箇条書きで明記
5. **テスト**: 追加後は必ずテスト実行

---

これで新しいブックマークレットの追加が格段に簡単になりました！🚀
