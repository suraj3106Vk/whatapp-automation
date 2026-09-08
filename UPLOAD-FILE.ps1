# Quick File Upload to Bot
# Copies files from your PC to the bot's uploads folder

Write-Host "`n📁 SK Agent - File Upload Helper" -ForegroundColor Cyan
Write-Host ""

$uploadsDir = "$PSScriptRoot\backend\uploads"

# Ensure uploads directory exists
if (!(Test-Path $uploadsDir)) {
    New-Item -ItemType Directory -Path $uploadsDir | Out-Null
}

Write-Host "Current uploads folder: $uploadsDir" -ForegroundColor Yellow
Write-Host ""

# List current files
$existingFiles = Get-ChildItem $uploadsDir -File
if ($existingFiles.Count -gt 0) {
    Write-Host "Files currently uploaded:" -ForegroundColor Green
    $existingFiles | ForEach-Object {
        $size = if ($_.Length -gt 1MB) { "{0:N2} MB" -f ($_.Length / 1MB) } else { "{0:N0} KB" -f ($_.Length / 1KB) }
        Write-Host "  • $($_.Name) ($size)" -ForegroundColor White
    }
} else {
    Write-Host "No files uploaded yet" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Options:" -ForegroundColor Cyan
Write-Host "  1) Upload a file" -ForegroundColor White
Write-Host "  2) Upload from Documents folder" -ForegroundColor White
Write-Host "  3) Upload from Downloads folder" -ForegroundColor White
Write-Host "  4) Open uploads folder" -ForegroundColor White
Write-Host "  5) Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Choose option (1-5)"

switch ($choice) {
    "1" {
        Write-Host ""
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = "Select file to upload"
        $dialog.Filter = "All files (*.*)|*.*|PDF files (*.pdf)|*.pdf|Images (*.jpg;*.png)|*.jpg;*.png|Documents (*.doc;*.docx)|*.doc;*.docx"
        
        if ($dialog.ShowDialog() -eq 'OK') {
            $sourcePath = $dialog.FileName
            $fileName = [System.IO.Path]::GetFileName($sourcePath)
            $destPath = Join-Path $uploadsDir $fileName
            
            Copy-Item $sourcePath $destPath -Force
            Write-Host "✅ Uploaded: $fileName" -ForegroundColor Green
            Write-Host "   Location: $destPath" -ForegroundColor Gray
        }
    }
    
    "2" {
        $docsPath = [Environment]::GetFolderPath("MyDocuments")
        $files = Get-ChildItem $docsPath -File | Select-Object -First 20
        
        Write-Host "`nRecent files in Documents:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $files.Count; $i++) {
            Write-Host "  $($i+1)) $($files[$i].Name)" -ForegroundColor White
        }
        
        Write-Host ""
        $fileNum = Read-Host "Enter file number to upload (or 0 to cancel)"
        
        if ($fileNum -gt 0 -and $fileNum -le $files.Count) {
            $file = $files[$fileNum - 1]
            $destPath = Join-Path $uploadsDir $file.Name
            Copy-Item $file.FullName $destPath -Force
            Write-Host "✅ Uploaded: $($file.Name)" -ForegroundColor Green
        }
    }
    
    "3" {
        $downloadsPath = Join-Path $env:USERPROFILE "Downloads"
        $files = Get-ChildItem $downloadsPath -File | Select-Object -First 20
        
        Write-Host "`nRecent files in Downloads:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $files.Count; $i++) {
            Write-Host "  $($i+1)) $($files[$i].Name)" -ForegroundColor White
        }
        
        Write-Host ""
        $fileNum = Read-Host "Enter file number to upload (or 0 to cancel)"
        
        if ($fileNum -gt 0 -and $fileNum -le $files.Count) {
            $file = $files[$fileNum - 1]
            $destPath = Join-Path $uploadsDir $file.Name
            Copy-Item $file.FullName $destPath -Force
            Write-Host "✅ Uploaded: $($file.Name)" -ForegroundColor Green
        }
    }
    
    "4" {
        explorer $uploadsDir
        Write-Host "✅ Opened uploads folder in Explorer" -ForegroundColor Green
    }
    
    "5" {
        Write-Host "Bye!" -ForegroundColor Gray
        exit
    }
    
    default {
        Write-Host "Invalid option" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "💡 Tip: You can also drag files directly into:" -ForegroundColor Cyan
Write-Host "   $uploadsDir" -ForegroundColor Gray
Write-Host ""
