$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Docker engine: TIDAK AKTIF'
    Write-Host 'Jalankan SETUP-WINDOWS.ps1 sebagai Administrator, restart Windows, lalu buka Docker Desktop.'
    exit 1
}

Write-Host 'Docker engine: aktif'
docker compose ps
Write-Host ''
try {
    $web = Invoke-WebRequest -UseBasicParsing 'http://localhost:8080' -TimeoutSec 10
    Write-Host "Client HTTP: $($web.StatusCode)"
} catch { Write-Host "Client gagal: $($_.Exception.Message)" }
try {
    $api = Invoke-RestMethod 'http://localhost:3000/health' -TimeoutSec 10
    Write-Host "Server health: $($api | ConvertTo-Json -Compress)"
} catch { Write-Host "Server gagal: $($_.Exception.Message)" }

try {
    & "$PSScriptRoot\SHOW-PUBLIC-URL.ps1"
} catch { Write-Host "Tunnel publik gagal: $($_.Exception.Message)" }
