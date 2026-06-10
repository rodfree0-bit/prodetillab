$callBar = @"
    <!-- Call Bar -->
    <div class="call-bar" id="callBar">
      <a href="tel:+13103403489" class="call-bar-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
        <span class="call-bar-number">(310) 340-3489</span>
        <span class="call-bar-label">Tap to Call &mdash; We Answer Fast</span>
      </a>
    </div>

"@

$landingDir = "C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\landing"

$files = @(
    (Get-Item "$landingDir\index.html"),
    (Get-Item "$landingDir\rv_detail.html")
) + (Get-ChildItem "$landingDir\cities\*.html")

$count = 0
foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    if ($content -notmatch 'call-bar') {
        $content = $content.Replace("<body>", "<body>`r`n$callBar")
        [System.IO.File]::WriteAllText($f.FullName, $content, [System.Text.Encoding]::UTF8)
        $count++
    }
}
Write-Host "Injected call bar into $count files"
