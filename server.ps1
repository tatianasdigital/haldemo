# Простой локальный сервер для прототипа HAL (без установки чего-либо)
# Запуск: двойной клик по start-server.bat

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.gif'  = 'image/gif'
  '.ico'  = 'image/x-icon'
  '.mp4'  = 'video/mp4'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
}

# Ищем свободный порт, начиная с 8080
$listener = $null
while (-not $listener) {
  try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$port/")
    $l.Start()
    $listener = $l
  } catch {
    $port++
    if ($port -gt 8100) { throw "Не удалось найти свободный порт (8080-8100)." }
  }
}

$url = "http://localhost:$port/"
Write-Host ""
Write-Host "  HAL prototype is running:  $url" -ForegroundColor Green
Write-Host "  Чтобы остановить сервер — закройте это окно или нажмите Ctrl+C." -ForegroundColor Gray
Write-Host ""
Start-Process $url

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))

      if ((Test-Path $file -PathType Container)) { $file = Join-Path $file 'index.html' }

      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $bytes = [IO.File]::ReadAllBytes($file)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host ("200  /" + $path)
      } else {
        $res.StatusCode = 404
        $msg = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $res.OutputStream.Write($msg, 0, $msg.Length)
        Write-Host ("404  /" + $path) -ForegroundColor Yellow
      }
    } catch {
      Write-Host $_ -ForegroundColor Red
    } finally {
      $res.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
}
