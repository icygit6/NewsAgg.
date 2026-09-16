[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Ensure-EnvFile {
    param([string]$Path, [string]$Template)
    if (-not (Test-Path -LiteralPath $Path)) {
        Copy-Item -LiteralPath $Template -Destination $Path
    }
}

function Set-EnvValue {
    param([string]$Path, [string]$Name, [string]$Value)
    $lines = [System.Collections.Generic.List[string]]::new()
    if (Test-Path -LiteralPath $Path) {
        foreach ($line in [IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Path))) { [void]$lines.Add($line) }
    }
    $replacement = "$Name=$Value"
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^$([regex]::Escape($Name))=") {
            $lines[$i] = $replacement
            $found = $true
        }
    }
    if (-not $found) { [void]$lines.Add($replacement) }
    [IO.File]::WriteAllLines((Join-Path $PSScriptRoot $Path), $lines, [Text.UTF8Encoding]::new($false))
}

function Read-SecretPlainText {
    param([string]$Prompt)
    $secure = Read-Host $Prompt -AsSecureString
    if ($secure.Length -eq 0) { return '' }
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

Ensure-EnvFile -Path '.env' -Template 'compose.env.example'
Ensure-EnvFile -Path 'server/.env' -Template 'server.env.example'

Write-Host 'NewsAgg production configuration' -ForegroundColor Cyan
Write-Host 'Press Enter on an optional prompt to preserve the existing value.'

$publicUrl = (Read-Host 'Permanent HTTPS URL (example: https://news.example.com)').Trim().TrimEnd('/')
if ($publicUrl) {
    $uri = $null
    if (-not [Uri]::TryCreate($publicUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https') {
        throw 'The public URL must be a valid https:// origin.'
    }
    Set-EnvValue '.env' 'PUBLIC_CLIENT_URL' $publicUrl
    Set-EnvValue '.env' 'CLIENT_URL' "$publicUrl,http://localhost:8080,http://localhost"
    Set-EnvValue 'server/.env' 'PUBLIC_CLIENT_URL' $publicUrl
    Set-EnvValue 'server/.env' 'CLIENT_URL' "$publicUrl,http://localhost:8080,http://localhost"
}
Set-EnvValue '.env' 'TRUST_PROXY' '1'

$tunnelToken = Read-SecretPlainText 'Cloudflare named-tunnel token (hidden)'
if ($tunnelToken) { Set-EnvValue '.env' 'CLOUDFLARE_TUNNEL_TOKEN' $tunnelToken.Trim() }

$googleClientId = (Read-Host 'Google OAuth Web client ID (public identifier)').Trim()
if ($googleClientId) { Set-EnvValue 'server/.env' 'GOOGLE_CLIENT_ID' $googleClientId }

$twelveKey = Read-SecretPlainText 'Twelve Data API key (hidden)'
if ($twelveKey) {
    Set-EnvValue '.env' 'TWELVE_DATA_API_KEY' $twelveKey.Trim()
    Set-EnvValue 'server/.env' 'TWELVE_DATA_API_KEY' $twelveKey.Trim()
}

$smtpUser = (Read-Host 'Gmail sender address for account emails').Trim()
if ($smtpUser) {
    $appPassword = (Read-SecretPlainText 'NEW Google App Password (hidden)').Replace(' ', '')
    if ($appPassword.Length -ne 16) { throw 'Google App Password must contain 16 characters after spaces are removed.' }
    Set-EnvValue 'server/.env' 'SMTP_HOST' 'smtp.gmail.com'
    Set-EnvValue 'server/.env' 'SMTP_PORT' '587'
    Set-EnvValue 'server/.env' 'SMTP_SECURE' '0'
    Set-EnvValue 'server/.env' 'SMTP_USER' $smtpUser
    Set-EnvValue 'server/.env' 'SMTP_PASS' $appPassword
    Set-EnvValue 'server/.env' 'MAIL_FROM' "NewsAgg <$smtpUser>"
}

Write-Host ''
Write-Host 'Configuration saved without displaying secret values.' -ForegroundColor Green
Write-Host 'Settings saved successfully. No secrets were displayed.' -ForegroundColor Green
Write-Host 'Run: .\START-NEWSAGG.ps1'
