param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$required = @('package.json', '.env', 'scripts\start-production.ps1', 'scripts\start-tunnel.ps1', 'tools\cloudflared.exe', 'cloudflared\config.yml')
foreach ($relative in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $relative))) { throw "Missing required file: $relative" }
}
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$portLine = Get-Content -LiteralPath (Join-Path $projectRoot '.env') | Where-Object { $_ -match '^\s*PORT\s*=' } | Select-Object -Last 1
$serverPort = 3100
if ($portLine -match '^\s*PORT\s*=\s*["'']?(\d+)') { $serverPort = [int]$Matches[1] }
if ($serverPort -eq 3000) { throw 'Port 3000 is reserved for the legacy service; no processes were stopped.' }
$processes = @(Get-CimInstance Win32_Process)
if ($processes | Where-Object { $_.Name -eq 'cloudflared.exe' -and -not $_.CommandLine }) {
    throw 'Cannot inspect a running tunnel. Run start-pulseveto.cmd as administrator, or close the old tunnel manually. No processes were stopped.'
}
$byId = @{}
foreach ($process in $processes) { $byId[[int]$process.ProcessId] = $process }
function Test-ProjectProcess($process, [string]$scriptName) {
    $seen = @{}
    while ($process -and -not $seen.ContainsKey([int]$process.ProcessId)) {
        $seen[[int]$process.ProcessId] = $true
        $command = [string]$process.CommandLine
        if ($command.IndexOf((Join-Path $projectRoot "scripts\$scriptName"), [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
        $process = $byId[[int]$process.ParentProcessId]
    }
    return $false
}
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $serverPort -ErrorAction SilentlyContinue)
foreach ($listener in $listeners) {
    $process = $byId[[int]$listener.OwningProcess]
    $entry = Join-Path $projectRoot 'dist\src\server.js'
    $absoluteEntry = $process -and ([string]$process.CommandLine).Replace('/', '\').IndexOf($entry, [StringComparison]::OrdinalIgnoreCase) -ge 0
    if (-not $absoluteEntry -and -not (Test-ProjectProcess $process 'start-production.ps1')) {
        throw "Port $serverPort is occupied by an unverified process. Run start-pulseveto.cmd as administrator, or close the old server manually. No processes were stopped."
    }
}
$tunnelPath = Join-Path $projectRoot 'tools\cloudflared.exe'
$configPath = Join-Path $projectRoot 'cloudflared\config.yml'
$owned = @($processes | Where-Object {
    (Test-ProjectProcess $_ 'start-production.ps1') -or (Test-ProjectProcess $_ 'start-tunnel.ps1') -or
    ($_.ExecutablePath -eq $tunnelPath -and ([string]$_.CommandLine).IndexOf($configPath, [StringComparison]::OrdinalIgnoreCase) -ge 0)
})
$ambiguousTunnels = @($processes | Where-Object { $_.ExecutablePath -eq $tunnelPath -and $_.ProcessId -notin $owned.ProcessId })
if ($ambiguousTunnels.Count) { throw 'An unverified project tunnel is running. Close it manually, then retry. No processes were stopped.' }
if ($CheckOnly) {
    Write-Host "Preflight OK. Project: $projectRoot; port: $serverPort. No stop, migration, build, or start was performed."
    exit 0
}
# Only processes proven above to belong to this project's server/tunnel are stopped.
$stopIds = @($owned.ProcessId) + @($listeners.OwningProcess) | Sort-Object -Unique
foreach ($processId in $stopIds) {
    if ($processId -and $processId -ne $PID) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
}
foreach ($processId in $stopIds) { if ($processId -and $processId -ne $PID) { Wait-Process -Id $processId -Timeout 15 -ErrorAction SilentlyContinue } }
foreach ($command in @('prisma:generate', 'build', 'backup', 'prisma:migrate')) {
    & $npm --prefix $projectRoot run $command
    if ($LASTEXITCODE -ne 0) { throw "$command failed. The server and tunnel were not started." }
}
Start-Process powershell.exe -WindowStyle Normal -ArgumentList @('-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'start-production.ps1') + '"')) -WorkingDirectory $projectRoot
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$serverPort/" -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready = $true; break } } catch {}
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'Server did not become ready. Inspect the server window; tunnel was not started.' }
Start-Process powershell.exe -WindowStyle Normal -ArgumentList @('-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $PSScriptRoot 'start-tunnel.ps1') + '"')) -WorkingDirectory $projectRoot
Write-Host 'Server is ready. The tunnel was launched in a separate visible window; inspect its connection log.'
