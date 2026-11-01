$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Skrip ini harus dijalankan dari PowerShell yang dibuka dengan Run as Administrator.'
}

Write-Host 'Mengaktifkan WSL2 dan Virtual Machine Platform...'
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart
bcdedit /set hypervisorlaunchtype auto
if ($LASTEXITCODE -ne 0) { throw 'Gagal mengatur hypervisorlaunchtype.' }

Write-Host ''
Write-Host 'Fitur Windows sudah diproses. Restart Windows sebelum membuka Docker Desktop.'
Write-Host 'IIS tidak diperlukan: tunnel publik berjalan langsung di dalam Docker Compose.'
