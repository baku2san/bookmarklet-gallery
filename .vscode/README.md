# VS Code スニペット for ブックマークレット開発

この `.vscode` 設定により、ブックマークレット開発が効率的になります。

## 設定ファイルの説明

### 🛠️ `settings.json`
- **自動保存**: ファイル変更時の自動保存を有効化
- **フォーマット**: Prettier による自動フォーマット
- **タブ設定**: 2スペースのインデント
- **ファイル除外**: `node_modules` を非表示、`dist` フォルダは表示

### ⚡ `tasks.json`
以下のタスクが利用可能です：
- **🔨 ブックマークレットをビルド** (`Ctrl+Shift+B`)
- **👀 開発モード（ウォッチ）** (`Ctrl+Shift+W`)
- **🚀 ローカルサーバー起動** (`Ctrl+Shift+S`)
- **🧹 ビルドファイルをクリーン** (`Ctrl+Shift+C`)

### 🐛 `launch.json`
デバッグ設定：
- **🔍 現在のJSファイルをデバッグ**: 選択中のJavaScriptファイルを実行
- **🏗️ ビルドスクリプトをデバッグ**: ビルドプロセスをデバッグ
- **🌐 ブラウザでギャラリーを開く**: ローカルサーバーでプレビュー

### 📦 `extensions.json`
推奨拡張機能：
- **Prettier**: コードフォーマット
- **Live Server**: HTMLプレビュー
- **GitLens**: Git統合強化
- **Material Icon Theme**: ファイルアイコン

## 使用方法

1. **初回セットアップ**:
   ```bash
   Ctrl+Shift+P → "Tasks: Run Task" → "📦 依存関係をインストール"
   ```

2. **開発開始**:
   ```bash
   Ctrl+Shift+W  # ウォッチモード開始
   ```

3. **ビルド**:
   ```bash
   Ctrl+Shift+B  # ビルド実行
   ```

4. **プレビュー**:
   ```bash
   Ctrl+Shift+S  # ローカルサーバー起動
   ```

## ワークフロー例

1. `bookmarklets/src/development/` または `bookmarklets/src/productivity/` でJSファイルを編集
2. ウォッチモードが自動でビルドを実行
3. `dist/install.html` と `dist/dev.html` が更新される
4. ブラウザで確認してブックマークレットをテスト
