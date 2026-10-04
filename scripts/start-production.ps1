$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
$Host.UI.RawUI.WindowTitle = 'PulseVeto Server Log'
Write-Host 'Starting PulseVeto production server on port 3100.' -ForegroundColor Cyan
Write-Host 'Close this window or press Ctrl+C to stop the server.' -ForegroundColor DarkGray
node (Join-Path $PSScriptRoot '..\dist\src\server.js')
