[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ops\daily-config.json') -Raw | ConvertFrom-Json
if ((Get-TimeZone).Id -ne 'Taipei Standard Time') { throw 'This task installer requires the Windows timezone Asia/Taipei.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'server\scripts\daily-run.mjs'
if (-not (Test-Path -LiteralPath $script)) { throw 'Pipeline script is missing.' }
$action = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '"') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $config.freezeTime
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$dailyDescription = "Asia/Taipei: verify ingestion complete, prepare daily edition at $($config.freezeTime), send email at $($config.sendTime)."
Register-ScheduledTask -TaskName 'NewsAgg Daily Pipeline' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $dailyDescription -Force | Out-Null
$ingestAction = New-ScheduledTaskAction -Execute $node -Argument ('"' + $script + '" --ingest') -WorkingDirectory $PSScriptRoot
$ingestTrigger = New-ScheduledTaskTrigger -Daily -At $config.startTime
$ingestSettings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'NewsAgg Live Ingestion' -Action $ingestAction -Trigger $ingestTrigger -Settings $ingestSettings -Principal $principal -Description "$($config.startTime) Taipei: scrape, validate and publish each ready article. No email." -Force | Out-Null
foreach ($taskName in @('NewsAgg Daily Pipeline', 'NewsAgg Live Ingestion')) {
    $verified = Get-ScheduledTask -TaskName $taskName
    if (-not $verified.Settings.Enabled) { throw "Task $taskName is not enabled; legacy task was left unchanged." }
}
foreach ($legacy in @('NewsAgg Daily Email 0500')) {
    $task = Get-ScheduledTask -TaskName $legacy -ErrorAction SilentlyContinue
    if ($task) { Disable-ScheduledTask -TaskName $legacy | Out-Null }
}
# Guard legacy entrypoints even if an old, unpushed GitHub schedule fires.
$marker = Join-Path $PSScriptRoot 'logs\daily\primary-enabled.json'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $marker) | Out-Null
@{ task = 'NewsAgg Daily Pipeline'; installedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content -LiteralPath $marker -Encoding UTF8
Get-ScheduledTaskInfo -TaskName 'NewsAgg Daily Pipeline' | Select-Object TaskName,NextRunTime,LastRunTime,LastTaskResult
Get-ScheduledTaskInfo -TaskName 'NewsAgg Live Ingestion' | Select-Object TaskName,NextRunTime,LastRunTime,LastTaskResult
Write-Host "Live ingestion at $($config.startTime); prepare daily edition at $($config.freezeTime); email at $($config.sendTime). Windows must remain logged in."
