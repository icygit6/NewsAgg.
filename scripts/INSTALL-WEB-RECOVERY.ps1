[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node.exe -ErrorAction Stop).Source
$script = Join-Path $RepoRoot 'server\scripts\web-recovery.mjs'
if (-not (Test-Path -LiteralPath $script)) { throw 'Web recovery script is missing.' }
if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'deploy\stable-origin\node_modules\wrangler\bin\wrangler.js'))) {
    throw 'Install the pinned deployment tool first: cd deploy\stable-origin; npm ci'
}
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$launcher = Join-Path $env:SystemRoot 'System32\wscript.exe'
$hiddenScript = Join-Path $RepoRoot 'ops\run-hidden.vbs'
if (-not (Test-Path -LiteralPath $hiddenScript)) { throw 'Hidden task launcher is missing.' }
$action = New-ScheduledTaskAction -Execute $launcher -Argument ('//B //NoLogo "' + $hiddenScript + '" "' + $node + '" "' + $script + '"') -WorkingDirectory $RepoRoot
$periodic = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $identity
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 7)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'NewsAgg Web Recovery' -Action $action -Trigger @($periodic, $logon) -Settings $settings -Principal $principal -Description 'Every 2 minutes while logged in: recover running Cloudflare tunnel and stable origin after connectivity returns. No builds, scraping or email. Leaves intentionally stopped Docker services stopped.' -Force | Out-Null
Start-ScheduledTask -TaskName 'NewsAgg Web Recovery'
Get-ScheduledTask -TaskName 'NewsAgg Web Recovery' | Select-Object TaskName,State
