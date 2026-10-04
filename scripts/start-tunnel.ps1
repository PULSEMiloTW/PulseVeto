$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
$Host.UI.RawUI.WindowTitle = 'Pulse Studio - Cloudflare Tunnel Log'
Write-Host 'Starting Cloudflare Tunnel: veto.pulse-studio.live' -ForegroundColor Cyan
Write-Host 'Close this window or press Ctrl+C to stop the tunnel.' -ForegroundColor DarkGray
& (Join-Path $PSScriptRoot '..\tools\cloudflared.exe') tunnel --config (Join-Path $PSScriptRoot '..\cloudflared\config.yml') run
