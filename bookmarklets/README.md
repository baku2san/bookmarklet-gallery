# Shima Bookmarklets

Shima Inner Source プロジェクトのブックマークレット集です。生産性向上と開発支援のためのツールを提供します。

## 🎯 開発戦略

- **開発版**: 可読性重視（コメント・フォーマット保持）- Git 管理対象
- **本番版**: install.html でのみ minify 適用（サイズ最適化）- ブラウザ実行用
- **ベストプラクティス**: 開発と本番の分離による保守性向上

## 🚀 特徴

- **自動ビルドシステム**: JavaScript ファイルから自動的にインストールページを生成
- **スマート minify**: 本番版のみサイズ最適化、開発版は可読性保持
- **安全な HTML エスケープ**: 複雑なコードを安全に HTML 属性値として埋め込み
- **カテゴリ管理**: 生産性向上ツールと開発支援ツールを分類

## 📁 ファイル構造

```
src/bookmarklets/
├── build-production.js     # 本番用ビルドスクリプト
├── package.json            # Node.js 設定
├── install.html            # 自動生成されるインストールページ
├── README.md               # このファイル
├── productivity/           # 生産性向上ツール
│   ├── debug-test.js       # デバッグテストツール
│   ├── simple-test.js      # シンプルテストツール
│   ├── page-analyzer-simple.js # ページ分析ツール
│   └── sharepoint-navigator.js # SharePoint ナビゲーター
└── development/            # 開発支援ツール
    ├── css-inspector.js    # CSS検査ツール
    ├── api-tester.js       # API テスター
    └── sharepoint-api-navigator.js # SharePoint API ナビゲーター
```

## 🔨 ビルドシステム

### 🆕 新規環境での初回セットアップ

#### 方法 1: PowerShell スクリプト（推奨）

```powershell
# プロジェクトルートから実行
.\scripts\setup.ps1 -Build    # セットアップ + ビルド実行
```

**利用可能なオプション:**

- `.\scripts\setup.ps1` - 基本セットアップのみ
- `.\scripts\setup.ps1 -Build` - セットアップ + ビルド実行
- `.\scripts\setup.ps1 -Watch` - セットアップ + ファイル監視モード
- `.\scripts\setup.ps1 -Clean` - 既存ファイルクリーンアップ付きセットアップ

#### 方法 2: npm コマンド

```powershell
# bookmarkletsディレクトリに移動
cd src/bookmarklets

# セットアップ + ビルド
npm run setup:build

# または段階的に実行
npm install      # 依存関係インストール
npm run build    # ビルド実行
```

### ビルド実行

```powershell
# 本番用ビルド
npm run build
# または
node build-production.js

# ビルド実行 + 成功メッセージ表示
npm run dev

# ファイル監視モード（JSファイルが変更されたら自動ビルド）
npm run watch

# 生成ファイルのクリーンアップ
npm run clean
```

### ビルドプロセス

1. **ソースファイル読み込み**: `productivity/` フォルダー内の JS ファイルを読み込み
2. **コメント削除**: 行コメント（`//`）とブロックコメント（`/* */`）を削除
3. **コード圧縮**: 空白や改行を削除して 1 行に圧縮
4. **エンコード判定**: 複雑な文字列が含まれる場合は URL エンコードを適用
5. **HTML 生成**: テンプレートにブックマークレットを埋め込んで install.html を生成

- **対象**: 全 Web ページ

#### Quick Notes

ページ上で簡単にメモを作成

- **機能**: ページ上にメモパネルを表示、ローカル保存
- **用途**: Web リサーチ、情報収集
- **対象**: 全 Web ページ

#### Tab Manager

開いているタブを管理

- **機能**: タブの整理、重複タブの検出、一括操作
- **用途**: ブラウザパフォーマンス向上
- **対象**: 全ブラウザタブ

#### SharePoint Navigator

SharePoint サイト内での包括的なナビゲーション（大幅機能強化版）

- **機能**:
  - TopSite/ChildSite 自動判別
  - 60+ の主要ページへの直接リンク
  - フィルター機能（リアルタイム検索）
  - 使用頻度インジケーター（⭐ よく使う　 🔷 中程度　 ○ 低頻度）
  - Base URL コピー
- **カテゴリ**: よく使う機能、ユーザー・権限、ギャラリー、サイト管理、外観、開発・デバッグ等
- **用途**: SharePoint サイト内の効率的な移動・管理
- **対象**: SharePoint サイト

#### SharePoint API Navigator 🆕

