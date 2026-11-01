[CmdletBinding()]
param([string]$TunnelUrl = '')
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

$stableUrl = $env:NEWSAGG_STABLE_URL
if (-not $stableUrl -and (Test-Path -LiteralPath (Join-Path $RepoRoot '.env'))) {
    $line = Get-Content -LiteralPath (Join-Path $RepoRoot '.env') | Where-Object { $_ -match '^NEWSAGG_STABLE_URL=' } | Select-Object -Last 1
    if ($line) { $stableUrl = ($line -split '=',2)[1].Trim().Trim('"').Trim("'") }
}
if (-not $stableUrl) { return }
$stable = [Uri]$stableUrl
if ($stable.Scheme -ne 'https' -or $stable.AbsolutePath -ne '/' -or $stable.Query -or $stable.Fragment -or $stable.UserInfo -or -not $stable.IsDefaultPort) {
    throw 'NEWSAGG_STABLE_URL must be a bare HTTPS origin.'
}

# Most starts reuse the existing Quick Tunnel. If the stable Worker is already
# healthy, redeploying it only adds latency and can unnecessarily trigger an
# interactive Wrangler OAuth flow when cached credentials have expired.
$stableAlreadyHealthy = $false
foreach ($attempt in 1..3) {
    try {
        $existingHealth = Invoke-WebRequest -UseBasicParsing -Uri "$($stableUrl.TrimEnd('/'))/health" -TimeoutSec 8
        $existingPayload = $existingHealth.Content | ConvertFrom-Json
        if ($existingHealth.StatusCode -eq 200 -and $existingPayload.ok) {
            $stableAlreadyHealthy = $true
            break
        }
    } catch { }
    if ($attempt -lt 3) { Start-Sleep -Seconds 2 }
}
if ($stableAlreadyHealthy) {
    Write-Host "Stable public address is already healthy: $stableUrl"
    return
}

Push-Location -LiteralPath $RepoRoot
try {
    if (-not $TunnelUrl) {
        foreach ($attempt in 1..20) {
            $oldPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try { $logs = docker compose logs --no-color --tail 1000 tunnel | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Out-String }
            finally { $ErrorActionPreference = $oldPreference }
            $urls = [regex]::Matches($logs,'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($urls.Count) { $TunnelUrl = $urls[$urls.Count-1].Value; break }
            Start-Sleep -Seconds 2
        }
    }
    if ($TunnelUrl -notmatch '^https://[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$') { throw 'No valid Quick Tunnel URL is available.' }
    Push-Location -LiteralPath (Join-Path $RepoRoot 'deploy\stable-origin')
    try {
        # Startup must never open a browser and wait for interactive OAuth. A
        # valid cached login still works; unattended use should provide the
        # CLOUDFLARE_API_TOKEN environment variable documented by Cloudflare.
        $previousCi = $env:CI
        $env:CI = 'true'
        try {
            $deployed = $false
            foreach ($deployAttempt in 1..3) {
                $localWrangler = Join-Path $RepoRoot 'deploy\stable-origin\node_modules\wrangler\bin\wrangler.js'
                if (Test-Path -LiteralPath $localWrangler) {
                    & node.exe $localWrangler deploy --var "NEWSAGG_ORIGIN:$TunnelUrl"
                } else {
                    & npx.cmd --yes wrangler@4.148.0 deploy --var "NEWSAGG_ORIGIN:$TunnelUrl"
                }
                if ($LASTEXITCODE -eq 0) { $deployed = $true; break }
                if ($deployAttempt -lt 3) { Start-Sleep -Seconds 5 }
            }
        } finally {
            if ($null -eq $previousCi) { Remove-Item Env:CI -ErrorAction SilentlyContinue }
            else { $env:CI = $previousCi }
        }
        if (-not $deployed) {
            throw 'Stable origin update needs Cloudflare authentication. Run "npx wrangler login" once in deploy\stable-origin, or set CLOUDFLARE_API_TOKEN for unattended startup.'
        }
    } finally { Pop-Location }
    # Fresh Quick Tunnel DNS can briefly return 1016 while the Worker deployment
    # is already live. Retry health without rotating again or sending a digest.
    $healthy = $false
    foreach ($attempt in 1..6) {
        try {
            $health = Invoke-WebRequest -UseBasicParsing -Uri "$($stableUrl.TrimEnd('/'))/health" -TimeoutSec 10
            $payload = $health.Content | ConvertFrom-Json
            if ($health.StatusCode -eq 200 -and $payload.ok) { $healthy = $true; break }
        } catch { }
        Start-Sleep -Seconds 5
    }
    if (-not $healthy) { throw 'Stable origin deployment did not pass its health check after DNS propagation retries.' }
    Write-Host "Stable public address is connected: $stableUrl"
} finally { Pop-Location }
