$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Node.js is missing. Install Node.js 22.18+ or 24 LTS, then retry.' }
$nodeVersion = [version]((& $nodeCommand.Source --version).TrimStart('v'))
if ($nodeVersion -lt [version]'22.18.0') { throw 'Node.js 22.18 or newer is required.' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/index.html'))) { throw 'Missing dist/index.html. Run npm ci and npm run build first.' }
$port = 3187
if ($env:PORT) { $port = [int]$env:PORT }
if ($port -lt 1024 -or $port -gt 65535) { throw 'PORT must be 1024..65535.' }
$url = "http://127.0.0.1:$port"
$runtimeDir = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$probe = New-Object System.Net.Sockets.TcpClient
try { $probe.Connect('127.0.0.1', $port); $occupied = $true } catch { $occupied = $false } finally { $probe.Dispose() }
if ($occupied) { throw "Port $port is already in use. Open $url if this system is running, or stop the occupying process. No process was stopped." }
$serverPath = Join-Path $projectRoot 'server/index.ts'
$process = Start-Process -FilePath $nodeCommand.Source -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.log') -RedirectStandardError (Join-Path $runtimeDir 'server-error.log') -PassThru
@{ pid = $process.Id; serverPath = $serverPath; startedAt = $process.StartTime.ToUniversalTime().ToString('o'); port = $port } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir 'server.json') -Encoding UTF8
$ready = $false
for ($attempt=0; $attempt -lt 40; $attempt++) {
  Start-Sleep -Milliseconds 250
  try { $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 1; if ($health.status -eq 'ok') { $ready = $true; break } } catch {}
  if ($process.HasExited) { break }
}
if (-not $ready) { throw "Startup failed. Read .runtime/server-error.log. PID: $($process.Id)" }
Write-Host "Running: $url"
if ($env:BALANCE_NO_BROWSER -ne '1') { Start-Process $url }
