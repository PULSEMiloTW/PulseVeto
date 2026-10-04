$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'C:\PulseStudioNAS\PulseStudio\PulseVeto'
$Host.UI.RawUI.WindowTitle = 'Pulse Studio - Cloudflare Authorization'
Write-Host 'Authorize Cloudflare and select the pulse-studio.live zone.' -ForegroundColor Cyan
Write-Host 'Keep this window open until authorization succeeds.' -ForegroundColor DarkGray
$defaultCertificate = 'C:\Users\alan_\.cloudflared\cert.pem'
$certificateBackup = 'C:\Users\alan_\.cloudflared\cert.pem.mapveto-login-backup'
$projectCertificate = 'C:\PulseStudioNAS\PulseStudio\PulseVeto\cloudflared\pulse-studio-cert.pem'
if (Test-Path -LiteralPath $certificateBackup) { throw 'An unrestored Cloudflare certificate backup already exists. Stopping safely.' }
if (Test-Path -LiteralPath $defaultCertificate) { Move-Item -LiteralPath $defaultCertificate -Destination $certificateBackup }
try {
  & '.\tools\cloudflared.exe' tunnel login
  if ($LASTEXITCODE -ne 0) { throw "Cloudflare authorization failed with exit code $LASTEXITCODE" }
  if (-not (Test-Path -LiteralPath $defaultCertificate)) { throw 'Cloudflare did not create a new authorization certificate.' }
  Move-Item -LiteralPath $defaultCertificate -Destination $projectCertificate -Force
  Write-Host 'The pulse-studio.live certificate is stored in this project.' -ForegroundColor Green
}
finally {
  if ((Test-Path -LiteralPath $defaultCertificate) -and -not (Test-Path -LiteralPath $projectCertificate)) { Move-Item -LiteralPath $defaultCertificate -Destination $projectCertificate -Force }
  if (Test-Path -LiteralPath $certificateBackup) { Move-Item -LiteralPath $certificateBackup -Destination $defaultCertificate }
  Write-Host 'The original Cloudflare/NAS certificate has been restored.' -ForegroundColor DarkGray
}
