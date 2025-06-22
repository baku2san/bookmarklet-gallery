# 📋 公開設定ガイド

このディレクトリには、ブックマークレットギャラリーの公開設定ファイルが含まれています。

## 📄 ファイル構成

### `gallery.yml` - メイン設定ファイル
ブックマークレットギャラリーの全体設定を管理する核となるファイルです。

**設定セクション**:
- **gallery**: ギャラリー全体の情報（タイトル、説明等）
- **categories**: ブックマークレットのカテゴリ定義
- **bookmarklets**: 公開するブックマークレットのリスト
- **build**: ビルド時の動作設定

## 🚀 新しいブックマークレットの追加

### 1. JSファイルを作成
```bash
# 適切なディレクトリに配置
src/productivity/my-new-tool.js
# または
src/development/my-new-tool.js
```

### 2. `gallery.yml` に設定を追加
```yaml
# bookmarklets セクションに追加
  - id: "my-new-tool"           # 一意のID
    file: "my-new-tool.js"      # ファイル名
    category: "productivity"    # カテゴリ
    title: "My New Tool"        # 表示名
    icon: "🛠️"                # アイコン
    description: "新しいツールの説明"
    features:
      - "機能A"
      - "機能B"
      - "機能C"
    enabled: true               # 公開フラグ
```

### 3. ビルド実行
```bash
npm run build
```

## ⚙️ 設定項目詳細

### ブックマークレット設定
| 項目 | 必須 | 説明 | 例 |
|------|------|------|-----|
| `id` | ✅ | 一意のID（英数字・ハイフン） | `"my-tool"` |
| `file` | ✅ | JSファイル名 | `"my-tool.js"` |
| `category` | ✅ | カテゴリ（productivity/development） | `"productivity"` |
| `title` | ✅ | 表示名 | `"My Tool"` |
| `icon` | ✅ | アイコン（絵文字推奨） | `"⚡"` |
| `description` | ✅ | 詳細説明 | `"便利なツール"` |
| `features` | ❌ | 機能リスト | `["機能1", "機能2"]` |
| `enabled` | ❌ | 公開フラグ（デフォルト: true） | `true/false` |

### カテゴリ設定
```yaml
categories:
  my-category:                  # カテゴリID
    name: "🔧 My Category"     # 表示名
    description: "カテゴリの説明"
    order: 3                   # 表示順序
```

### ビルド設定
```yaml
build:
  searchDirs:                  # JSファイル検索ディレクトリ
    - "./src/productivity"
    - "./src/development"
    - "./src/custom"           # カスタムディレクトリ追加可能
  outputFile: "./dist/install.html"  # 出力ファイル
  minify: true                 # JavaScript圧縮
  development: false           # 開発モード
```

## 🎛️ 便利な機能

### 一時的な無効化
```yaml
  - id: "temporary-disabled"
    enabled: false             # この行を追加で一時無効
```

### 新しいカテゴリの追加
```yaml
categories:
  experimental:               # 新カテゴリ
    name: "🧪 Experimental"
    description: "実験的ツール"
    order: 99                 # 最後に表示
```

### 開発モード
```yaml
build:
  minify: false               # 圧縮無効（デバッグ用）
  development: true           # 詳細ログ出力
```

## 🔍 トラブルシューティング

### よくある問題

1. **ビルドエラー**
   - YAMLの構文チェック
   - ファイルパスの確認
   - 必須項目の不足チェック

2. **ブックマークレットが表示されない**
   - `enabled: true` の確認
   - ファイルの存在確認
   - カテゴリの正確性確認

3. **JSファイルが見つからない**
   - ファイルパスの確認
   - `searchDirs` の設定確認
   - ファイル名の一致確認

### 検証コマンド
```bash
# 設定の妥当性確認
npm run build

# 詳細ログでチェック
npm run deploy:check

# ファイル構造確認
npm run preview
```

---

📝 **設定変更後は必ず `npm run build` でテストしてください**
