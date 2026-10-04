[CmdletBinding()]
param(
    [ValidateRange(5,1440)]
    [int]$IntervalMinutes = 10,
    [string]$TaskName = 'PulseVeto-GitHub-Sync'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$syncScript = Join-Path $PSScriptRoot 'github-auto-sync.ps1'
if (-not (Test-Path -LiteralPath $syncScript)) { throw 'github-auto-sync.ps1 was not found.' }

$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$syncScript`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Safely tests, commits and pushes PulseVeto source changes to GitHub.' -Force | Out-Null
Write-Host "Scheduled task '$TaskName' installed. It runs every $IntervalMinutes minutes." -ForegroundColor Green
