# Deploy.ps1 — Riff Catalog build/push/deploy, one click.
# Stops immediately if any step fails, rather than pushing a broken
# build or deploying stale files.

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
    # Not gating on exit code here — "nothing to commit" is a normal,
    # harmless case (e.g. you only changed a file that was already
    # committed) and shouldn't stop the deploy.

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
    Write-Host ""
    Read-Host "Press Enter to continue"
}
