[CmdletBinding()]
param(
    [switch]$SkipScrape,
    [switch]$ValidateOnly,
    [string]$ScrapeStatusOverride = ''
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$logDirectory = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDirectory "daily-publish-$runStamp.log"

function Write-RunLog {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Write-Host $line
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Invoke-Docker {
    param([Parameter(Mandatory)][string[]]$Arguments)
    & docker @Arguments 2>&1 | ForEach-Object {
        $text = $_.ToString()
        Write-Host $text
        Add-Content -LiteralPath $logFile -Value $text -Encoding UTF8
    }
    return $LASTEXITCODE
}

function Wait-DockerEngine {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI tidak ditemukan.'
    }

    & docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }

    $dockerCandidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Docker\Docker\Docker Desktop.exe'),
        (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe')
    )
    $dockerDesktop = $dockerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not (Test-Path -LiteralPath $dockerDesktop)) {
        throw 'Docker Desktop tidak ditemukan. Jalankan Docker Desktop secara manual.'
    }

    Write-RunLog 'Docker belum aktif; membuka Docker Desktop.'
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
    foreach ($attempt in 1..60) {
        Start-Sleep -Seconds 5
        & docker info *> $null
        if ($LASTEXITCODE -eq 0) { return }
    }
    throw 'Docker engine belum siap setelah menunggu 5 menit.'
}

function Get-NewsSnapshot {
    $uri = 'http://127.0.0.1:3000/api/news-from-db?page=1&pageSize=20&fields=summary&sort=latest'
    return Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 60
}

function Wait-NewsApi {
    foreach ($attempt in 1..30) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health' -TimeoutSec 10
            if ($health) { return }
        } catch {
            Start-Sleep -Seconds 4
        }
    }
    throw 'NewsAgg API belum sehat setelah menunggu 2 menit.'
}

