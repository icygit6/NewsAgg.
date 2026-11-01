[CmdletBinding()]
param([string]$Day = 'Sunday', [string]$At = '21:30', [int]$WeeksInterval = 1)
$ErrorActionPreference = 'Stop'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'server\scripts\db-maintenance.mjs'
if (-not (Test-Path -LiteralPath $script)) { throw 'Database maintenance script is missing.' }
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$launcher = Join-Path $env:SystemRoot 'System32\wscript.exe'
$hiddenScript = Join-Path $PSScriptRoot 'ops\run-hidden.vbs'
if (-not (Test-Path -LiteralPath $hiddenScript)) { throw 'Hidden task launcher is missing.' }
$action = New-ScheduledTaskAction -Execute $launcher -Argument ('//B //NoLogo "' + $hiddenScript + '" "' + $node + '" "' + $script + '"') -WorkingDirectory $PSScriptRoot
# Anchor the first run on the next $Day at $At, so the interval is counted
# from that day rather than from whichever weekday this script happens to be run.
$time = [datetime]::ParseExact($At, 'HH:mm', $null).TimeOfDay
$first = (Get-Date).Date
while ($first.DayOfWeek.ToString() -ne $Day -or ($first + $time) -le (Get-Date)) { $first = $first.AddDays(1) }
$trigger = New-ScheduledTaskTrigger -Weekly -WeeksInterval $WeeksInterval -DaysOfWeek $Day -At ($first + $time)
# Retries cover a still-running ingestion or a sleeping laptop.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 30)
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'NewsAgg Weekly Maintenance' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Every $WeeksInterval weeks on $Day at $At Taipei: pg_dump backup (replaces the previous one in backups\), then scraper\cleanup.py --commit --vacuum (30-day retention; protected/bookmarked/post-linked articles retained). Log: logs\db-maintenance.log." -Force | Out-Null
# This job is the only backup. Earlier variants ran a daily or a midweek backup task.
foreach ($old in 'NewsAgg Database Backup') {
  if (Get-ScheduledTask -TaskName $old -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $old -Confirm:$false }
}
Get-ScheduledTaskInfo -TaskName 'NewsAgg Weekly Maintenance' | Select-Object TaskName,NextRunTime,LastTaskResult
