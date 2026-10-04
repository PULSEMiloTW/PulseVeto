[CmdletBinding()]
param([string]$TaskName = 'PulseVeto-GitHub-Sync')

$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task '$TaskName' removed." -ForegroundColor Green
