# Check Bot Status - Quick Diagnostic

Write-Host "`n🔍 Checking SK Agent Status..." -ForegroundColor Cyan
Write-Host ""

# Check Railway backend
Write-Host "📡 Railway Backend Status:" -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "https://whatapp-automation-production.up.railway.app/api/status" -Method Get -ErrorAction Stop
    
    Write-Host "  State: " -NoNewline -ForegroundColor Gray
    if ($status.state -eq "ready") {
        Write-Host "$($status.state)" -ForegroundColor Green
        Write-Host "  ✅ WhatsApp Connected!" -ForegroundColor Green
        Write-Host "  Name: $($status.name)" -ForegroundColor White
        Write-Host "  Phone: +$($status.phone)" -ForegroundColor White
    } elseif ($status.state -eq "qr") {
        Write-Host "$($status.state)" -ForegroundColor Yellow
        Write-Host "  ⚠️  Waiting for QR scan" -ForegroundColor Yellow
    } else {
        Write-Host "$($status.state)" -ForegroundColor Red
        Write-Host "  ❌ Not connected" -ForegroundColor Red
    }
} catch {
    Write-Host "  ❌ Cannot reach Railway backend" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor DarkRed
}

Write-Host ""

# Check settings
Write-Host "⚙️  Bot Settings:" -ForegroundColor Yellow
try {
    $settings = Invoke-RestMethod -Uri "https://whatapp-automation-production.up.railway.app/api/settings" -Method Get -ErrorAction Stop
    
    Write-Host "  Auto Reply: " -NoNewline -ForegroundColor Gray
    if ($settings.settings.autoReply) {
        Write-Host "ON" -ForegroundColor Green
    } else {
        Write-Host "OFF (Messages will be ignored!)" -ForegroundColor Red
    }
    
    Write-Host "  Reply to Groups: " -NoNewline -ForegroundColor Gray
    if ($settings.settings.replyToGroups) {
        Write-Host "ON" -ForegroundColor Green
    } else {
        Write-Host "OFF" -ForegroundColor Yellow
    }
    
    Write-Host "  Whitelist Only: " -NoNewline -ForegroundColor Gray
    if ($settings.settings.whitelistedOnly) {
        Write-Host "ON (Only whitelisted chats get replies)" -ForegroundColor Yellow
    } else {
        Write-Host "OFF (All chats get replies)" -ForegroundColor Green
    }
    
    if ($settings.settings.blacklistedChats.Count -gt 0) {
        Write-Host "  Blacklisted: $($settings.settings.blacklistedChats.Count) chats" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Cannot fetch settings" -ForegroundColor Red
}

Write-Host ""

# Check recent messages
Write-Host "📨 Recent Messages:" -ForegroundColor Yellow
try {
    $messages = Invoke-RestMethod -Uri "https://whatapp-automation-production.up.railway.app/api/messages" -Method Get -ErrorAction Stop
    
    if ($messages.messages.Count -eq 0) {
        Write-Host "  No messages logged yet" -ForegroundColor Gray
    } else {
        $recent = $messages.messages | Select-Object -Last 5
        foreach ($msg in $recent) {
            $time = [DateTime]::FromFileTimeUtc($msg.timestamp).ToLocalTime().ToString("HH:mm:ss")
            $type = if ($msg.type -eq "incoming") { "📥" } else { "📤" }
            Write-Host "  $type $time | $($msg.senderName): $($msg.message.Substring(0, [Math]::Min(50, $msg.message.Length)))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  ❌ Cannot fetch messages" -ForegroundColor Red
}

Write-Host ""
Write-Host "💡 To enable auto-reply if it's off, go to Settings in dashboard" -ForegroundColor Cyan
Write-Host "🌐 Dashboard: https://whatapp.netlify.app" -ForegroundColor Cyan
Write-Host ""
