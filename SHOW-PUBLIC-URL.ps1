$ErrorActionPreference = 'Stop'

$rootEnv = if (Test-Path -LiteralPath '.env') { Get-Content -Raw -LiteralPath '.env' } else { '' }
$configuredUrl = [regex]::Match($rootEnv, '(?m)^PUBLIC_CLIENT_URL=\s*(https://\S+)\s*$').Groups[1].Value
$namedContainerId = docker compose --profile production ps -q tunnel-named
if ($namedContainerId) {
    if ($configuredUrl) {
        Write-Host "NewsAgg public / NewsAgg 公開網址: $configuredUrl"
        exit 0
    }
    throw 'The named tunnel is running, but PUBLIC_CLIENT_URL is missing from root .env.'
}

$containerId = docker compose ps -q tunnel
if (-not $containerId) {
    throw 'No public tunnel is running. Run START-NEWSAGG.ps1 first.'
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
Write-Host "Temporary public URL / 臨時公開網址: $publicUrl"
