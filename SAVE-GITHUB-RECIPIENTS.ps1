[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Recipients)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not $Recipients.Trim()) { throw 'Enter recipient emails before selecting Save recipients.' }

$saved = & node.exe (Join-Path $PSScriptRoot 'server\scripts\save-daily-recipients.mjs') $Recipients
if ($LASTEXITCODE -ne 0) { throw 'Recipient validation failed.' }

$gh = (Get-Command gh.exe -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = Join-Path $env:ProgramFiles 'GitHub CLI\gh.exe' }
if (-not (Test-Path -LiteralPath $gh)) { throw 'GitHub CLI is unavailable on the self-hosted runner.' }

# Ask the installed Git Credential Manager directly. The runner's Git wrapper
# can reject the credential stdin record even though the manager accepts it.
$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$manager = Join-Path $env:ProgramFiles 'Git\mingw64\bin\git-credential-manager.exe'
if (-not (Test-Path -LiteralPath $manager)) { throw 'Git Credential Manager is unavailable on the self-hosted runner.' }
$startInfo.FileName = $manager
$startInfo.Arguments = 'get'
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardInput = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$lookup = New-Object System.Diagnostics.Process
$lookup.StartInfo = $startInfo
[void]$lookup.Start()
$lookup.StandardInput.Write("protocol=https`nhost=github.com`nusername=icygit6`n`n")
$lookup.StandardInput.Close()
$outputTask = $lookup.StandardOutput.ReadToEndAsync()
$errorTask = $lookup.StandardError.ReadToEndAsync()
if (-not $lookup.WaitForExit(15000)) {
    $lookup.Kill()
    throw 'GitHub credential lookup timed out.'
}
if ($lookup.ExitCode -ne 0) { throw "GitHub credential lookup failed: $($errorTask.Result.Trim())" }
$passwordLine = @($outputTask.Result -split "`r?`n" | Where-Object { $_ -like 'password=*' }) | Select-Object -First 1
if (-not $passwordLine) { throw 'GitHub credential unavailable on the self-hosted runner.' }

$repo = if ($env:GITHUB_REPOSITORY) { $env:GITHUB_REPOSITORY } else { 'icygit6/NewsAgg.' }
$env:GH_TOKEN = $passwordLine.Substring(9)
try {
    & $gh variable set REPORT_EMAIL_TO --repo $repo --body $saved
    if ($LASTEXITCODE -ne 0) { throw 'Could not save the recipient variable in GitHub.' }
    $confirmed = & $gh variable get REPORT_EMAIL_TO --repo $repo
    if ($LASTEXITCODE -ne 0 -or $confirmed.Trim() -ne $saved) { throw 'Saved recipient verification failed.' }
    Write-Host "Saved $(@($saved -split ',').Count) additional recipient(s) for future runs."
} finally {
    Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
    $passwordLine = $null
}