function Get-PublicUrl {
    foreach ($attempt in 1..30) {
        Start-Sleep -Seconds 3
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $logs = (& docker compose logs --no-color --tail 200 tunnel 2>&1 | Out-String)
        $ErrorActionPreference = $previousPreference
        $matches = [regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($matches.Count -gt 0) {
            return $matches[$matches.Count - 1].Value
        }
    }
    throw 'Cloudflare belum memberikan URL publik setelah 90 detik.'
}

function Encode-Html {
    param([AllowNull()][object]$Value)
    return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function Get-TopValues {
    param([object[]]$Rows, [string]$Property, [int]$Limit = 3)
    return @($Rows | Where-Object { $_.$Property } | Group-Object -Property $Property |
        Sort-Object Count -Descending | Select-Object -First $Limit |
        ForEach-Object { "$(Encode-Html $_.Name) ($($_.Count))" })
}

function Send-DailyEmail {
    param(
        [Parameter(Mandatory)][string]$PublicUrl,
        [Parameter(Mandatory)][object]$Snapshot,
        [Parameter(Mandatory)][int]$PreviousTotal,
        [Parameter(Mandatory)][string]$ScrapeStatus
    )

    $requiredNames = @('SMTP_USER', 'SMTP_PASS', 'REPORT_EMAIL_TO')
    foreach ($name in $requiredNames) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
            throw "GitHub Secret/Variable $name belum diisi."
        }
    }

    $smtpHost = if ($env:SMTP_HOST) { $env:SMTP_HOST } else { 'smtp.gmail.com' }
    $smtpPort = if ($env:SMTP_PORT) { [int]$env:SMTP_PORT } else { 587 }
    $mailFrom = if ($env:MAIL_FROM) { $env:MAIL_FROM } else { $env:SMTP_USER }
    $recipients = @($env:REPORT_EMAIL_TO -split '[,;]' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($recipients.Count -eq 0) { throw 'REPORT_EMAIL_TO tidak berisi alamat email.' }

    $articles = @($Snapshot.articles)
    $currentTotal = [int]$Snapshot.totalCount
    $newCount = [Math]::Max(0, $currentTotal - $PreviousTotal)
    $sources = (Get-TopValues -Rows $articles -Property 'source_name') -join ', '
    $topics = (Get-TopValues -Rows $articles -Property 'topic') -join ', '
    $sentiments = (Get-TopValues -Rows $articles -Property 'sentiment_type') -join ', '
    if (-not $sources) { $sources = '-' }
    if (-not $topics) { $topics = '-' }
    if (-not $sentiments) { $sentiments = '-' }

    $headlineItems = @($articles | Select-Object -First 5 | ForEach-Object {
        $title = Encode-Html $_.title
        $source = Encode-Html $_.source_name
        $topic = Encode-Html $_.topic
        "<li style='margin:0 0 12px'><strong>$title</strong><br><span style='color:#64748b;font-size:13px'>$source &middot; $topic</span></li>"
    }) -join "`n"
    if (-not $headlineItems) { $headlineItems = '<li>Belum ada artikel yang dapat ditampilkan.</li>' }

    $safeUrl = Encode-Html $PublicUrl
    $safeStatus = Encode-Html $ScrapeStatus
    $generatedAt = Get-Date -Format 'dd MMMM yyyy, HH:mm'
    $subject = "NewsAgg Daily - $newCount artikel baru - $(Get-Date -Format 'dd MMM yyyy')"
    $body = @"
<!doctype html><html><body style="margin:0;background:#eef2ff;font-family:Segoe UI,Arial,sans-serif;color:#172554">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#eef2ff"><tr><td align="center">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(30,64,175,.12)">
<tr><td style="padding:30px;background:linear-gradient(135deg,#123c88,#2563eb);color:#fff"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;opacity:.8">Daily intelligence brief</div><h1 style="margin:8px 0 4px;font-size:30px">NewsAgg is live</h1><div style="opacity:.88">Diperbarui $generatedAt</div></td></tr>
<tr><td style="padding:28px">
<p style="margin-top:0;line-height:1.6">Link publik baru telah dibuat dan ringkasan berikut disusun langsung dari data scraping terbaru.</p>
<p style="text-align:center;margin:26px 0"><a href="$safeUrl" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">Buka NewsAgg</a></p>
<p style="text-align:center;font-size:12px;color:#64748b;word-break:break-all">$safeUrl</p>
<table role="presentation" width="100%" cellspacing="8" cellpadding="0"><tr>
<td style="padding:16px;background:#eff6ff;border-radius:12px;text-align:center"><div style="font-size:26px;font-weight:800;color:#1d4ed8">$currentTotal</div><div style="font-size:12px;color:#64748b">Total artikel</div></td>
<td style="padding:16px;background:#ecfdf5;border-radius:12px;text-align:center"><div style="font-size:26px;font-weight:800;color:#059669">+$newCount</div><div style="font-size:12px;color:#64748b">Pertambahan data</div></td>
<td style="padding:16px;background:#fff7ed;border-radius:12px;text-align:center"><div style="font-size:15px;font-weight:800;color:#c2410c">$safeStatus</div><div style="font-size:12px;color:#64748b">Status scraper</div></td>
</tr></table>
<h2 style="font-size:18px;margin:28px 0 12px">Ringkasan singkat</h2>
<p style="line-height:1.65;margin:6px 0"><strong>Sumber teratas:</strong> $sources</p>
<p style="line-height:1.65;margin:6px 0"><strong>Topik teratas:</strong> $topics</p>
<p style="line-height:1.65;margin:6px 0"><strong>Sentimen:</strong> $sentiments</p>
<h2 style="font-size:18px;margin:28px 0 12px">Berita terbaru</h2><ol style="padding-left:22px;line-height:1.45">$headlineItems</ol>
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center">Dikirim otomatis oleh NewsAgg &middot; GitHub Actions self-hosted runner</td></tr>
</table></td></tr></table></body></html>
"@

    $message = [System.Net.Mail.MailMessage]::new()
    try {
        $message.From = [System.Net.Mail.MailAddress]::new($mailFrom, 'NewsAgg Daily')
        foreach ($recipient in $recipients) { [void]$message.To.Add($recipient) }
        $message.Subject = $subject
        $message.SubjectEncoding = [Text.Encoding]::UTF8
        $message.Body = $body
        $message.BodyEncoding = [Text.Encoding]::UTF8
        $message.IsBodyHtml = $true

        $client = [System.Net.Mail.SmtpClient]::new($smtpHost, $smtpPort)
        try {
            $client.EnableSsl = $true
            $client.UseDefaultCredentials = $false
            $client.Credentials = [System.Net.NetworkCredential]::new($env:SMTP_USER, $env:SMTP_PASS)
            $client.Send($message)
        } finally {
            $client.Dispose()
        }
    } finally {
        $message.Dispose()
    }
}

try {
    Write-RunLog 'Memulai NewsAgg daily publish.'
    Wait-DockerEngine

    if ($ValidateOnly) {
        if ((Invoke-Docker -Arguments @('compose', 'config', '--quiet')) -ne 0) {
            throw 'Konfigurasi Docker Compose tidak valid.'
        }
        Wait-NewsApi
        $validationSnapshot = Get-NewsSnapshot
        Write-RunLog "Validasi berhasil: API sehat dengan $($validationSnapshot.totalCount) artikel. Tunnel dan email tidak diubah."
        exit 0
    }

    if ((Invoke-Docker -Arguments @('compose', 'up', '-d', '--build', 'server', 'client')) -ne 0) {
        throw 'Gagal menjalankan server/client.'
    }
    Wait-NewsApi
    $before = Get-NewsSnapshot
    $previousTotal = [int]$before.totalCount

    $scrapeStatus = if ($ScrapeStatusOverride) { $ScrapeStatusOverride } else { 'Dilewati' }
    if (-not $SkipScrape) {
        Write-RunLog 'Menjalankan scraper.'
        $scrapeExit = Invoke-Docker -Arguments @('compose', '--profile', 'scraper', 'run', '--rm', 'scraper')
        $scrapeStatus = if ($scrapeExit -eq 0) { 'Berhasil' } else { "Gagal ($scrapeExit)" }
    }

    Write-RunLog 'Restart server untuk membersihkan cache data.'
    if ((Invoke-Docker -Arguments @('compose', 'restart', 'server')) -ne 0) {
        throw 'Gagal me-restart server.'
    }
    Wait-NewsApi
    $after = Get-NewsSnapshot

    Write-RunLog 'Membuat ulang Cloudflare Quick Tunnel.'
    if ((Invoke-Docker -Arguments @('compose', 'up', '-d', '--force-recreate', '--no-deps', 'tunnel')) -ne 0) {
        throw 'Gagal membuat ulang tunnel.'
    }
    $publicUrl = Get-PublicUrl
    Write-RunLog "URL publik baru: $publicUrl"

    Send-DailyEmail -PublicUrl $publicUrl -Snapshot $after -PreviousTotal $previousTotal -ScrapeStatus $scrapeStatus
    Write-RunLog "Email terkirim ke $env:REPORT_EMAIL_TO"

    if ($scrapeStatus -like 'Gagal*') { exit 2 }
} catch {
    Write-RunLog "ERROR: $($_.Exception.Message)"
    throw
}
