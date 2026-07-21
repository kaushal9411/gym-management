#requires -version 5.1
<#
  Frees the app ports (api=4000, tenant-web=3001, super-admin=3002), then
  opens each dev server in its own Windows Terminal tab.
#>

$repoRoot = Split-Path -Parent $PSScriptRoot
$ports = 3001, 3002, 4000

foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }
    foreach ($conn in $conns) {
        Write-Host "Killing PID $($conn.OwningProcess) on port $port"
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

$apps = @(
    @{ Title = "api";         Filter = "@gym-saas/api" },
    @{ Title = "tenant-web";  Filter = "@gym-saas/tenant-web" },
    @{ Title = "super-admin"; Filter = "@gym-saas/super-admin" }
)

$wtArgs = @()
foreach ($app in $apps) {
    if ($wtArgs.Count -gt 0) { $wtArgs += ";" }
    $wtArgs += @(
        "new-tab", "--title", $app.Title,
        "-d", $repoRoot,
        "powershell", "-NoExit", "-Command",
        "pnpm --filter $($app.Filter) dev"
    )
}

Start-Process wt -ArgumentList $wtArgs
