# 📊 Microsoft Lists Column Formatter

Microsoft Lists の JSON 列書式設定を効率化するブックマークレット

## 🎯 概要

Microsoft Lists で列の書式設定（JSON カスタム書式）を行う際、毎回一から設定するのは時間がかかります。このツールは既存の書式を他のリストに流用し、列名の調整も自動で行える支援ツールです。

## ✨ 主な機能

### 📤 書式の取得・保存

- SharePoint サイト内のリスト一覧から選択
- **デフォルトビューの表示列のみ**を対象に列書式を取得
- 列の JSON 書式設定を自動取得
- 書式に名前と説明を付けて保存
- ローカルストレージでの永続化

### 📥 書式の適用

- 保存された書式から選択
- 列タイプの互換性チェック
- 自動列名マッピング（元の列名 → 新しい列名）
- ワンクリックでの書式適用

### 🗂️ 書式の管理

- 保存された書式の一覧表示
- 不要な書式の削除
- 書式の詳細情報表示

### 📋 書式の共有

- クリップボード経由での書式エクスポート
- 他の環境からの書式インポート
- **Microsoft公式のJSON列書式**または**このツールの内部形式**に対応
- 全書式の JSON ファイル出力

## 🚀 使い方

### 1. 基本的な使用手順

1. **SharePoint Lists ページでブックマークレット実行**
   - Microsoft Lists または SharePoint リストページで実行
   - メインパネルが表示されます

2. **書式を取得・保存**
   - 「📤 列書式を取得・保存」をクリック
   - 対象リストを選択（**デフォルトビューの表示列のみが対象**）
   - 書式設定のある列を選択
   - 書式名と説明を入力して保存

3. **書式を適用**
   - 「📥 列書式を適用」をクリック
   - 保存済み書式から選択
   - 適用先のリストと列を選択
   - 自動で列名がマッピングされ、適用

### 2. 書式の共有

**エクスポート（送信側）:**

```
管理画面 → 📋ボタン → クリップボードにコピー → 相手に送信
```

**インポート（受信側）:**

```
メイン画面 → 「📋 クリップボードから書式をインポート」
→ Microsoft公式JSON列書式 または このツールのエクスポート形式 を自動判別してインポート
```

## 🔧 対応する列タイプ

- **Text（単一行テキスト）**
- **Choice（選択肢）**
- **Number（数値）**
- **DateTime（日付と時刻）**
- **Boolean（はい/いいえ）**
- **Person（ユーザー）**
- **Lookup（参照）**
- その他の標準列タイプ

## 💡 使用例

### 進捗バー書式の共有

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div",
  "style": {
    "width": "100%",
    "height": "20px",
    "background-color": "#f3f2f1"
  },
  "children": [
    {
      "elmType": "div",
      "style": {
        "width": "=@currentField + '%'",
        "height": "100%",
        "background-color": "#0078d4"
      }
    }
  ]
}
```

### ステータス条件付き書式

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json",
  "elmType": "div",
  "txtContent": "@currentField",
  "style": {
    "color": "=if(@currentField == '完了', '#107c10', if(@currentField == '進行中', '#ff8c00', '#d13438'))"
  }
}
```

## 🛡️ セキュリティ

- **ローカルストレージ**: データはブラウザのローカルストレージに保存
- **SharePoint API**: 標準的な REST API を使用
- **権限**: 現在のユーザーの SharePoint 権限に依存
- **データ**: 書式 JSON のみを扱い、実際のデータは含まれません

## 🐛 トラブルシューティング

### よくある問題

**Q: 書式の取得に失敗する**

- SharePoint サイトで実行していることを確認
- 対象リストの読み取り権限があることを確認
- ブラウザのセキュリティ設定を確認

**Q: 書式の適用に失敗する**

- 適用先リストの編集権限があることを確認
- 列タイプが互換性があることを確認
- ネットワーク接続を確認

**Q: 保存した書式が消える**

- ブラウザのローカルストレージが有効であることを確認
- プライベートモードでの使用は避ける
- 定期的にエクスポートしてバックアップを作成

### デバッグ情報

問題が発生した場合は、ブラウザの開発者ツールのコンソールでエラーメッセージを確認してください。

## 📚 参考資料

- [Microsoft Lists 列書式設定リファレンス](https://docs.microsoft.com/ja-jp/sharepoint/dev/declarative-customization/column-formatting)
- [SharePoint REST API リファレンス](https://docs.microsoft.com/ja-jp/sharepoint/dev/sp-add-ins/working-with-lists-and-list-items-with-rest)
- [JSON スキーマ仕様](https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json)

## 🤝 コントリビューション

バグ報告や機能要望は GitHub Issues へお願いします。

## 📄 ライセンス

MIT License - 詳細は LICENSE ファイルを参照してください。
