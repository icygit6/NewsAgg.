[CmdletBinding()]
param([string]$BaseUrl = 'http://127.0.0.1:8080')
$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$report = @()
$feed = Invoke-RestMethod "$base/api/news-from-db?page=1&pageSize=100&fields=summary&sort=latest"
if (-not $feed.success -or $feed.articles.Count -lt 1) { throw 'No verified feed is available.' }
$now = [DateTimeOffset]::UtcNow
$lastDate = [DateTimeOffset]::MaxValue
foreach ($article in $feed.articles) {
    $date = [DateTimeOffset]::Parse($article.published_at)
    if ($date -lt $now.AddDays(-30) -or $date -gt $now.AddHours(2)) { throw 'Feed contains an old or future-dated article.' }
    if ($date -gt $lastDate) { throw 'Newest-first sorting failed.' }
    $lastDate = $date
}
if (@($feed.articles.id | Select-Object -Unique).Count -ne $feed.articles.Count) { throw 'Duplicate article IDs in feed.' }
$report += 'Feed: fresh publication dates, newest-first, unique IDs'
$empty = Invoke-RestMethod "$base/api/news-from-db?page=99999&pageSize=20&sort=latest"
if ($empty.articles.Count -ne 0 -or $empty.totalCount -lt 1) { throw 'Out-of-range pagination lost its total count.' }
$report += 'Pagination: empty page preserves total count'
$detail = (Invoke-RestMethod "$base/api/articles/$($feed.articles[0].id)").data
if ($detail.content_blocks.Count -lt 1 -or $detail.extraction_version -ne 'structured-v3') { throw 'Article has no verified structure.' }
if (@($detail.quality_metadata.summary_evidence).Count -lt 1) { throw 'Article has no summary evidence to verify.' }
foreach ($sentence in $detail.quality_metadata.summary_evidence) {
    if (-not $detail.content.Contains($sentence)) { throw 'Extractive summary evidence is absent from the article.' }
}
$report += 'Reader: structured body and exact summary evidence'
$posts = (Invoke-RestMethod "$base/api/posts").data.posts
$lastDate = [DateTimeOffset]::MaxValue
foreach ($post in $posts) {
    $date = [DateTimeOffset]::Parse($post.created_at)
    if ($date -gt $lastDate -or -not $post.category) { throw 'Posts sorting/category check failed.' }
    $lastDate = $date
}
$report += 'Posts: newest-first and categories present'
try {
    Invoke-WebRequest -UseBasicParsing -Uri "$base/api/chat" -Method Post -Headers @{Origin=$base; 'Sec-Fetch-Site'='same-origin'} -ContentType 'application/json' -Body '{"articleId":"0000000000000000","message":"Test","lang":"en"}' | Out-Null
    throw 'Unauthenticated chat unexpectedly succeeded.'
} catch {
    if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne 401) { throw }
}
$report += 'Chat: unauthenticated request rejected (401)'
foreach ($line in $report) { Write-Output "PASS: $line" }
