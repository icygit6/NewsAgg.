[CmdletBinding()]
param(
    [switch]$SkipScrape,
    [switch]$ValidateOnly,
    [switch]$DryRun,
    [switch]$RotateTunnel,
    [switch]$ForceEmail,
    [string]$TestEmailTo = '',
    [string]$ScrapeStatusOverride = ''
)

$ErrorActionPreference = 'Stop'
if (-not $DryRun -and -not $ValidateOnly -and -not $TestEmailTo -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'logs\daily\primary-enabled.json'))) {
    throw 'Legacy daily delivery is disabled. NewsAgg Daily Pipeline owns scraper-to-email ordering and deduplication.'
}
if ($TestEmailTo) {
    $parsedRecipient = [System.Net.Mail.MailAddress]::new($TestEmailTo.Trim())
    if ($parsedRecipient.Address -ne $TestEmailTo.Trim() -or $TestEmailTo -match '[,;\r\n]') {
        throw 'TestEmailTo must be one plain email address.'
    }
    if ($RotateTunnel -or $ForceEmail) { throw 'TestEmailTo cannot rotate the tunnel or force a daily delivery.' }
    # Process-local override only: never modify the scheduled recipient list.
    $env:REPORT_EMAIL_TO = $parsedRecipient.Address
}
Set-Location -LiteralPath $PSScriptRoot

$logDirectory = Join-Path $PSScriptRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $logDirectory "daily-publish-$runStamp.log"
$deliveryStamp = Join-Path $logDirectory 'last-daily-email-date.txt'

function Import-LocalMailEnvironment {
    # The self-hosted runner and the 05:00 Windows task share this machine.
    # Prefer the local, gitignored SMTP configuration so a stale GitHub secret
    # cannot break delivery. Values are never printed to the workflow log.
    $envFile = Join-Path $PSScriptRoot 'server\.env'
    if (-not (Test-Path -LiteralPath $envFile)) { return }
    $allowed = @('SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM')
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            if ($allowed -contains $name) {
                [Environment]::SetEnvironmentVariable($name, $matches[2], 'Process')
            }
        }
    }
}

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
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/health?db=1' -TimeoutSec 10
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
        $logs = (& docker compose logs --no-color --tail 80 tunnel | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Out-String)
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
        Business = '&#21830;&#26989;'; Climate = '&#27683;&#20505;'; Health = '&#20581;&#24247;'; Lifestyle = '&#29983;&#27963;';
        Politics = '&#25919;&#27835;'; Science = '&#31185;&#23416;'; Sport = '&#39636;&#32946;'; World = '&#22283;&#38555;'
    }
    $sentimentZh = @{ positive = '&#27491;&#38754;'; neutral = '&#20013;&#31435;'; negative = '&#36000;&#38754;' }
    $leadTopicsEn = @($topicGroups | Select-Object -First 3 | ForEach-Object { "$($_.Name) ($($_.Count))" }) -join ', '
    $leadTopicsZh = @($topicGroups | Select-Object -First 3 | ForEach-Object {
        $label = if ($topicZh.ContainsKey($_.Name)) { $topicZh[$_.Name] } else { $_.Name }
        "$label ($($_.Count))"
    }) -join '&#12289;'
    $leadSources = @($sourceGroups | Select-Object -First 4 | ForEach-Object { $_.Name }) -join ', '
    $dominantSentiment = if ($sentimentGroups.Count -gt 0) { [string]$sentimentGroups[0].Name } else { 'mixed' }
    $dominantSentimentZh = if ($sentimentZh.ContainsKey($dominantSentiment)) { $sentimentZh[$dominantSentiment] } else { '&#22810;&#20803;' }
    $developmentTitles = @($articles | Select-Object -First 3 | ForEach-Object { '&ldquo;' + (Encode-Html $_.title) + '&rdquo;' })
    $developments = if ($developmentTitles.Count -gt 0) { $developmentTitles -join '; ' } else { 'no leading developments yet' }

    $editorialEn = "NewsAgg tracked $freshCount stories during the latest 30-hour reporting window. Coverage is led by $leadTopicsEn, drawing on reporting from $leadSources. The overall news tone is predominantly $dominantSentiment. The leading developments include $developments. Together, these stories provide a cross-source view of what is shaping the current news cycle."
    $editorialZh = "NewsAgg &#22312;&#26368;&#36817; 30 &#23567;&#26178;&#30340;&#26032;&#32862;&#36913;&#26399;&#20013;&#36861;&#36452;&#20102; $freshCount &#21063;&#22577;&#23566;&#12290;&#28966;&#40670;&#20027;&#35201;&#38598;&#20013;&#26044; $leadTopicsZh&#65292;&#36039;&#35338;&#20358;&#28304;&#21253;&#25324; $leadSources&#12290;&#25972;&#39636;&#26032;&#32862;&#24773;&#32210;&#20197;$dominantSentimentZh&#28858;&#20027;&#12290;&#37325;&#35201;&#30332;&#23637;&#21253;&#25324;&#65306;$developments&#12290;&#36889;&#20123;&#22577;&#23566;&#20849;&#21516;&#21576;&#29694;&#30446;&#21069;&#20540;&#24471;&#38364;&#27880;&#30340;&#22283;&#38555;&#33287;&#21312;&#22495;&#21205;&#24907;&#12290;"

    $safeUrl = Encode-Html $PublicUrl
    $safeStatus = Encode-Html $ScrapeStatus
    $generatedAt = Get-Date -Format 'dd MMMM yyyy, HH:mm'
    $subjectZh = [System.Net.WebUtility]::HtmlDecode('&#27599;&#26085;&#26032;&#32862;&#25688;&#35201;')
    $subject = "NewsAgg Daily Brief | $subjectZh - $freshCount fresh stories"
    if ($TestEmailTo) { $subject = "[TEST] $subject" }
    $body = @"
