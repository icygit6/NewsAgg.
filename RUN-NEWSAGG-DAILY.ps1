[CmdletBinding()]
param([switch]$DryRun, [switch]$Benchmark, [switch]$Full, [switch]$Ingest, [string]$Recipients, [string]$Target)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
$arguments = @((Join-Path $PSScriptRoot 'server\scripts\daily-run.mjs'))
if ($DryRun) { $arguments += '--dry-run' }
if ($Benchmark -or $Full) { $arguments += '--benchmark' }
if ($Full) { $arguments += '--refresh-existing' }
if ($Ingest) { $arguments += '--ingest' }
if ($Recipients) { $arguments += @('--recipients', $Recipients) }
if ($Target) { $arguments += @('--target', $Target) }
& $node @arguments
exit $LASTEXITCODE
