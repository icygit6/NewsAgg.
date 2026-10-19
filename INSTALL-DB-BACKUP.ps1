[CmdletBinding()]
param([string]$At = '21:30')
$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'server\scripts\db-backup.mjs'
if (-not (Test-Path -LiteralPath $script)) { throw 'Database backup script is missing.' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$launcher = Join-Path $env:SystemRoot 'System32\wscript.exe'
$hiddenScript = Join-Path $PSScriptRoot 'ops\run-hidden.vbs'
if (-not (Test-Path -LiteralPath $hiddenScript)) { throw 'Hidden task launcher is missing.' }
$action = New-ScheduledTaskAction -Execute $launcher -Argument ('//B //NoLogo "' + $hiddenScript + '" "' + $node + '" "' + $script + '"') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'NewsAgg Database Backup' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily at $At Taipei: pg_dump of the local Docker PostgreSQL into backups\, keeping the newest 14 dumps. Log: logs\db-backup.log." -Force | Out-Null
Get-ScheduledTaskInfo -TaskName 'NewsAgg Database Backup' | Select-Object TaskName,NextRunTime,LastRunTime,LastTaskResult
