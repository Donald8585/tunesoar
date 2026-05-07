# ──────────────────────────────────────────────────────────
# TuneSoar — One-liner installer (Windows PowerShell)
#
# Usage:
#   irm https://api.tunesoar.com/install.ps1 | iex
# ──────────────────────────────────────────────────────────
param($Version = "latest")
$ErrorActionPreference = "Stop"

Write-Host "==> TuneSoar Installer (Windows)" -ForegroundColor Green
if (-not [Environment]::Is64BitOperatingSystem) { Write-Error "64-bit Windows required"; exit 1 }
$Arch = "x64"
Write-Host "Detected: Windows / $Arch"

$DownloadUrl = "https://api.tunesoar.com/releases/latest/windows/$Arch"
$TempDir = Join-Path $env:TEMP "tunesoar-installer"
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
$InstallerPath = Join-Path $TempDir "TuneSoar-Setup.exe"

Write-Host "Downloading..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $InstallerPath

Write-Host "Installing..."
Start-Process -FilePath $InstallerPath -ArgumentList "/S" -Wait

Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
Write-Host "✓ TuneSoar installed!" -ForegroundColor Green
