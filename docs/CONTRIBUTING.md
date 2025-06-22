# 🤝 貢献ガイドライン

## 📋 貢献の種類

### 🐛 バグ報告

- [Issues](https://github.com/baku2san/bookmarklet-gallery/issues) でバグを報告
- 可能な限り詳細な再現手順を記載

### 💡 機能提案

- [Issues](https://github.com/baku2san/bookmarklet-gallery/issues) で新機能を提案
- 用途と期待する動作を明確に記載

### 🔧 コード貢献

- Fork → Branch → PR の流れで貢献
- 下記のコーディング規約に従う

## 🌿 ブランチ戦略

```tree
main           # 本番環境（GitHub Pages）
├── feature/*  # 新機能開発
├── bugfix/*   # バグ修正
└── docs/*     # ドキュメント更新
```

### ブランチ命名規則

```bash
feature/機能名              # 例: feature/dark-mode
bugfix/バグ内容             # 例: bugfix/sharepoint-auth
docs/ドキュメント内容        # 例: docs/setup-guide
```

## 📝 コーディング規約

### JavaScript

```javascript
// ✅ Good: 関数型アプローチ
const analyzePageStructure = () => {
  const elements = document.querySelectorAll("*");
  return Array.from(elements).map((el) => ({
    tag: el.tagName,
    classes: Array.from(el.classList),
  }));
};

// ❌ Bad: グローバル変数の多用
var elements;
function analyze() {
  elements = document.querySelectorAll("*");
  // ...
}
```

### ファイル構成

```tree
src/
├── category/              # カテゴリ別フォルダー
│   ├── tool-name.js      # kebab-case命名
│   └── CHANGELOG.md      # 変更履歴
└── gallery.yml           # メタデータ
```

### コミットメッセージ

```bash
type(scope): 概要

詳細説明（必要に応じて）

# 例
feat(productivity): ページ解析ツールに画像最適化チェック機能を追加
fix(sharepoint): 認証エラーでリダイレクトできない問題を修正
docs(readme): セットアップ手順を更新
```

#### Type 一覧

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `style`: コード整形
- `refactor`: リファクタリング
- `test`: テスト追加/修正
- `chore`: その他

## 🧪 テストガイドライン

### 1. 手動テスト

新しいブックマークレットは以下の環境で動作確認：

- **ブラウザ**: Chrome, Firefox, Edge, Safari
- **サイト**: 一般的な Web サイト、SharePoint、Office 365

### 2. テストチェックリスト

- [ ] エラーハンドリング（存在しない要素へのアクセス等）
- [ ] セキュリティ（XSS 対策、CSP 準拠）
- [ ] パフォーマンス（大規模ページでの動作）
- [ ] ユーザビリティ（直感的な操作）

## 📮 プルリクエストガイドライン

### PR 作成前

1. **最新の main ブランチを取得**

   ```bash
   git checkout main
   git pull origin main
   git checkout feature/your-feature
   git rebase main
   ```

2. **ローカルテスト**

   ```bash
   cd bookmarklets
   npm run build
   # 生成されたdist/dev.htmlで動作確認
   ```

### PR 説明テンプレート

```markdown
## 📋 変更内容

- [ ] 新機能追加
- [ ] バグ修正
- [ ] ドキュメント更新
- [ ] その他: ****\_\_\_****

## 🎯 概要

簡潔に変更内容を説明

## 🧪 テスト方法

動作確認方法を記載

## 📸 スクリーンショット

（UI 変更がある場合）

## ✅ チェックリスト

- [ ] ローカルでビルド成功
- [ ] 複数ブラウザで動作確認
- [ ] ドキュメント更新（必要に応じて）
```

## 🔄 レビュープロセス

1. **自動チェック**: GitHub Actions によるビルドテスト
2. **コードレビュー**: メンテナーによるレビュー
3. **承認・マージ**: 問題なければ main ブランチにマージ
4. **自動デプロイ**: GitHub Pages に自動デプロイ

## 📞 質問・相談

- **Issue**: 一般的な質問・バグ報告
- **Discussion**: アイデア相談・設計議論
- **PR Comments**: 実装に関する具体的な相談

---

🙏 **貢献いただき、ありがとうございます！**
