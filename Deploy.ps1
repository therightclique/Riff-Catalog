# Deploy.ps1 - Riff Catalog build/push/deploy, one click.
# Stops immediately if any step fails, rather than pushing a broken
# build or deploying stale files. Logs every run to DeployLogs\, deletes
# logs older than 30 days, and auto-closes 2 minutes after finishing
# (or press Enter to close immediately).

$LogDir = "C:\Users\justi\riff-catalog\DeployLogs"
$LogFile = $null

try {
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }

    # Delete logs older than 30 days before starting a new one, so this
    # folder never grows without bound.
    Get-ChildItem $LogDir -Filter "deploy-*.log" -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
        Remove-Item -Force -ErrorAction SilentlyContinue

    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $LogFile = Join-Path $LogDir "deploy-$timestamp.log"
    Start-Transcript -Path $LogFile | Out-Null
}
catch {
    # A logging setup problem shouldn't block the actual deploy - just
    # run without a log file and say so.
    Write-Host "Warning: could not set up logging ($($_.Exception.Message)) - continuing without a log file." -ForegroundColor Yellow
    $LogFile = $null
}

try {
    Set-Location "C:\Users\justi\riff-catalog"

    Write-Host ""
    Write-Host "=== Building ===" -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed (exit code $LASTEXITCODE)." }

    Write-Host ""
    Write-Host "=== Staging changes ===" -ForegroundColor Cyan
    git add .

    $commitMsg = "Update " + (Get-Date -Format "yyyy-MM-dd HH:mm")

    Write-Host ""
    Write-Host "=== Committing ===" -ForegroundColor Cyan
    git commit -m "$commitMsg"
    # Not gating on exit code here - "nothing to commit" is a normal,
    # harmless case and shouldn't stop the deploy.

    Write-Host ""
    Write-Host "=== Pushing to GitHub ===" -ForegroundColor Cyan
    git push
    if ($LASTEXITCODE -ne 0) { throw "git push failed (exit code $LASTEXITCODE)." }

    Write-Host ""
    Write-Host "=== Deploying to Netlify ===" -ForegroundColor Cyan
    netlify deploy --prod --dir=dist
    if ($LASTEXITCODE -ne 0) { throw "netlify deploy failed (exit code $LASTEXITCODE)." }

    Write-Host ""
    Write-Host "Deploy complete" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "DEPLOY FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    if ($LogFile) {
        Write-Host ""
        Write-Host "Log saved to: $LogFile" -ForegroundColor DarkGray
        try { Stop-Transcript | Out-Null } catch {}
    }

    Write-Host ""
    Write-Host "Press Enter to close now (auto-closing in 2 minutes)..." -ForegroundColor Gray
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt 120) {
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq 'Enter') { break }
        }
        Start-Sleep -Milliseconds 200
    }
}
