# PowerShell Script: Dependency and Version Management
# Usage: .\scripts\update-dependencies.ps1 [options]

param(
    [switch]$Check,
    [switch]$Update,
    [switch]$Audit,
    [switch]$Fix,
    [switch]$All,
    [switch]$Help
)

function Show-Help {
    Write-Host "Dependency and Version Management Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\scripts\update-dependencies.ps1 [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Check      Check current dependencies and versions"
    Write-Host "  -Update     Update dependencies to latest versions"
    Write-Host "  -Audit      Run security audit"
    Write-Host "  -Fix        Fix security issues automatically"
    Write-Host "  -All        Run all operations interactively"
    Write-Host "  -Help       Show this help"
    Write-Host ""
}

function Get-DependencyStatus {
    Write-Host "Checking dependencies and versions..." -ForegroundColor Blue
    Set-Location "${PSScriptRoot}\..\bookmarklets"
    
    Write-Host "=== Environment ===" -ForegroundColor Yellow
    Write-Host "Node.js: $(node --version)" -ForegroundColor Green
    Write-Host "npm: $(npm --version)" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "=== Current Dependencies ===" -ForegroundColor Yellow
    npm list --depth=0
    Write-Host ""
    
    Write-Host "=== Outdated Dependencies ===" -ForegroundColor Yellow
    npm outdated
    Write-Host ""
}

function Update-Dependencies {
    Write-Host "Updating dependencies..." -ForegroundColor Magenta
    Set-Location "${PSScriptRoot}\..\bookmarklets"
    
    Write-Host "Backing up package-lock.json..." -ForegroundColor Blue
    if (Test-Path "package-lock.json") {
        Copy-Item "package-lock.json" "package-lock.json.backup"
    }
    
    Write-Host "Updating packages..." -ForegroundColor Blue
    npm update
    
    Write-Host "Dependencies updated successfully!" -ForegroundColor Green
}

function Invoke-SecurityAudit {
    Write-Host "Running security audit..." -ForegroundColor Red
    Set-Location "${PSScriptRoot}\..\bookmarklets"
    
    npm audit
    return $LASTEXITCODE
}

function Repair-SecurityIssues {
    Write-Host "Fixing security issues..." -ForegroundColor Yellow
    Set-Location "${PSScriptRoot}\..\bookmarklets"
    
    npm audit fix
    Write-Host "Security issues fixed!" -ForegroundColor Green
}

# Main processing
if ($Help -or (-not ($Check -or $Update -or $Audit -or $Fix -or $All))) {
    Show-Help
    exit
}

if ($All) {
    Get-DependencyStatus
    $response = Read-Host "Update dependencies? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Update-Dependencies
    }
    
    $auditResult = Invoke-SecurityAudit
    if ($auditResult -ne 0) {
        $response = Read-Host "Fix security issues? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            Repair-SecurityIssues
        }
    }
} else {
    if ($Check) {
        Get-DependencyStatus
    }
    
    if ($Update) {
        Update-Dependencies
    }
    
    if ($Audit) {
        Invoke-SecurityAudit | Out-Null
    }
    
    if ($Fix) {
        Repair-SecurityIssues
    }
}
