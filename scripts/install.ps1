param(
  [string]$ProjectRoot,
  [switch]$Personal,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if ($Personal) {
  $skillsBase = if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path $env:USERPROFILE '.codex/skills' }
} else {
  if (-not $ProjectRoot -or -not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw 'Provide an existing project directory with -ProjectRoot.' }
  $resolvedProject = (Resolve-Path -LiteralPath $ProjectRoot).Path
  $skillsBase = Join-Path $resolvedProject '.agents/skills'
}
$destination = Join-Path $skillsBase 'software-copyright-materials'
if ((Test-Path -LiteralPath $destination) -and -not $Force) { throw 'Existing skill preserved. Review it before passing -Force.' }
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$source = Join-Path $repositoryRoot '.agents/skills/software-copyright-materials'
Get-ChildItem -LiteralPath $source -Force | Where-Object { $_.Name -ne '__pycache__' } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
}
$exampleSource = Join-Path $repositoryRoot 'examples/balance-lab'
$exampleDestination = Join-Path $destination 'assets/complete-example'
New-Item -ItemType Directory -Force -Path $exampleDestination | Out-Null
$skip = @('node_modules','build','qa','.runtime','dist','__pycache__')
Get-ChildItem -LiteralPath $exampleSource -Recurse -File -Force | ForEach-Object {
  $relative = $_.FullName.Substring($exampleSource.Length).TrimStart('\','/')
  $parts = $relative -split '[\/]'
  if (@($parts | Where-Object { $_ -in $skip }).Count -eq 0) {
    $target = Join-Path $exampleDestination $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $destination 'SKILL.md'))) { throw 'Installation incomplete.' }
Write-Host ('Installed skill: ' + $destination)
