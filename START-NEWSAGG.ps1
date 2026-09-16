$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI tidak ditemukan. Install dan jalankan Docker Desktop terlebih dahulu.'
}

if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath 'compose.env.example' -Destination '.env'
    throw 'File .env dibuat dari template. Periksa URL di dalamnya, lalu jalankan skrip ini lagi.'
}

if (-not (Test-Path -LiteralPath 'server/.env')) {
    Copy-Item -LiteralPath 'server.env.example' -Destination 'server/.env'
    throw 'File server/.env dibuat. Isi NEONDB_URL dan SECRET_KEY, lalu jalankan skrip ini lagi.'
}

$required = Get-Content -Raw -LiteralPath 'server/.env'
$hasDatabase = $required -match '(?m)^(NEONDB_URL|DATABASE_URL|NEON_DSN)=.+$'
$hasSecret = $required -match '(?m)^(SECRET_KEY|JWT_SECRET)=.+$'
if (-not $hasDatabase -or -not $hasSecret) {
    throw 'Isi salah satu URL database (NEONDB_URL/DATABASE_URL/NEON_DSN) dan salah satu secret (SECRET_KEY/JWT_SECRET) di server/.env.'
}

# Fail early with a useful message instead of letting `docker compose up`
# hang while Docker Desktop has no working WSL engine.
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker engine belum aktif. Jika Docker Desktop menampilkan Virtual Machine Platform not enabled, jalankan SETUP-WINDOWS.ps1 sebagai Administrator lalu restart Windows.'
}

docker compose config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Konfigurasi Docker Compose tidak valid.' }

$rootEnv = Get-Content -Raw -LiteralPath '.env'
$hasNamedTunnel = $rootEnv -match '(?m)^CLOUDFLARE_TUNNEL_TOKEN=\s*\S+'
if ($hasNamedTunnel) {
    docker compose --profile production up -d --build server client tunnel-named
    docker compose stop tunnel *> $null
} else {
    docker compose up -d --build server client tunnel
}
if ($LASTEXITCODE -ne 0) { throw 'Docker gagal membangun atau menjalankan NewsAgg.' }

docker compose ps
Write-Host ''
Write-Host 'NewsAgg aktif. Docker langsung: http://localhost:8080'
Write-Host 'Public address: run .\SHOW-PUBLIC-URL.ps1'
