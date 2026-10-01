$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.runtime/server.json'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'No recorded server process.'; exit 0 }
$record = Get-Content -LiteralPath $pidFile -Raw -Encoding UTF8 | ConvertFrom-Json
$process = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
if (-not $process) { Write-Host 'Server is already stopped.'; exit 0 }
$command = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)"
$recordStart = [datetime]$record.startedAt
if ($process.ProcessName -ne 'node' -or -not $command.CommandLine.Contains($record.serverPath) -or $process.StartTime.ToUniversalTime().Ticks -ne $recordStart.ToUniversalTime().Ticks) {
  throw 'Process identity changed. Refusing to stop a different process.'
}
Stop-Process -Id $record.pid
Write-Host 'Server stopped. Experiment records are preserved.'
