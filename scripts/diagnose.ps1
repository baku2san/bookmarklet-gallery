#!/usr/bin/env pwsh
<#
.SYNOPSIS
    ブックマークレット環境の診断・トラブルシューティングスクリプト

.DESCRIPTION
    一般的な問題を自動診断し、解決策を提案します。
    プロジェクト全体からの実行に対応しています。

.PARAMETER Fix
    自動修復を試行します

.PARAMETER Detailed
    詳細な診断情報を表示します

.EXAMPLE
    .\scripts\diagnose.ps1
    環境の診断を実行

.EXAMPLE
    .\scripts\diagnose.ps1 -Fix
    診断と自動修復を実行

.EXAMPLE
    .\scripts\diagnose.ps1 -Detailed
    詳細な診断情報を表示

.NOTES
    Author: Shima Inner Source
    Version: 2.0.0
    Location: scripts/ (プロジェクト全体から利用可能)
#>

param(
    [switch]$Fix,    # 自動修復を試行
    [switch]$Detailed # 詳細な診断情報を表示
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

function Write-Check {
    param([string]$Message)
    Write-ColorText "🔍 $Message" "Cyan"
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

function Write-Fix {
    param([string]$Message)
    Write-ColorText "🔧 $Message" "Magenta"
}

# 診断結果格納用
$DiagnosisResults = @()

function Add-DiagnosisResult {
    param(
        [string]$Category,
        [string]$Item,
        [string]$Status,
        [string]$Message,
        [string]$Suggestion = ""
    )
    
    $DiagnosisResults += [PSCustomObject]@{
        Category = $Category
        Item = $Item
        Status = $Status
        Message = $Message
        Suggestion = $Suggestion
    }
}

# メイン診断処理
try {
    Write-ColorText "🔍 Shima ブックマークレット環境診断" "Magenta"
    Write-ColorText "=" * 50 "Magenta"

    Write-Info "プロジェクトルート: $ProjectRoot"
    Write-Info "ブックマークレットディレクトリ: $BookmarkletsDir"
    Write-ColorText "" "White"

    # 1. プロジェクト構造の確認
    Write-Check "プロジェクト構造の確認"
    
    # プロジェクトルートの確認
    if (Test-Path $ProjectRoot) {
        Write-Success "プロジェクトルートディレクトリ存在確認"
        Add-DiagnosisResult "Structure" "ProjectRoot" "OK" "プロジェクトルートが存在します"
    } else {
        Write-Error "プロジェクトルートディレクトリが見つかりません"
        Add-DiagnosisResult "Structure" "ProjectRoot" "ERROR" "プロジェクトルートが見つかりません" "プロジェクトのクローンを確認してください"
    }

    # bookmarkletsディレクトリの確認
    if (Test-Path $BookmarkletsDir) {
        Write-Success "bookmarkletsディレクトリ存在確認"
        Add-DiagnosisResult "Structure" "BookmarkletsDir" "OK" "bookmarkletsディレクトリが存在します"
    } else {
        Write-Error "bookmarkletsディレクトリが見つかりません"
        Add-DiagnosisResult "Structure" "BookmarkletsDir" "ERROR" "bookmarkletsディレクトリが見つかりません" "プロジェクト構造を確認してください"
    }

    # package.jsonの確認
    $packageJsonPath = Join-Path $BookmarkletsDir "package.json"
    if (Test-Path $packageJsonPath) {
        Write-Success "package.json存在確認"
        Add-DiagnosisResult "Structure" "PackageJson" "OK" "package.jsonが存在します"
        
        if ($Detailed) {
            try {
                $packageContent = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
                Write-Info "  - Name: $($packageContent.name)"
                Write-Info "  - Version: $($packageContent.version)"
                Write-Info "  - Scripts: $($packageContent.scripts.PSObject.Properties.Name -join ', ')"
            }
            catch {
                Write-Warning "package.jsonの解析に失敗しました"
            }
        }
    } else {
        Write-Error "package.jsonが見つかりません"
        Add-DiagnosisResult "Structure" "PackageJson" "ERROR" "package.jsonが見つかりません" "npm initでpackage.jsonを作成してください"
    }

    # 2. Node.js環境の確認
    Write-Check "Node.js環境の確認"
    
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Success "Node.js: $nodeVersion"
            Add-DiagnosisResult "Environment" "NodeJS" "OK" "Node.js $nodeVersion がインストールされています"
            
            # バージョンチェック
            $versionNumber = $nodeVersion -replace "v", ""
            $majorVersion = [int]($versionNumber.Split('.')[0])
            if ($majorVersion -lt 16) {
                Write-Warning "Node.js バージョンが古い可能性があります（推奨: v16以上）"
                Add-DiagnosisResult "Environment" "NodeJSVersion" "WARNING" "Node.js バージョンが古い可能性があります" "Node.js v16以上へのアップデートを推奨します"
            }
        } else {
            throw "Node.js が見つかりません"
        }
    }
    catch {
        Write-Error "Node.js がインストールされていません"
        Add-DiagnosisResult "Environment" "NodeJS" "ERROR" "Node.jsがインストールされていません" "https://nodejs.org/ からNode.jsをインストールしてください"
        
        if ($Fix) {
            Write-Fix "Node.jsのインストールが必要です"
            Write-Info "https://nodejs.org/ からダウンロードしてインストールしてください"
        }
    }

    # npm環境確認
    try {
        $npmVersion = npm --version 2>$null
        if ($npmVersion) {
            Write-Success "npm: $npmVersion"
            Add-DiagnosisResult "Environment" "NPM" "OK" "npm $npmVersion が利用可能です"
        } else {
            throw "npm が見つかりません"
        }
    }
    catch {
        Write-Error "npm が利用できません"
        Add-DiagnosisResult "Environment" "NPM" "ERROR" "npmが利用できません" "Node.jsと一緒にnpmがインストールされているか確認してください"
    }

    # 3. 依存関係の確認
    Write-Check "依存関係の確認"
    
    Push-Location $BookmarkletsDir -ErrorAction SilentlyContinue
    
    $nodeModulesPath = Join-Path $BookmarkletsDir "node_modules"
    if (Test-Path $nodeModulesPath) {
        Write-Success "node_modules存在確認"
        Add-DiagnosisResult "Dependencies" "NodeModules" "OK" "node_modulesが存在します"
        
        if ($Detailed) {
            $packageCount = (Get-ChildItem $nodeModulesPath -Directory).Count
            Write-Info "  - インストール済みパッケージ数: $packageCount"
        }
    } else {
        Write-Warning "node_modulesが見つかりません"
        Add-DiagnosisResult "Dependencies" "NodeModules" "WARNING" "node_modulesが見つかりません" "npm installを実行してください"
        
        if ($Fix) {
            Write-Fix "依存関係をインストールしています..."
            try {
                npm install
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "依存関係のインストールが完了しました"
                } else {
                    Write-Error "依存関係のインストールに失敗しました"
                }
            }
            catch {
                Write-Error "npm installの実行に失敗しました: $($_.Exception.Message)"
            }
        }
    }

    # package-lock.jsonの確認
    $packageLockPath = Join-Path $BookmarkletsDir "package-lock.json"
    if (Test-Path $packageLockPath) {
        Write-Success "package-lock.json存在確認"
        Add-DiagnosisResult "Dependencies" "PackageLock" "OK" "package-lock.jsonが存在します"
    } else {
        Write-Info "package-lock.jsonが見つかりません（初回インストール前）"
        Add-DiagnosisResult "Dependencies" "PackageLock" "INFO" "package-lock.jsonが見つかりません" "npm installを実行すると作成されます"
    }

    # 4. ビルド環境の確認
    Write-Check "ビルド環境の確認"
    
    # ビルドスクリプトの確認
    $buildScriptPath = Join-Path $BookmarkletsDir "build-production.js"
    if (Test-Path $buildScriptPath) {
        Write-Success "ビルドスクリプト存在確認"
        Add-DiagnosisResult "Build" "BuildScript" "OK" "build-production.jsが存在します"
    } else {
        Write-Error "ビルドスクリプトが見つかりません"
        Add-DiagnosisResult "Build" "BuildScript" "ERROR" "build-production.jsが見つかりません" "ビルドスクリプトファイルを確認してください"
    }

    # srcディレクトリの確認
    $srcPath = Join-Path $BookmarkletsDir "src"
    if (Test-Path $srcPath) {
        Write-Success "srcディレクトリ存在確認"
        Add-DiagnosisResult "Build" "SrcDirectory" "OK" "srcディレクトリが存在します"
        
        if ($Detailed) {
            $jsFiles = Get-ChildItem $srcPath -Recurse -Filter "*.js"
            Write-Info "  - JavaScriptファイル数: $($jsFiles.Count)"
            if ($jsFiles.Count -gt 0) {
                Write-Info "  - ファイル一覧:"
                $jsFiles | ForEach-Object {
                    $relativePath = $_.FullName.Replace($srcPath, "").TrimStart('\')
                    Write-Info "    - $relativePath"
                }
            }
        }
    } else {
        Write-Error "srcディレクトリが見つかりません"
        Add-DiagnosisResult "Build" "SrcDirectory" "ERROR" "srcディレクトリが見つかりません" "ソースファイルディレクトリを確認してください"
    }

    # 生成ファイルの確認
    $installHtmlPath = Join-Path $BookmarkletsDir "install.html"
    if (Test-Path $installHtmlPath) {
        Write-Success "install.html存在確認（ビルド済み）"
        Add-DiagnosisResult "Build" "InstallHtml" "OK" "install.htmlが存在します（ビルド済み）"
        
        if ($Detailed) {
            $fileInfo = Get-Item $installHtmlPath
            Write-Info "  - ファイルサイズ: $([math]::Round($fileInfo.Length / 1KB, 2)) KB"
            Write-Info "  - 最終更新: $($fileInfo.LastWriteTime)"
        }
    } else {
        Write-Info "install.htmlが見つかりません（未ビルド）"
        Add-DiagnosisResult "Build" "InstallHtml" "INFO" "install.htmlが見つかりません" "npm run buildを実行してください"
        
        if ($Fix) {
            Write-Fix "ビルドを実行しています..."
            try {
                npm run build
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "ビルドが完了しました"
                } else {
                    Write-Error "ビルドに失敗しました"
                }
            }
            catch {
                Write-Error "ビルドの実行に失敗しました: $($_.Exception.Message)"
            }
        }
    }

    Pop-Location -ErrorAction SilentlyContinue

    # 5. 権限・セキュリティの確認
    Write-Check "権限・セキュリティの確認"
    
    # スクリプト実行ポリシーの確認
    try {
        $executionPolicy = Get-ExecutionPolicy
        Write-Info "PowerShell実行ポリシー: $executionPolicy"
        
        if ($executionPolicy -eq "Restricted") {
            Write-Warning "PowerShellの実行ポリシーが制限されています"
            Add-DiagnosisResult "Security" "ExecutionPolicy" "WARNING" "PowerShell実行ポリシーが制限されています" "Set-ExecutionPolicy RemoteSigned -Scope CurrentUserを実行してください"
        } else {
            Write-Success "PowerShell実行ポリシーは適切です"
            Add-DiagnosisResult "Security" "ExecutionPolicy" "OK" "PowerShell実行ポリシーは適切です"
        }
    }
    catch {
        Write-Warning "PowerShell実行ポリシーの確認に失敗しました"
    }

    # ディレクトリの書き込み権限確認
    try {
        $testFile = Join-Path $BookmarkletsDir "test_write_permission.tmp"
        "test" | Out-File $testFile -ErrorAction Stop
        Remove-Item $testFile -ErrorAction SilentlyContinue
        Write-Success "ディレクトリ書き込み権限確認"
        Add-DiagnosisResult "Security" "WritePermission" "OK" "ディレクトリへの書き込み権限があります"
    }
    catch {
        Write-Error "ディレクトリに書き込み権限がありません"
        Add-DiagnosisResult "Security" "WritePermission" "ERROR" "ディレクトリに書き込み権限がありません" "管理者権限で実行するか、ディレクトリの権限を確認してください"
    }

    # 診断結果サマリー
    Write-ColorText "" "White"
    Write-ColorText "📊 診断結果サマリー" "Magenta"
    Write-ColorText "=" * 30 "Magenta"

    $errorCount = ($DiagnosisResults | Where-Object { $_.Status -eq "ERROR" }).Count
    $warningCount = ($DiagnosisResults | Where-Object { $_.Status -eq "WARNING" }).Count
    $okCount = ($DiagnosisResults | Where-Object { $_.Status -eq "OK" }).Count
    $infoCount = ($DiagnosisResults | Where-Object { $_.Status -eq "INFO" }).Count

    Write-Info "総チェック項目数: $($DiagnosisResults.Count)"
    if ($okCount -gt 0) { Write-Success "正常: $okCount 項目" }
    if ($infoCount -gt 0) { Write-Info "情報: $infoCount 項目" }
    if ($warningCount -gt 0) { Write-Warning "警告: $warningCount 項目" }
    if ($errorCount -gt 0) { Write-Error "エラー: $errorCount 項目" }

    # 問題がある項目の詳細表示
    $problemItems = $DiagnosisResults | Where-Object { $_.Status -in @("ERROR", "WARNING") }
    if ($problemItems.Count -gt 0) {
        Write-ColorText "" "White"
        Write-ColorText "🔧 修正が必要な項目" "Yellow"
        Write-ColorText "-" * 25 "Yellow"
        
        $problemItems | ForEach-Object {
            $statusColor = if ($_.Status -eq "ERROR") { "Red" } else { "Yellow" }
            Write-ColorText "[$($_.Status)] $($_.Category) - $($_.Item)" $statusColor
            Write-Info "  問題: $($_.Message)"
            if ($_.Suggestion) {
                Write-Info "  対処: $($_.Suggestion)"
            }
            Write-ColorText "" "White"
        }
    }

    # 最終判定
    Write-ColorText "" "White"
    if ($errorCount -eq 0) {
        if ($warningCount -eq 0) {
            Write-ColorText "🎉 すべての診断項目が正常です！" "Green"
        } else {
            Write-ColorText "⚠️  警告項目がありますが、基本的な動作は可能です" "Yellow"
        }
    } else {
        Write-ColorText "❌ エラーが検出されました。修正が必要です" "Red"
        Write-Info ""
        Write-Info "修正手順:"
        Write-Info "1. 上記のエラー項目を確認してください"
        Write-Info "2. .\scripts\diagnose.ps1 -Fix で自動修復を試してください"
        Write-Info "3. 手動での修正が必要な場合は、対処方法に従ってください"
    }

}
catch {
    Write-Error "診断中にエラーが発生しました: $($_.Exception.Message)"
    exit 1
}
finally {
    # 元のディレクトリに戻る
    if (Get-Location | Where-Object { $_.Path -ne $PWD.Path }) {
        Pop-Location -ErrorAction SilentlyContinue
    }
}
