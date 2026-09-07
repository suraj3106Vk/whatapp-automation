# Setup Auto-Start for SK Agent Bot
Write-Host "Setting up SK Agent to run on Windows startup..." -ForegroundColor Cyan

$startupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$shortcutPath = "$startupFolder\SK Agent Bot.lnk"
$targetPath = "$PSScriptRoot\start.ps1"

# Create shortcut
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$targetPath`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.IconLocation = "powershell.exe,0"
$Shortcut.Description = "SK Agent WhatsApp Bot"
$Shortcut.Save()

Write-Host ""
Write-Host "Success! Auto-start configured!" -ForegroundColor Green
Write-Host ""
Write-Host "The bot will now start automatically when Windows boots." -ForegroundColor White
Write-Host ""
Write-Host "Shortcut location:" -ForegroundColor Yellow
Write-Host "  $shortcutPath" -ForegroundColor Gray
Write-Host ""
Write-Host "To disable auto-start, delete the shortcut from:" -ForegroundColor Yellow
Write-Host "  $startupFolder" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
