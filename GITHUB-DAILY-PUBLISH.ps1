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
    # Docker Compose emits normal progress on stderr. Windows PowerShell turns
    # those lines into NativeCommandError records when ErrorActionPreference is
    # Stop, so temporarily allow native output and rely on the real exit code.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker @Arguments 2>&1 | ForEach-Object {
            $text = $_.ToString()
            Write-Host $text
            Add-Content -LiteralPath $logFile -Value $text -Encoding UTF8
        }
        $dockerExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    return $dockerExitCode
}

function Wait-DockerEngine {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI was not found.'
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
        throw 'Docker Desktop was not found. Start Docker Desktop manually.'
    }

    Write-RunLog 'Docker is not running; starting Docker Desktop.'
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
    foreach ($attempt in 1..60) {
        Start-Sleep -Seconds 5
        & docker info *> $null
        if ($LASTEXITCODE -eq 0) { return }
    }
    throw 'Docker Engine was not ready after five minutes.'
}

function Get-NewsSnapshot {
    $uri = 'http://127.0.0.1:3000/api/news-from-db?page=1&pageSize=1&fields=summary&sort=latest'
    return Invoke-RestMethod -Uri $uri -Method Get -TimeoutSec 60
}

function Get-DigestSnapshot {
    # A source-diverse editorial sample from the latest reporting window.
    $uri = 'http://127.0.0.1:3000/api/news-from-db?page=1&pageSize=50&fields=summary&sort=top&sinceHours=30'
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
    throw 'NewsAgg API was not healthy after two minutes.'
}

