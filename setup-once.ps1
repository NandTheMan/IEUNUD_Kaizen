# ============================================================
# setup-once.ps1
# Run this ONE TIME, right-click -> "Run with PowerShell" as Administrator.
# It installs everything the app needs on a fresh Windows PC.
# ============================================================

Write-Host "Step 1/4: Enabling WSL (required by Docker Desktop)..." -ForegroundColor Cyan
wsl --install --no-distribution

Write-Host "Step 2/4: Installing Git..." -ForegroundColor Cyan
winget install -e --id Git.Git --accept-source-agreements --accept-package-agreements

Write-Host "Step 3/4: Installing Docker Desktop..." -ForegroundColor Cyan
winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements

Write-Host "Step 4/4: Opening port 80 so other devices on the LAN can reach the app..." -ForegroundColor Cyan
New-NetFirewallRule -DisplayName "Kaizen LAN Access" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host " Setup finished. Please RESTART this computer now (required by WSL)." -ForegroundColor Yellow
Write-Host " After restarting:" -ForegroundColor Yellow
Write-Host "   1. Open Docker Desktop once and click through its first-run screen." -ForegroundColor Yellow
Write-Host "   2. Open a terminal and run:" -ForegroundColor Yellow
Write-Host "        git clone <your-repo-url>" -ForegroundColor Yellow
Write-Host "        cd <repo-folder>" -ForegroundColor Yellow
Write-Host "        copy .env.prod.example .env.prod" -ForegroundColor Yellow
Write-Host "      then edit .env.prod and set a real DB password." -ForegroundColor Yellow
Write-Host "   3. Double-click start.bat to launch the app." -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Yellow