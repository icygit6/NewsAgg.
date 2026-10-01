param([switch]$RefreshTunnel)
$ErrorActionPreference = 'Stop'

$containerId = docker compose ps -q tunnel
if (-not $containerId) {
    throw 'No public tunnel is running. Run START-NEWSAGG.ps1 first.'
}

# Cloudflared writes normal informational messages (including the public URL)
# to stderr. Windows PowerShell can turn those lines into NativeCommandError
# records when ErrorActionPreference is Stop, so temporarily allow the output.
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$logs = docker compose logs --no-color --tail 80 tunnel | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Out-String
$dockerLogsExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

if ($dockerLogsExitCode -ne 0) {
    throw 'Log tunnel tidak dapat dibaca. Periksa dengan: docker compose logs tunnel'
}
$urls = [regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
if ($urls.Count -eq 0) {
    throw 'Alamat publik belum muncul. Tunggu beberapa detik lalu jalankan skrip ini lagi.'
}

$publicUrl = $urls[$urls.Count - 1].Value

# Quick Tunnels can be retired by the provider while cloudflared keeps retrying
# the dead tunnel id. Verify the hostname and recreate the container once when
# that happens so a fresh free hostname is issued.
$isReachable = $false
try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $publicUrl -Method Head -TimeoutSec 10
    $isReachable = $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
} catch {}

if (-not $isReachable -and $RefreshTunnel) {
    Write-Host 'Temporary tunnel expired; creating a fresh free tunnel...'
    docker compose restart tunnel *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Tunnel could not be restarted.' }

    $deadline = (Get-Date).AddSeconds(45)
    do {
        Start-Sleep -Seconds 2
        $ErrorActionPreference = 'Continue'
        try { $logs = docker compose logs --no-color --since 1m --tail 80 tunnel | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Out-String }
        finally { $ErrorActionPreference = $previousErrorActionPreference }
        $urls = [regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    } while ($urls.Count -eq 0 -and (Get-Date) -lt $deadline)

    if ($urls.Count -eq 0) { throw 'A fresh public tunnel URL was not issued within 45 seconds.' }
    $publicUrl = $urls[$urls.Count - 1].Value
    & (Join-Path $PSScriptRoot 'UPDATE-STABLE-ORIGIN.ps1') -TunnelUrl $publicUrl
}

if (-not $isReachable -and -not $RefreshTunnel) {
    Write-Warning 'Tunnel check failed; its URL was NOT changed. Check Docker/network, or explicitly use -RefreshTunnel.'
}

$stableUrl = $env:NEWSAGG_STABLE_URL
if (-not $stableUrl -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.env'))) {
    $stableLine = Get-Content -LiteralPath (Join-Path $PSScriptRoot '.env') | Where-Object { $_ -match '^NEWSAGG_STABLE_URL=' } | Select-Object -Last 1
    if ($stableLine) { $stableUrl = ($stableLine -split '=', 2)[1].Trim().Trim('"').Trim("'") }
}
if ($stableUrl) { Write-Host "Configured stable public URL: $stableUrl" }

Write-Host "Temporary public URL: $publicUrl"
