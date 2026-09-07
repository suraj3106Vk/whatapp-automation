# Fix Railway DNS Access Issue
# This script sets Cloudflare DNS (1.1.1.1) to access Railway

Write-Host ""
Write-Host "🔧 Fixing Railway DNS Access..." -ForegroundColor Cyan
Write-Host "This will change your DNS to Cloudflare (1.1.1.1) temporarily" -ForegroundColor Yellow
Write-Host ""

# Get active network adapter
$adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1

if ($adapter) {
    Write-Host "✓ Found active adapter: $($adapter.Name)" -ForegroundColor Green
    
    # Set DNS to Cloudflare
    Write-Host "Setting DNS to Cloudflare (1.1.1.1, 1.0.0.1)..." -ForegroundColor Yellow
    Set-DnsClientServerAddress -InterfaceAlias $adapter.Name -ServerAddresses ("1.1.1.1","1.0.0.1")
    
    # Flush DNS cache
    Write-Host "Flushing DNS cache..." -ForegroundColor Yellow
    ipconfig /flushdns | Out-Null
    
    Write-Host ""
    Write-Host "✅ DNS Fixed! Railway should now be accessible." -ForegroundColor Green
    Write-Host ""
    Write-Host "Now try opening: https://whatapp-automation-production.up.railway.app/qr-page" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To restore your original DNS later, run:" -ForegroundColor Gray
    Write-Host "Set-DnsClientServerAddress -InterfaceAlias '$($adapter.Name)' -ResetServerAddresses" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Press any key to open Railway QR page in browser..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    
    Start-Process "https://whatapp-automation-production.up.railway.app/qr-page"
}
else {
    Write-Host "❌ No active network adapter found" -ForegroundColor Red
}
