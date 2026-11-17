# Startet einen kleinen lokalen Webserver für Things (ohne externe Tools).
# Aufruf:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080]
param([int]$Port = 8080)
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.ico' = 'image/x-icon'
}
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Things laeuft auf http://localhost:$Port/  (Strg+C beendet)"
try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.Wait(250)) { }
    $ctx = $task.Result
    try {
      if ($env:THINGS_LOG) { Write-Host "$($ctx.Request.HttpMethod) $($ctx.Request.Url.AbsolutePath)" }
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '' -or $rel.EndsWith('/')) { $rel += 'index.html' }
      $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if ($full.StartsWith($root) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($full)
        $ext = [IO.Path]::GetExtension($full).ToLower()
        $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' })
        $ctx.Response.Headers['Cache-Control'] = 'no-cache'
        $ctx.Response.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else {
        $ctx.Response.StatusCode = 404
      }
    } catch {
      Write-Host "Fehler bei $($ctx.Request.Url): $_"
    } finally {
      try { $ctx.Response.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
}
