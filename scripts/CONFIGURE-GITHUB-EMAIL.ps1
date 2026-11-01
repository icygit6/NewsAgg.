$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

$repo = 'icygit6/NewsAgg.'
$ghCandidates = @(
    (Join-Path $env:ProgramFiles 'GitHub CLI\gh.exe'),
    (Get-Command gh -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue)
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
$gh = $ghCandidates | Select-Object -First 1
if (-not $gh) { throw 'GitHub CLI belum terpasang.' }

$credentialInput = "protocol=https`nhost=github.com`nusername=icygit6`n`n"
$credentialOutput = $credentialInput | git credential fill
$passwordLine = $credentialOutput | Where-Object { $_ -like 'password=*' } | Select-Object -First 1
if (-not $passwordLine) { throw 'Login GitHub tidak ditemukan di Windows Credential Manager.' }
$env:GH_TOKEN = $passwordLine.Substring(9)

try {
    $repoJson = & $gh repo view $repo --json nameWithOwner,isPrivate
    if ($LASTEXITCODE -ne 0) { throw 'Repository tidak dapat diakses.' }
    $repoInfo = $repoJson | ConvertFrom-Json
    if (-not $repoInfo.isPrivate) { throw 'Repository belum private.' }
    Write-Host "Konfigurasi email untuk $($repoInfo.nameWithOwner)" -ForegroundColor Cyan
    Write-Host ''

    $sender = (Read-Host 'Alamat Gmail pengirim').Trim()
    try { [void][System.Net.Mail.MailAddress]::new($sender) } catch { throw 'Alamat Gmail pengirim tidak valid.' }

    $recipients = @((Get-Content -LiteralPath (Join-Path $RepoRoot 'ops\daily-config.json') -Raw | ConvertFrom-Json).recipients)
    if (-not $recipients.Count) { throw 'Daftar penerima di ops/daily-config.json kosong.' }

    $securePassword = Read-Host 'Google App Password 16 karakter (input disembunyikan)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $plainPassword = ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) -replace '\s', ''
        if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw 'App Password tidak boleh kosong.' }
        $sender | & $gh secret set SMTP_USER --repo $repo
        if ($LASTEXITCODE -ne 0) { throw 'Gagal menyimpan SMTP_USER.' }
        $plainPassword | & $gh secret set SMTP_PASS --repo $repo
        if ($LASTEXITCODE -ne 0) { throw 'Gagal menyimpan SMTP_PASS.' }
    } finally {
        if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        $plainPassword = $null
        $securePassword = $null
    }

    Write-Host ''
    Write-Host "Rahasia GitHub disimpan. Penerima pipeline aktif ditentukan oleh ops/daily-config.json: $($recipients -join ', ')" -ForegroundColor Green
} finally {
    Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
}

Write-Host 'Tekan Enter untuk menutup jendela.'
[void](Read-Host)
