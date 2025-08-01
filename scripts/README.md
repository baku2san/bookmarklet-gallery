# Scripts ディレクトリ

このディレクトリには、プロジェクト全体の運用・メンテナンス専用スクリプトが格納されています。

## 📁 ファイル一覧

### `setup.ps1` 🚀

新規環境でのプロジェクトセットアップ専用スクリプトです。

#### セットアップ手順

```powershell
# 基本セットアップ
.\scripts\setup.ps1

# セットアップ + ビルド実行
.\scripts\setup.ps1 -Build

# セットアップ + ファイル監視モード
.\scripts\setup.ps1 -Watch

# クリーンアップ付きセットアップ
.\scripts\setup.ps1 -Clean
```

### `diagnose.ps1` 🔍

環境診断・トラブルシューティング専用スクリプトです。

#### 診断手順

```powershell
# 環境診断を実行
.\scripts\diagnose.ps1

# 診断 + 自動修復を試行
.\scripts\diagnose.ps1 -Fix

# 詳細な診断情報を表示
.\scripts\diagnose.ps1 -Detailed
```

### `update-deps.ps1` 🔒

依存関係の管理とセキュリティ監査専用スクリプトです。

#### 依存関係管理手順

```powershell
# 現在の依存関係状況を確認
.\scripts\update-deps.ps1 -Check

# 依存関係を最新版に更新
.\scripts\update-deps.ps1 -Update

# セキュリティ監査を実行
.\scripts\update-deps.ps1 -Audit

# セキュリティ問題を自動修正
.\scripts\update-deps.ps1 -Fix

# すべての操作を順次実行
.\scripts\update-deps.ps1 -All
```

## 🎯 VS Code タスクから実行

`Ctrl+Shift+P` → `Tasks: Run Task` で以下のタスクが利用できます：

### 🏗️ 日常的な開発作業

- **� ブックマークレットをビルド** - プロダクション用ビルド
- **👀 開発モード（ウォッチ）** - ファイル監視モード
- **🚀 ローカルサーバー起動** - 開発サーバー起動
- **🧹 ビルドファイルをクリーン** - 生成ファイル削除
- **📦 依存関係をインストール** - npm install
- **🔧 セットアップ（インストール＋ビルド）** - 一括セットアップ

### 🔧 メンテナンス・運用作業

- **�🔍 依存関係チェック** - 現在の状況確認
- **🔄 依存関係更新** - 最新版に更新
- **🔒 セキュリティ監査** - セキュリティチェック
- **🛠️ セキュリティ修正** - 自動修正
- **🎯 完全メンテナンス** - 対話式で全体メンテナンス

## 🔧 スクリプトの住み分け

### 📍 `scripts/` - プロジェクト全体の運用スクリプト

- **対象範囲**: プロジェクト全体（ルートから実行）
- **目的**: 運用・メンテナンス・初期セットアップ
- **特徴**: 汎用性が高く、プロジェクトの状態に関係なく利用可能

### 📍 `bookmarklets/` - 開発環境特化スクリプト（非推奨）

- **対象範囲**: bookmarklets ディレクトリ内のみ
- **目的**: ブックマークレット開発特化
- **状況**: `scripts/` への移行により非推奨

## 🎯 推奨される使用パターン

### 🆕 新規環境セットアップ

```powershell
# プロジェクトルートで実行
.\scripts\setup.ps1 -Build
```

### 🔍 環境に問題がある場合

```powershell
# 診断実行
.\scripts\diagnose.ps1

# 自動修復を試行
.\scripts\diagnose.ps1 -Fix
```

### 🔒 定期的なメンテナンス

```powershell
# 依存関係の確認
.\scripts\update-deps.ps1 -Check

# 完全メンテナンス（対話式）
.\scripts\update-deps.ps1 -All
```

## 🚀 VS Code での効率的な作業

### ⌨️ ショートカット操作

1. `Ctrl+Shift+P` を押下
2. `Tasks: Run Task` を選択
3. 実行したいタスクを選択

### 📋 タスクの分類

#### 日常開発用タスク

- 🔨 ブックマークレットをビルド
- 👀 開発モード（ウォッチ）
- 🚀 ローカルサーバー起動

#### メンテナンス用タスク

- 🔍 依存関係チェック
- 🔄 依存関係更新
- 🔒 セキュリティ監査

## 📝 今後の運用方針

### ✅ 推奨事項

1. **scripts/ ディレクトリの活用**: プロジェクト全体のスクリプトはこちらに集約
2. **VS Code タスクの活用**: 日常的な作業はタスクから実行
3. **定期的なメンテナンス**: 月 1 回程度のセキュリティ監査・依存関係更新

### ⚠️ 注意事項

1. **古いスクリプトの使用を避ける**: `bookmarklets/` 内のスクリプトは非推奨
2. **権限の確認**: PowerShell 実行ポリシーを適切に設定
3. **パスの確認**: プロジェクトルートから実行することを前提に設計

---

**📞 サポート**: 問題が発生した場合は、まず `.\scripts\diagnose.ps1 -Detailed` で詳細診断を実行してください。
