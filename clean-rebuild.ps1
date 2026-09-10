# ============================================================
#  CLEAN REBUILD + REDEPLOY SCRIPT
#  Removes all build artifacts, reinstalls deps from scratch
# ============================================================

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host "`n============================================" -ForegroundColor Magenta
Write-Host "  CLEAN REBUILD - WhatsApp Automation" -ForegroundColor Magenta
Write-Host "============================================`n" -ForegroundColor Magenta

# ── 1. Clean Backend ────────────────────────────────────────
Write-Host "[1/6] Cleaning Backend..." -ForegroundColor Yellow
$BackendDir = Join-Path $Root "backend"
if (Test-Path (Join-Path $BackendDir "node_modules")) {
    Remove-Item -Recurse -Force (Join-Path $BackendDir "node_modules")
    Write-Host "  - Removed backend/node_modules" -ForegroundColor Gray
}
if (Test-Path (Join-Path $BackendDir "package-lock.json")) {
    Remove-Item -Force (Join-Path $BackendDir "package-lock.json")
    Write-Host "  - Removed backend/package-lock.json" -ForegroundColor Gray
}
Write-Host "  Backend cleaned.`n" -ForegroundColor Green

# ── 2. Clean Frontend ───────────────────────────────────────
Write-Host "[2/6] Cleaning Frontend..." -ForegroundColor Yellow
$FrontendDir = Join-Path $Root "frontend"
if (Test-Path (Join-Path $FrontendDir "node_modules")) {
    Remove-Item -Recurse -Force (Join-Path $FrontendDir "node_modules")
    Write-Host "  - Removed frontend/node_modules" -ForegroundColor Gray
}
if (Test-Path (Join-Path $FrontendDir "dist")) {
    Remove-Item -Recurse -Force (Join-Path $FrontendDir "dist")
    Write-Host "  - Removed frontend/dist" -ForegroundColor Gray
}
if (Test-Path (Join-Path $FrontendDir "package-lock.json")) {
    Remove-Item -Force (Join-Path $FrontendDir "package-lock.json")
    Write-Host "  - Removed frontend/package-lock.json" -ForegroundColor Gray
}
Write-Host "  Frontend cleaned.`n" -ForegroundColor Green

# ── 3. Reinstall Backend Dependencies ───────────────────────
Write-Host "[3/6] Installing Backend dependencies..." -ForegroundColor Yellow
Set-Location $BackendDir
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  Backend npm install FAILED" -ForegroundColor Red; exit 1 }
Write-Host "  Backend deps installed.`n" -ForegroundColor Green

# ── 4. Reinstall Frontend Dependencies ──────────────────────
Write-Host "[4/6] Installing Frontend dependencies..." -ForegroundColor Yellow
Set-Location $FrontendDir
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  Frontend npm install FAILED" -ForegroundColor Red; exit 1 }
Write-Host "  Frontend deps installed.`n" -ForegroundColor Green

# ── 5. Build Frontend ───────────────────────────────────────
Write-Host "[5/6] Building Frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "  Frontend build FAILED" -ForegroundColor Red; exit 1 }
Write-Host "  Frontend built successfully.`n" -ForegroundColor Green

Set-Location $Root

# ── 6. Final Summary ────────────────────────────────────────
Write-Host "[6/6] Done! Local rebuild complete.`n" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Green
Write-Host "  LOCAL REBUILD COMPLETE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

Write-Host "`n`n============================================" -ForegroundColor Cyan
Write-Host "  NETLIFY FIX - REQUIRED ACTION" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`nYour frontend is connecting to the WRONG backend URL!" -ForegroundColor Red
Write-Host "This happens because the Netlify Environment Variable is set incorrectly.`n"

Write-Host "CURRENT (WRONG):    https://sk-agent-backend-production.up.railway.app" -ForegroundColor Red
Write-Host "SHOULD BE (CORRECT): https://whatapp-automation-production.up.railway.app" -ForegroundColor Green

Write-Host "`nSTEP 1 - Fix Netlify Environment Variable:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://app.netlify.com/sites/whatappai/configuration/env"
Write-Host "  2. Find variable:  VITE_API_URL"
Write-Host "  3. Change value to: https://whatapp-automation-production.up.railway.app"
Write-Host "  4. Click Save"

Write-Host "`nSTEP 2 - Trigger Redeploy on Netlify:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://app.netlify.com/sites/whatappai/deploys"
Write-Host "  2. Click: 'Trigger deploy' -> 'Deploy site'"
Write-Host "  3. Wait for build to finish (2-3 min)"

Write-Host "`nSTEP 3 - Verify Railway Backend is healthy:" -ForegroundColor Yellow
Write-Host "  Open: https://whatapp-automation-production.up.railway.app/health"
Write-Host "  Should see: {`"status`":`"ok`"}`n"

Write-Host "`nTo deploy frontend locally:" -ForegroundColor Magenta
Write-Host "  Run: .\deploy-netlify.ps1`n"

Write-Host "============================================`n" -ForegroundColor Cyan
