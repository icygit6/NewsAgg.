[CmdletBinding()]
param([switch]$DryRun, [switch]$Benchmark, [switch]$Full, [switch]$Ingest, [string]$Recipients, [string]$Target)
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $RepoRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
$arguments = @((Join-Path $RepoRoot 'server\scripts\daily-run.mjs'))
if ($DryRun) { $arguments += '--dry-run' }
if ($Benchmark -or $Full) { $arguments += '--benchmark' }
if ($Full) { $arguments += '--refresh-existing' }
if ($Ingest) { $arguments += '--ingest' }
if ($Recipients) { $arguments += @('--recipients', $Recipients) }
if ($Target) { $arguments += @('--target', $Target) }
& $node @arguments
exit $LASTEXITCODE
