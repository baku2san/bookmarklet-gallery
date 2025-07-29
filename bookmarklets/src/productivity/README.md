# 📊 Lists Column Formatter

Microsoft Lists の JSON 列書式設定を簡単に管理・共有できるブックマークレットです。

## 🚀 クイックスタート

### 使用方法

1. Microsoft Lists または SharePoint のリストページを開く
2. ブックマークレットを実行
3. ツールパネルが表示されます

## ✨ 主な機能

### 💾 書式の保存・管理

- よく使う書式をローカルに保存
- 書式の削除
- 最大50件まで保存

### 📋 クリップボード共有

- 書式をクリップボードにコピー
- 他のユーザーとの書式共有
- JSON形式での書式インポート

### 🔧 開発中の機能

- 📥 書式の取得: 現在のリストから列書式を取得
- 📤 書式の適用: 保存した書式を現在のリストに適用

## 🌐 対応プラットフォーム

- ✅ SharePoint Online
- ✅ SharePoint Server
- ✅ OneDrive for Business
- ✅ OneDrive Consumer
- ✅ Microsoft Lists

## 📁 ファイル構成

```
bookmarklets/src/productivity/
├── lists-column-formatter.js  # 単一ファイルのブックマークレット
└── README.md                  # このファイル
```

## 🔧 技術仕様

### 依存関係

- なし（単一ファイルで完結）
- ブラウザのローカルストレージ
- Clipboard API

### 対応ブラウザ

- Chrome 80+
- Edge 80+
- Firefox 75+
- Safari 13+

### セキュリティ

- XSS 対策済み
- ローカルストレージのみ使用
- 外部依存なし

## 🎯 使用例

### 書式の共有方法

1. 書式管理画面で📋ボタンをクリック
2. クリップボードにコピーされた書式データを共有
3. 受け取った側は「📋 インポート」でインポート

### 書式データの形式

```json
{
  "type": "lists-column-format",
  "version": "1.0",
  "format": {
    "name": "書式名",
    "description": "書式の説明",
    "columnType": "Text",
    "formatJson": {
      /* SharePoint列書式JSON */
    },
    "sourceList": "元のリスト名",
    "sourceColumn": "元の列名"
  }
}
```

## 🔧 トラブルシューティング

### よくある問題

**Q: ツールが起動しない**
A: SharePoint/OneDrive/Microsoft Lists のページで実行していることを確認してください。

**Q: 保存した書式が消える**
A: ブラウザのローカルストレージが無効になっていないか確認してください。

**Q: クリップボード機能が動作しない**
A: HTTPS環境で実行していることを確認してください。

## 📝 更新履歴

### v1.0.0 (2024-01-25)

- 単一ファイル版として再構築
- 基本的な書式保存・管理機能
- クリップボード共有機能
- 外部依存を完全に削除

## 🤝 貢献

バグ報告や機能要望は Issues でお知らせください。

## 📄 ライセンス

MIT License

---

**注意**: このツールは Microsoft 公式のものではありません。使用は自己責任でお願いします。
