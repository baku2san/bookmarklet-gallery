#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Shima ブックマークレット環境セットアップスクリプト

.DESCRIPTION
    新規環境でブックマークレットプロジェクトを設定し、
    依存関係をインストールして、ビルドを実行します。

.PARAMETER Build
    セットアップ後にビルドも実行します

.PARAMETER Watch
    セットアップ後にファイル監視モードを開始します

.PARAMETER Clean
    既存ファイルをクリーンアップしてからセットアップします

.EXAMPLE
    .\scripts\setup.ps1
    基本的なセットアップを実行

.EXAMPLE
    .\scripts\setup.ps1 -Build
    セットアップ後にビルドも実行

.EXAMPLE
    .\scripts\setup.ps1 -Watch
    セットアップ後にファイル監視モードを開始

.NOTES
    Author: Shima Inner Source
    Version: 2.0.0
    Location: scripts/ (プロジェクト全体から利用可能)
#>

param(
    [switch]$Build,
    [switch]$Watch,
    [switch]$Clean
)

# エラー時に停止
$ErrorActionPreference = "Stop"

# プロジェクトルートの確認
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BookmarkletsDir = Join-Path $ProjectRoot "bookmarklets"

# カラー出力用の関数
function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    switch ($Color) {
        "Cyan" { Write-Host $Text -ForegroundColor Cyan }
        "Green" { Write-Host $Text -ForegroundColor Green }
        "Yellow" { Write-Host $Text -ForegroundColor Yellow }
        "Red" { Write-Host $Text -ForegroundColor Red }
        "Magenta" { Write-Host $Text -ForegroundColor Magenta }
        "Gray" { Write-Host $Text -ForegroundColor Gray }
        default { Write-Host $Text }
    }
}

function Write-Step {
    param([string]$Message)
    Write-ColorText "🔄 $Message" "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-ColorText "✅ $Message" "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorText "⚠️  $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorText "❌ $Message" "Red"
}

function Write-Info {
    param([string]$Message)
    Write-ColorText "ℹ️  $Message" "Gray"
}

# メイン処理
try {
    Write-ColorText "🚀 Shima ブックマークレット環境セットアップ" "Magenta"
    Write-ColorText "=" * 50 "Magenta"

    # ディレクトリ存在確認
    if (-not (Test-Path $BookmarkletsDir)) {
        Write-Error "bookmarkletsディレクトリが見つかりません: $BookmarkletsDir"
        exit 1
    }

    Write-Info "プロジェクトルート: $ProjectRoot"
    Write-Info "ブックマークレットディレクトリ: $BookmarkletsDir"

    # bookmarkletsディレクトリに移動
    Push-Location $BookmarkletsDir

    # Node.js環境確認
    Write-Step "Node.js環境の確認"
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Success "Node.js: $nodeVersion"
        } else {
            throw "Node.js が見つかりません"
        }
    }
    catch {
        Write-Error "Node.js がインストールされていません"
        Write-Info "Node.js をインストールしてください: https://nodejs.org/"
        exit 1
    }

    # npm環境確認
    try {
        $npmVersion = npm --version 2>$null
        if ($npmVersion) {
            Write-Success "npm: $npmVersion"
        } else {
            throw "npm が見つかりません"
        }
    }
    catch {
        Write-Error "npm が利用できません"
        exit 1
    }

    # package.json存在確認
    if (-not (Test-Path "package.json")) {
        Write-Error "package.json が見つかりません"
        exit 1
    }

    # クリーンアップ実行
    if ($Clean) {
        Write-Step "既存ファイルのクリーンアップ"
        if (Test-Path "node_modules") {
            Remove-Item "node_modules" -Recurse -Force
            Write-Success "node_modules を削除しました"
        }
        if (Test-Path "package-lock.json") {
            Remove-Item "package-lock.json" -Force
            Write-Success "package-lock.json を削除しました"
        }
        if (Test-Path "install.html") {
            Remove-Item "install.html" -Force
            Write-Success "install.html を削除しました"
        }
    }

    # 依存関係のインストール
    Write-Step "依存関係のインストール"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "依存関係のインストールに失敗しました"
        exit 1
    }
    Write-Success "依存関係のインストールが完了しました"

    # セットアップ完了
    Write-Success "基本セットアップが完了しました"

    # ビルド実行
    if ($Build) {
        Write-Step "ブックマークレットのビルド"
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "ビルドに失敗しました"
            exit 1
        }
        Write-Success "ビルドが完了しました"
        
        if (Test-Path "install.html") {
            Write-Success "install.html が生成されました"
        }
    }

    # ファイル監視モード
    if ($Watch) {
        Write-Step "ファイル監視モードを開始"
        Write-Info "ファイルが変更されると自動的にビルドが実行されます"
        Write-Info "停止するには Ctrl+C を押してください"
        npm run watch
    }

    Write-ColorText "" "White"
    Write-ColorText "🎉 セットアップが正常に完了しました！" "Green"
    Write-ColorText "" "White"

    if (-not $Build -and -not $Watch) {
        Write-Info "次のステップ:"
        Write-Info "  ビルド実行: npm run build"
        Write-Info "  ファイル監視: npm run watch"
        Write-Info "  VS Code タスク: Ctrl+Shift+P → Tasks: Run Task"
    }

}
catch {
    Write-Error "セットアップ中にエラーが発生しました: $($_.Exception.Message)"
    exit 1
}
finally {
    # 元のディレクトリに戻る
    Pop-Location
}
