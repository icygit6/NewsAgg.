[CmdletBinding()]
param([ValidateRange(1, 100)][int]$Target = 20)

$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -eq 'true' -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'logs\daily\primary-enabled.json'))) {
    throw 'Scheduled scraping is owned by NewsAgg Daily Pipeline. Run manually outside GitHub only after checking its lock.'
}
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'logs\daily\pipeline.lock')) {
    throw 'Daily pipeline lock exists. Do not launch a competing scraper.'
}
Set-Location -LiteralPath $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running.' }

docker compose --profile scraper run --build --rm scraper python -u run_all.py --target $Target
if ($LASTEXITCODE -ne 0) { throw "Scraper failed with exit code $LASTEXITCODE." }