SharePoint REST API の探索・テスト

- **機能**:
  - 基本的な SharePoint REST API エンドポイント選択
  - API レスポンスの表示（JSON/テーブル形式）
  - フィルタリング・ソート機能
  - Lists API の詳細表示
  - リスト選択からフィールド詳細表示
  - User 列カスタム表示機能
- **用途**: SharePoint API の開発・テスト・トラブルシューティング
- **対象**: SharePoint サイト

### 🛠️ 開発支援ツール

#### CSS Inspector

CSS プロパティの詳細調査

- **機能**: 要素の CSS 情報表示、継承関係の可視化
- **用途**: フロントエンド開発、デバッグ
- **対象**: HTML 要素

#### API Tester

API エンドポイントのテスト

- **機能**: HTTP リクエスト送信、レスポンス表示
- **用途**: API 開発、動作確認
- **対象**: Web API

#### Performance Monitor

ページパフォーマンスの監視

- **機能**: 読み込み時間、リソースサイズの表示
- **用途**: パフォーマンス最適化
- **対象**: 全 Web ページ

## 💡 カスタマイズ

### 基本構造

```javascript
javascript: (function () {
  // Your code here

  // ツールパネルの作成
  var panel = document.createElement("div");
  panel.id = "shima-bookmarklet-panel";
  panel.style.cssText = "position:fixed;top:10px;right:10px;z-index:10000;...";

  // 機能の実装
  function yourFunction() {
    // Implementation
  }

  // イベントリスナーの設定
  panel.addEventListener("click", yourFunction);

  // DOMに追加
  document.body.appendChild(panel);
})();
```

### スタイリング指針

```css
/* 既存サイトに影響しないスタイル */
#shima-bookmarklet-panel {
  all: initial;
  position: fixed !important;
  z-index: 2147483647 !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
  font-size: 14px !important;
}
```

## 🔧 開発ガイドライン

### セキュリティ

- **XSS 対策**: ユーザー入力の適切なエスケープ
- **CSP 遵守**: Content Security Policy の考慮
- **外部リソース**: 最小限の外部依存

### パフォーマンス

- **最小化**: コードの最小化と gzip 圧縮
- **非同期処理**: 重い処理の非同期化
- **メモリ管理**: イベントリスナーの適切な削除

### 互換性

- **ブラウザ対応**: 主要ブラウザでの動作確認
- **ES5 準拠**: 古いブラウザでも動作する記法
- **Polyfill**: 必要に応じた polyfill の提供

### ユーザビリティ

- **視覚的フィードバック**: 実行状況の明示
- **エラーハンドリング**: 適切なエラー処理
- **終了方法**: ツールの終了・クリア機能

## 📋 テスト

### 手動テスト

1. **各ブラウザでの動作確認**
   - Chrome, Firefox, Safari, Edge
2. **異なる Web サイトでのテスト**
   - 静的サイト、SPA、EC サイト等
3. **エラーケースの確認**
   - ネットワークエラー、権限エラー等

### 自動テスト

```javascript
// テスト用のブックマークレット
javascript: (function () {
  // テストケースの実行
  var tests = [
    { name: "DOM要素の存在確認", test: () => document.body !== null },
    {
      name: "jQuery の読み込み確認",
      test: () => typeof jQuery !== "undefined",
    },
  ];

  tests.forEach((test) => {
    console.log(test.name + ":", test.test() ? "PASS" : "FAIL");
  });
})();
```

## 🌐 配布方法

### GitHub Pages

1. **install.html** を GitHub Pages で公開
2. **ユーザーマニュアル** の提供
3. **バージョン管理** による更新追跡

### 社内 Wiki

1. **使用方法の文書化**
2. **カテゴリ別の整理**
3. **利用実績の追跡**

### Browser Bookmarks

1. **ブックマークファイル** のエクスポート
2. **一括インストール** の提供
3. **グループ単位** での配布

## 📚 参考資料

- [Bookmarklet Best Practices](https://www.bookmarklets.com/tools/bookmarklet-guidelines.html)
- [JavaScript Security Guidelines](https://developer.mozilla.org/docs/Web/Security)
- [Browser Compatibility Guide](https://caniuse.com/)

## 🤝 貢献方法

1. 新しいブックマークレットの作成
2. 既存ツールの改善・最適化
3. ドキュメントの更新
4. テストケースの追加

## 📝 ライセンス

MIT License - 詳細は [LICENSE](../../LICENSE) ファイルを参照
