# Deploy Frontend to Netlify (via CLI)
# Run this after installing Netlify CLI: npm install -g netlify-cli

Write-Host "`n🚀 Deploying Frontend to Netlify..." -ForegroundColor Cyan
Write-Host ""

# Check if netlify CLI is installed
if (!(Get-Command netlify -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Netlify CLI not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install it first:" -ForegroundColor Yellow
    Write-Host "  npm install -g netlify-cli" -ForegroundColor White
    Write-Host ""
    Write-Host "Or deploy manually via Netlify Dashboard:" -ForegroundColor Yellow
    Write-Host "  https://app.netlify.com/" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Change to frontend directory
Set-Location -Path "$PSScriptRoot\frontend"

Write-Host "📦 Building frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Deploying to Netlify..." -ForegroundColor Yellow
    
    # Deploy to Netlify
    netlify deploy --prod
    
    Write-Host ""
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Remember to set environment variable in Netlify Dashboard:" -ForegroundColor Yellow
    Write-Host "  VITE_API_URL = https://whatapp-automation-production.up.railway.app" -ForegroundColor White
} else {
    Write-Host "❌ Build failed - check errors above" -ForegroundColor Red
}

Set-Location -Path $PSScriptRoot
