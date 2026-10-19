[CmdletBinding()]
param([string]$Day = 'Sunday', [string]$At = '21:30')
$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'server\scripts\db-maintenance.mjs'
if (-not (Test-Path -LiteralPath $script)) { throw 'Database maintenance script is missing.' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$launcher = Join-Path $env:SystemRoot 'System32\wscript.exe'
$hiddenScript = Join-Path $PSScriptRoot 'ops\run-hidden.vbs'
if (-not (Test-Path -LiteralPath $hiddenScript)) { throw 'Hidden task launcher is missing.' }
$action = New-ScheduledTaskAction -Execute $launcher -Argument ('//B //NoLogo "' + $hiddenScript + '" "' + $node + '" "' + $script + '"') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Day -At $At
# Retries cover a still-running ingestion or a sleeping laptop.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'NewsAgg Weekly Maintenance' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Every $Day at $At Taipei: pg_dump backup (newest 8 kept in backups\), then scraper\cleanup.py --commit --vacuum. Log: logs\db-maintenance.log." -Force | Out-Null
# The weekly job replaces the former daily backup.
if (Get-ScheduledTask -TaskName 'NewsAgg Database Backup' -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName 'NewsAgg Database Backup' -Confirm:$false }
Get-ScheduledTaskInfo -TaskName 'NewsAgg Weekly Maintenance' | Select-Object TaskName,NextRunTime,LastTaskResult
