[CmdletBinding()]
param([switch]$DryRun, [switch]$Benchmark, [switch]$Full, [switch]$Ingest)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
$arguments = @((Join-Path $PSScriptRoot 'server\scripts\daily-run.mjs'))
if ($DryRun) { $arguments += '--dry-run' }
if ($Benchmark -or $Full) { $arguments += '--benchmark' }
if ($Full) { $arguments += '--refresh-existing' }
if ($Ingest) { $arguments += '--ingest' }
& $node @arguments
exit $LASTEXITCODE
