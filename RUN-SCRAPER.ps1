[CmdletBinding()]
param([ValidateRange(1, 100)][int]$Target = 20)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running.' }

docker compose --profile scraper run --rm scraper python run_all.py --target $Target
if ($LASTEXITCODE -ne 0) { throw "Scraper failed with exit code $LASTEXITCODE." }
