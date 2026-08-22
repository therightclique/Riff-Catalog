# Create-Desktop-Shortcut.ps1 - run this ONCE. It creates a "Deploy Riff
# Catalog" shortcut on your Desktop that runs Deploy.ps1 in a visible
# PowerShell window. After running this, right-click that shortcut and
# choose "Pin to taskbar" (or drag it onto your taskbar) - Windows
# doesn't allow scripts to do that last step automatically anymore.

try {
    # Ask Windows where Desktop actually is instead of assuming
    # "$env:USERPROFILE\Desktop" - that assumption breaks if OneDrive
    # (or anything else) has redirected the Desktop folder elsewhere,
    # which is exactly what caused the previous DirectoryNotFoundException.
    $desktopPath = [Environment]::GetFolderPath('Desktop')
    Write-Host "Desktop folder detected at: $desktopPath" -ForegroundColor DarkGray

    if (-not (Test-Path $desktopPath)) {
        throw "Windows reported your Desktop folder as '$desktopPath', but that path doesn't exist either. This may need a manual shortcut instead - let me know what you see."
    }

    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut((Join-Path $desktopPath "Deploy Riff Catalog.lnk"))
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = '-ExecutionPolicy Bypass -File "C:\Users\justi\riff-catalog\Deploy.ps1"'
    $Shortcut.WorkingDirectory = "C:\Users\justi\riff-catalog"
    $Shortcut.IconLocation = "powershell.exe,0"
    $Shortcut.Save()

    Write-Host ""
    Write-Host "Shortcut created: $desktopPath\Deploy Riff Catalog.lnk" -ForegroundColor Green
    Write-Host "Right-click it now and choose 'Pin to taskbar' (or just drag it onto your taskbar)." -ForegroundColor Yellow
}
catch {
    Write-Host ""
    Write-Host "SHORTCUT CREATION FAILED:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Full error detail:" -ForegroundColor Red
    Write-Host ($_ | Out-String) -ForegroundColor Red
}
finally {
    Write-Host ""
    Read-Host "Press Enter to continue"
}
