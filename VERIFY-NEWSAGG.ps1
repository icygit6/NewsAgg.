[CmdletBinding()]
param([switch]$LiveAI)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

foreach ($project in @('server','client')) {
    Push-Location -LiteralPath (Join-Path $PSScriptRoot $project)
    try {
        foreach ($task in @('test','typecheck','lint','build')) {
            & npm.cmd run $task
            if ($LASTEXITCODE -ne 0) { throw "$project/$task failed." }
        }
    } finally { Pop-Location }
}
node --test deploy/stable-origin/worker.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Stable origin tests failed.' }
node --test server/scripts/daily-policy.test.mjs server/scripts/daily-runtime.test.mjs server/scripts/daily-email.test.mjs server/scripts/daily-edition.test.mjs server/scripts/ingestion-state.test.mjs server/scripts/web-recovery.test.mjs
if ($LASTEXITCODE -ne 0) { throw 'Daily pipeline tests failed.' }
docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose validation failed.' }
docker compose --profile scraper run --rm scraper python -m unittest discover -s tests -v
if ($LASTEXITCODE -ne 0) { throw 'Scraper regression tests failed.' }
& powershell.exe -NoProfile -File (Join-Path $PSScriptRoot 'VERIFY-API.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Live API verification failed.' }
& powershell.exe -NoProfile -File (Join-Path $PSScriptRoot 'RUN-NEWSAGG-DAILY.ps1') -DryRun
if ($LASTEXITCODE -ne 0) { throw 'Daily workflow dry-run failed.' }
if ($LiveAI) {
    Push-Location -LiteralPath (Join-Path $PSScriptRoot 'server')
    try {
        node scripts/ai-smoke.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Live AI smoke test failed.' }
    } finally { Pop-Location }
}
Write-Host 'Verification completed. No cleanup deletions, test emails, or tunnel rotation were performed.'
