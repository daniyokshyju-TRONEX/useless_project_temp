param([int]$Port = 5500)

function Get-FreePort {
  $usedPorts = Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' } | Select-Object -ExpandProperty LocalPort
  for ($candidate = $Port; $candidate -lt $Port + 200; $candidate++) {
    if ($usedPorts -notcontains $candidate) {
      return $candidate
    }
  }

  for ($candidate = 1024; $candidate -lt 65535; $candidate++) {
    if ($usedPorts -notcontains $candidate) {
      return $candidate
    }
  }

  throw "No free local port available."
}

$root = (Resolve-Path $PSScriptRoot).Path
$actualPort = Get-FreePort
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$actualPort/")
try {
  $listener.Start()
} catch {
  $actualPort = Get-FreePort
  $listener.Prefixes.Clear()
  $listener.Prefixes.Add("http://localhost:$actualPort/")
  $listener.Start()
}

Write-Host "UNPREDICTABLE is running at http://localhost:$actualPort/index.html"
Start-Process "http://localhost:$actualPort/index.html"

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'
  '.gif' = 'image/gif'
  '.webp' = 'image/webp'
  '.top' = 'image/webp'
  '.mp3' = 'audio/mpeg'
  '.mpeg' = 'audio/mpeg'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = 'index.html' }
    $filePath = Join-Path $root $relativePath
    $resolved = $null
    try { $resolved = (Resolve-Path $filePath -ErrorAction Stop).Path } catch { $resolved = $null }

    if ($resolved -and $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $resolved -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($resolved)
      $extension = [System.IO.Path]::GetExtension($resolved).ToLowerInvariant()
      $context.Response.ContentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
      $context.Response.StatusCode = 200
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $context.Response.StatusCode = 404
    }
    $context.Response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