function Get-PublicUrl {
    foreach ($attempt in 1..30) {
        Start-Sleep -Seconds 3
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $logs = (& docker compose logs --no-color --tail 200 tunnel 2>&1 | Out-String)
        $ErrorActionPreference = $previousPreference
        $matches = @([regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com') |
            ForEach-Object { $_.Value } |
            Where-Object { $_ -ne 'https://api.trycloudflare.com' })
        if ($matches.Count -gt 0) {
            return $matches[$matches.Count - 1]
        }
    }
    throw 'Cloudflare did not provide a public URL within 90 seconds.'
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
        [Parameter(Mandatory)][int]$DatabaseTotal,
        [Parameter(Mandatory)][string]$ScrapeStatus
    )

    $requiredNames = @('SMTP_USER', 'SMTP_PASS', 'REPORT_EMAIL_TO')
    foreach ($name in $requiredNames) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
            throw "GitHub Secret/Variable $name is missing."
        }
    }

    $smtpHost = if ($env:SMTP_HOST) { $env:SMTP_HOST } else { 'smtp.gmail.com' }
    $smtpPort = if ($env:SMTP_PORT) { [int]$env:SMTP_PORT } else { 587 }
    $smtpUser = $env:SMTP_USER.Trim()
    $mailFrom = if ($env:MAIL_FROM) { $env:MAIL_FROM.Trim() } else { $smtpUser }
    $recipients = @($env:REPORT_EMAIL_TO -split '[,;]' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($recipients.Count -eq 0) { throw 'REPORT_EMAIL_TO does not contain a valid address.' }

    $articles = @($Snapshot.articles)
    $freshCount = [int]$Snapshot.totalCount
    $topicGroups = @($articles | Where-Object { $_.topic } | Group-Object topic | Sort-Object Count -Descending)
    $sourceGroups = @($articles | Where-Object { $_.source_name } | Group-Object source_name | Sort-Object Count -Descending)
    $sentimentGroups = @($articles | Where-Object { $_.sentiment_type } | Group-Object sentiment_type | Sort-Object Count -Descending)
    $sources = (Get-TopValues -Rows $articles -Property 'source_name') -join ', '
    $topics = (Get-TopValues -Rows $articles -Property 'topic') -join ', '
    $sentiments = (Get-TopValues -Rows $articles -Property 'sentiment_type') -join ', '
    if (-not $sources) { $sources = '-' }
    if (-not $topics) { $topics = '-' }
    if (-not $sentiments) { $sentiments = '-' }

    $headlineItems = @($articles | Select-Object -First 6 | ForEach-Object {
        $title = Encode-Html $_.title
        $source = Encode-Html $_.source_name
        $topic = Encode-Html $_.topic
        "<li style='margin:0 0 12px'><strong>$title</strong><br><span style='color:#64748b;font-size:13px'>$source &middot; $topic</span></li>"
    }) -join "`n"
    if (-not $headlineItems) { $headlineItems = '<li>No reportable stories were found in this window.</li>' }

    $topicZh = @{
        Business = '商業'; Climate = '氣候'; Health = '健康'; Lifestyle = '生活';
        Politics = '政治'; Science = '科學'; Sport = '體育'; World = '國際'
    }
    $sentimentZh = @{ positive = '正面'; neutral = '中立'; negative = '負面' }
    $leadTopicsEn = @($topicGroups | Select-Object -First 3 | ForEach-Object { "$($_.Name) ($($_.Count))" }) -join ', '
    $leadTopicsZh = @($topicGroups | Select-Object -First 3 | ForEach-Object {
        $label = if ($topicZh.ContainsKey($_.Name)) { $topicZh[$_.Name] } else { $_.Name }
        "$label ($($_.Count))"
    }) -join '、'
    $leadSources = @($sourceGroups | Select-Object -First 4 | ForEach-Object { $_.Name }) -join ', '
    $dominantSentiment = if ($sentimentGroups.Count -gt 0) { [string]$sentimentGroups[0].Name } else { 'mixed' }
    $dominantSentimentZh = if ($sentimentZh.ContainsKey($dominantSentiment)) { $sentimentZh[$dominantSentiment] } else { '多元' }
    $developmentTitles = @($articles | Select-Object -First 3 | ForEach-Object { '&ldquo;' + (Encode-Html $_.title) + '&rdquo;' })
    $developments = if ($developmentTitles.Count -gt 0) { $developmentTitles -join '; ' } else { 'no leading developments yet' }

    $editorialEn = "NewsAgg tracked $freshCount stories during the latest 30-hour reporting window. Coverage is led by $leadTopicsEn, drawing on reporting from $leadSources. The overall news tone is predominantly $dominantSentiment. The leading developments include $developments. Together, these stories provide a cross-source view of what is shaping the current news cycle."
    $editorialZh = "NewsAgg 在最近 30 小時的新聞週期中追蹤了 $freshCount 則報導。焦點主要集中於 $leadTopicsZh，資訊來源包括 $leadSources。整體新聞情緒以$dominantSentimentZh為主。重要發展包括：$developments。這些報導共同呈現目前值得關注的國際與區域動態。"

    $safeUrl = Encode-Html $PublicUrl
    $safeStatus = Encode-Html $ScrapeStatus
    $generatedAt = Get-Date -Format 'dd MMMM yyyy, HH:mm'
    $subject = "NewsAgg Daily Brief | 每日新聞摘要 - $freshCount fresh stories"
    $body = @"
<!doctype html><html><body style="margin:0;background:#eef2ff;font-family:Segoe UI,Arial,sans-serif;color:#172554">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#eef2ff"><tr><td align="center">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(30,64,175,.12)">
<tr><td style="padding:30px;background:linear-gradient(135deg,#123c88,#2563eb);color:#fff"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;opacity:.8">Daily intelligence brief &middot; 每日新聞情報</div><h1 style="margin:8px 0 4px;font-size:30px">NewsAgg is live</h1><div style="opacity:.88">Updated $generatedAt &middot; 更新時間 $generatedAt</div></td></tr>
<tr><td style="padding:28px">
<p style="margin-top:0;line-height:1.6">Your new public link is ready. This briefing is generated directly from the latest scraped coverage.<br>新的公開連結已建立，本摘要直接根據最新擷取的新聞內容產生。</p>
<p style="text-align:center;margin:26px 0"><a href="$safeUrl" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700">Open NewsAgg &middot; 開啟 NewsAgg</a></p>
<p style="text-align:center;font-size:12px;color:#64748b;word-break:break-all">$safeUrl</p>
<table role="presentation" width="100%" cellspacing="8" cellpadding="0"><tr>
<td style="padding:16px;background:#eff6ff;border-radius:12px;text-align:center"><div style="font-size:26px;font-weight:800;color:#1d4ed8">$DatabaseTotal</div><div style="font-size:12px;color:#64748b">Database stories<br>資料庫新聞</div></td>
<td style="padding:16px;background:#ecfdf5;border-radius:12px;text-align:center"><div style="font-size:26px;font-weight:800;color:#059669">$freshCount</div><div style="font-size:12px;color:#64748b">Latest 30 hours<br>最近 30 小時</div></td>
<td style="padding:16px;background:#fff7ed;border-radius:12px;text-align:center"><div style="font-size:15px;font-weight:800;color:#c2410c">$safeStatus</div><div style="font-size:12px;color:#64748b">Scraper status<br>擷取狀態</div></td>
</tr></table>
<h2 style="font-size:18px;margin:28px 0 12px">Editor's overview &middot; 編輯概覽</h2>
<p style="line-height:1.72;margin:8px 0">$editorialEn</p>
<p style="line-height:1.8;margin:14px 0;color:#334155">$editorialZh</p>
<p style="line-height:1.65;margin:6px 0"><strong>Leading sources &middot; 主要來源:</strong> $sources</p>
<p style="line-height:1.65;margin:6px 0"><strong>Coverage mix &middot; 新聞主題:</strong> $topics</p>
<p style="line-height:1.65;margin:6px 0"><strong>Sentiment &middot; 新聞情緒:</strong> $sentiments</p>
<h2 style="font-size:18px;margin:28px 0 12px">Top developments &middot; 重要動態</h2><ol style="padding-left:22px;line-height:1.45">$headlineItems</ol>
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center">Automatically delivered by NewsAgg &middot; 由 NewsAgg 自動寄送</td></tr>
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
            $smtpPassword = $env:SMTP_PASS -replace '\s', ''
            $client.Credentials = [System.Net.NetworkCredential]::new($smtpUser, $smtpPassword)
            $client.Send($message)
        } finally {
            $smtpPassword = $null
            $client.Dispose()
        }
    } finally {
        $message.Dispose()
    }
}

