$ErrorActionPreference = 'Stop'

$containerId = docker compose ps -q tunnel
if (-not $containerId) {
    throw 'Tunnel publik tidak aktif. Jalankan START-NEWSAGG.ps1 terlebih dahulu.'
}

# Cloudflared writes normal informational messages (including the public URL)
# to stderr. Windows PowerShell can turn those lines into NativeCommandError
# records when ErrorActionPreference is Stop, so temporarily allow the output.
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$logs = docker compose logs --no-color --tail 200 tunnel 2>&1 | Out-String
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
Write-Host "NewsAgg publik: $publicUrl"