<!doctype html><html><body style="margin:0;background:#eef2ff;font-family:Segoe UI,Arial,sans-serif;color:#172554">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px;background:#eef2ff"><tr><td align="center">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(30,64,175,.12)">
<tr><td style="padding:30px;background-color:#2563eb;background-image:linear-gradient(135deg,#173a63 0%,#2563eb 100%);color:#fff"><div style="font-size:12px;letter-spacing:1.8px;text-transform:uppercase;opacity:.8">Daily intelligence brief &middot; &#27599;&#26085;&#26032;&#32862;&#24773;&#22577;</div><h1 style="margin:8px 0 4px;font-size:30px">NewsAgg is live</h1><div style="opacity:.88">Updated $generatedAt &middot; &#26356;&#26032;&#26178;&#38291; $generatedAt</div></td></tr>
<tr><td style="padding:28px">
<p style="margin-top:0;line-height:1.6">Your new public link is ready. This briefing is generated directly from the latest scraped coverage.<br>&#26032;&#30340;&#20844;&#38283;&#36899;&#32080;&#24050;&#24314;&#31435;&#65292;&#26412;&#25688;&#35201;&#30452;&#25509;&#26681;&#25818;&#26368;&#26032;&#25847;&#21462;&#30340;&#26032;&#32862;&#20839;&#23481;&#29986;&#29983;&#12290;</p>
<p style="text-align:center;margin:26px 0"><a href="$safeUrl" style="display:inline-block;padding:14px 26px;border-radius:999px;background-color:#2563eb;background-image:linear-gradient(90deg,#173a63 0%,#2563eb 100%);color:#fff;text-decoration:none;font-weight:700;box-shadow:0 6px 16px rgba(37,99,235,.24)">Open NewsAgg &middot; &#38283;&#21855; NewsAgg</a></p>
<p style="text-align:center;font-size:12px;color:#64748b;word-break:break-all">$safeUrl</p>
<table role="presentation" width="100%" cellspacing="8" cellpadding="0"><tr>
<td style="padding:16px;background:#eff6ff;border-radius:12px;text-align:center"><div style="font-size:26px;font-weight:800;color:#1d4ed8">$DatabaseTotal</div><div style="font-size:12px;color:#64748b">Database stories<br>&#36039;&#26009;&#24235;&#26032;&#32862;</div></td>
<td style="padding:16px;background:#ecfdf5;border-radius:12px;text-align:center"><div style="font-size:26px;font-weight:800;color:#059669">$freshCount</div><div style="font-size:12px;color:#64748b">Latest 30 hours<br>&#26368;&#36817; 30 &#23567;&#26178;</div></td>
<td style="padding:16px;background:#fff7ed;border-radius:12px;text-align:center"><div style="font-size:15px;font-weight:800;color:#c2410c">$safeStatus</div><div style="font-size:12px;color:#64748b">Scraper status<br>&#25847;&#21462;&#29376;&#24907;</div></td>
</tr></table>
<h2 style="font-size:18px;margin:28px 0 12px">Editor's overview &middot; &#32232;&#36655;&#27010;&#35261;</h2>
<p style="line-height:1.72;margin:8px 0">$editorialEn</p>
<p style="line-height:1.8;margin:14px 0;color:#334155">$editorialZh</p>
<p style="line-height:1.65;margin:6px 0"><strong>Leading sources &middot; &#20027;&#35201;&#20358;&#28304;:</strong> $sources</p>
<p style="line-height:1.65;margin:6px 0"><strong>Coverage mix &middot; &#26032;&#32862;&#20027;&#38988;:</strong> $topics</p>
<p style="line-height:1.65;margin:6px 0"><strong>Sentiment &middot; &#26032;&#32862;&#24773;&#32210;:</strong> $sentiments</p>
<h2 style="font-size:18px;margin:28px 0 12px">Top developments &middot; &#37325;&#35201;&#21205;&#24907;</h2><ol style="padding-left:22px;line-height:1.45">$headlineItems</ol>
</td></tr>
<tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center">Automatically delivered by NewsAgg &middot; &#30001; NewsAgg &#33258;&#21205;&#23492;&#36865;</td></tr>
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
            $client.Timeout = 30000
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
    Import-LocalMailEnvironment

    $today = Get-Date -Format 'yyyy-MM-dd'
    if (-not $TestEmailTo -and -not $ValidateOnly -and -not $DryRun -and -not $ForceEmail -and (Test-Path -LiteralPath $deliveryStamp)) {
        $lastDelivery = (Get-Content -LiteralPath $deliveryStamp -Raw).Trim()
        if ($lastDelivery -eq $today) {
            Write-RunLog "Daily email was already delivered on $today; skipping duplicate run."
            exit 0
        }
    }
    Wait-DockerEngine

    if ($ValidateOnly -or $DryRun) {
        if ((Invoke-Docker -Arguments @('compose', 'config', '--quiet')) -ne 0) {
            throw 'Docker Compose configuration is invalid.'
        }
        Wait-NewsApi
        $validationSnapshot = Get-NewsSnapshot
        if ($DryRun) {
            $validationDigest = Get-DigestSnapshot
            Write-RunLog "Dry-run: digest has $($validationDigest.totalCount) fresh stories; SMTP configuration is present: $([bool]($env:SMTP_USER -and $env:SMTP_PASS)). No email sent and no tunnel rotation."
        }
        Write-RunLog "Validation passed: API is healthy with $($validationSnapshot.totalCount) articles. Tunnel and email were not changed."
        exit 0
    }

    if ($TestEmailTo) {
        # Exercise the real digest and SMTP path, without scraping, rebuilding,
        # rotating tunnels, or suppressing the next scheduled daily delivery.
        Wait-NewsApi
        $testUrl = $env:NEWSAGG_STABLE_URL
        if (-not $testUrl -and (Test-Path -LiteralPath '.env')) {
            $stableLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^NEWSAGG_STABLE_URL=' } | Select-Object -Last 1
            if ($stableLine) { $testUrl = ($stableLine -split '=', 2)[1].Trim().Trim('"').Trim("'") }
        }
        if (-not $testUrl) { throw 'Configure NEWSAGG_STABLE_URL before sending a test email.' }
        $testOrigin = [Uri]$testUrl
        if ($testOrigin.Scheme -ne 'https' -or $testOrigin.AbsolutePath -ne '/' -or $testOrigin.UserInfo -or $testOrigin.Query -or $testOrigin.Fragment -or -not $testOrigin.IsDefaultPort) {
            throw 'Test email URL must be a bare HTTPS origin.'
        }
        $publicHealth = Invoke-WebRequest -UseBasicParsing -Uri "$($testUrl.TrimEnd('/'))/health" -TimeoutSec 20
        if ($publicHealth.StatusCode -ne 200) { throw 'Public site health check failed.' }
        $testSnapshot = Get-NewsSnapshot
        $testDigest = Get-DigestSnapshot
        $lastRun = (Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/stats/scraper-status' -TimeoutSec 10).data
        $testStatus = if ($lastRun) { "$($lastRun.status) (latest run)" } else { 'No recorded run' }
        Send-DailyEmail -PublicUrl $testUrl -Snapshot $testDigest -DatabaseTotal ([int]$testSnapshot.totalCount) -ScrapeStatus $testStatus
        Write-RunLog "SMTP accepted one test email to $env:REPORT_EMAIL_TO. Inbox delivery is not yet confirmed. Daily delivery stamp and scheduled recipients were not changed."
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
        $scrapeExit = Invoke-Docker -Arguments @('compose', '--profile', 'scraper', 'run', '--build', '--rm', 'scraper')
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
    if (-not $ScrapeStatusOverride -and $scrapeStatus -notlike 'Failed*') {
        try {
            $lastRun = (Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/stats/scraper-status' -TimeoutSec 10).data
            $scrapeStatus = if ($lastRun) { "$($lastRun.status) (latest run)" } else { 'No recorded run' }
        } catch { $scrapeStatus = 'Latest run status unavailable' }
    }

    Write-RunLog 'Ensuring the Cloudflare Quick Tunnel is running; preserve its URL by default.'
    $tunnelArguments = @('compose', 'up', '-d', '--no-deps', 'tunnel')
    if ($RotateTunnel) { $tunnelArguments += '--force-recreate' }
    if ((Invoke-Docker -Arguments $tunnelArguments) -ne 0) {
        throw 'Failed to start the temporary Cloudflare Quick Tunnel.'
    }
    $publicUrl = Get-PublicUrl
    Write-RunLog "Public URL: $publicUrl"
    # Optional stable free workers.dev front door; no new hostname is sent to
    # Google on each Quick Tunnel change. Requires one-time owner setup.
    $stableUrl = $env:NEWSAGG_STABLE_URL
    if (-not $stableUrl -and (Test-Path -LiteralPath '.env')) {
        $stableLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^NEWSAGG_STABLE_URL=' } | Select-Object -First 1
        if ($stableLine) { $stableUrl = ($stableLine -split '=', 2)[1].Trim().Trim('"').Trim("'") }
    }
    if ($stableUrl) {
        $parsedStable = [Uri]$stableUrl
        if ($parsedStable.Scheme -ne 'https' -or $parsedStable.AbsolutePath -ne '/' -or $parsedStable.Query -or $parsedStable.UserInfo) { throw 'NEWSAGG_STABLE_URL must be a bare HTTPS origin.' }
        & (Join-Path $PSScriptRoot 'UPDATE-STABLE-ORIGIN.ps1') -TunnelUrl $publicUrl
        $publicUrl = $stableUrl.TrimEnd('/')
        Write-RunLog "Stable public URL: $publicUrl"
    }

    # Account verification/reset messages must point at the current temporary
    # hostname. Shell variables override the localhost defaults from .env for
    # this server recreation without storing the short-lived URL on disk.
    $env:PUBLIC_CLIENT_URL = $publicUrl
    $env:CLIENT_URL = "$publicUrl,http://localhost:8080,http://localhost"
    if ((Invoke-Docker -Arguments @('compose', 'up', '-d', '--force-recreate', '--no-deps', 'server')) -ne 0) {
        throw 'Failed to apply the temporary public URL to the server.'
    }
    Wait-NewsApi

    Send-DailyEmail -PublicUrl $publicUrl -Snapshot $digest -DatabaseTotal $databaseTotal -ScrapeStatus $scrapeStatus
    Set-Content -LiteralPath $deliveryStamp -Value $today -Encoding ASCII
    Write-RunLog "Email delivered to $env:REPORT_EMAIL_TO"

    if ($scrapeStatus -like 'Failed*') { exit 2 }
} catch {
    Write-RunLog "ERROR: $($_.Exception.Message)"
    throw
}
