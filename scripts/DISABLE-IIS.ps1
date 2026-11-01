$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Jalankan skrip ini dari PowerShell dengan Run as Administrator.'
}

if (Get-Service W3SVC -ErrorAction SilentlyContinue) {
    Stop-Service W3SVC -Force
    Set-Service W3SVC -StartupType Manual
}

Write-Host 'IIS Web Service sudah dihentikan. NewsAgg tetap dilayani langsung oleh Docker + Cloudflare Tunnel.'