try {
    Write-RunLog 'Starting the NewsAgg daily publish workflow.'
    Wait-DockerEngine

    if ($ValidateOnly) {
        if ((Invoke-Docker -Arguments @('compose', 'config', '--quiet')) -ne 0) {
            throw 'Docker Compose configuration is invalid.'
        }
        Wait-NewsApi
        $validationSnapshot = Get-NewsSnapshot
        Write-RunLog "Validation passed: API is healthy with $($validationSnapshot.totalCount) articles. Tunnel and email were not changed."
        exit 0
    }

    if ((Invoke-Docker -Arguments @('compose', 'up', '-d', '--build', 'server', 'client')) -ne 0) {
        throw 'Failed to start the server/client containers.'
    }
    Wait-NewsApi
    $before = Get-NewsSnapshot
    $databaseTotal = [int]$before.totalCount

    $scrapeStatus = if ($ScrapeStatusOverride) { $ScrapeStatusOverride } else { 'Skipped' }
    if (-not $SkipScrape) {
        Write-RunLog 'Running the scraper.'
        $scrapeExit = Invoke-Docker -Arguments @('compose', '--profile', 'scraper', 'run', '--rm', 'scraper')
        $scrapeStatus = if ($scrapeExit -eq 0) { 'Completed' } else { "Failed ($scrapeExit)" }
    }

    Write-RunLog 'Restarting the server to refresh cached data.'
    if ((Invoke-Docker -Arguments @('compose', 'restart', 'server')) -ne 0) {
        throw 'Failed to restart the server.'
    }
    Wait-NewsApi
    $after = Get-NewsSnapshot
    $databaseTotal = [int]$after.totalCount
    $digest = Get-DigestSnapshot

    Write-RunLog 'Rotating the Cloudflare Quick Tunnel.'
    if ((Invoke-Docker -Arguments @('compose', 'up', '-d', '--force-recreate', '--no-deps', 'tunnel')) -ne 0) {
        throw 'Failed to rotate the Cloudflare tunnel.'
    }
    $publicUrl = Get-PublicUrl
    Write-RunLog "New public URL: $publicUrl"

    Send-DailyEmail -PublicUrl $publicUrl -Snapshot $digest -DatabaseTotal $databaseTotal -ScrapeStatus $scrapeStatus
    Write-RunLog "Email delivered to $env:REPORT_EMAIL_TO"

    if ($scrapeStatus -like 'Failed*') { exit 2 }
} catch {
    Write-RunLog "ERROR: $($_.Exception.Message)"
    throw
}
