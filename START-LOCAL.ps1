# ═══════════════════════════════════════════════════════════════════════════
#  SK Agent - Local Startup Script
#  Starts backend and opens dashboard in browser
# ═══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   SK Agent - WhatsApp Bot (Local)     ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "🚀 Starting SK Agent..." -ForegroundColor Yellow
Write-Host ""

# Start backend
Write-Host "📡 Starting Backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host ''; Write-Host '═══ SK Agent Backend ═══' -ForegroundColor Green; Write-Host ''; npm start"

# Wait for backend to start
Write-Host "⏳ Waiting for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start frontend
Write-Host "🌐 Starting Dashboard..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host ''; Write-Host '═══ SK Agent Dashboard ═══' -ForegroundColor Green; Write-Host ''; npm run dev"

# Wait for frontend to start
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✅ SK Agent is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Opening dashboard..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

# Open dashboard in browser
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "  Dashboard:  http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Backend:    http://localhost:3001" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "  • Backend shows WhatsApp QR code in terminal" -ForegroundColor White
Write-Host "  • Dashboard shows QR code in browser" -ForegroundColor White
Write-Host "  • Scan QR with WhatsApp to connect" -ForegroundColor White
Write-Host "  • Keep both windows open while using" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  To stop: Close both PowerShell windows" -ForegroundColor Yellow
Write-Host ""
