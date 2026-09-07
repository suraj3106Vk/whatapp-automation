# Start Frontend Dashboard (connects to Railway backend)
# Run this to view QR code and manage your WhatsApp bot

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   SK Agent - Frontend Dashboard       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "📦 Starting frontend..." -ForegroundColor Yellow
Write-Host "🔗 Connected to: https://whatapp-automation-production.up.railway.app`n" -ForegroundColor Green

# Change to frontend directory
Set-Location -Path "$PSScriptRoot\frontend"

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📥 Installing dependencies (first time only)..." -ForegroundColor Yellow
    npm install
}

# Start dev server
Write-Host "`n🚀 Starting dashboard..." -ForegroundColor Green
Write-Host "📱 Open the URL below in your browser to scan QR code!`n" -ForegroundColor Cyan

npm run dev
