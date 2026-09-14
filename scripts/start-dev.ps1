#requires -version 5.1
<#
  Single entry point for local dev: brings up the Docker backing services
  (postgres/redis/mailpit), frees the app ports (api=4000, tenant-web=3001,
  super-admin=3002), then opens one Windows Terminal window with a separate
  tab per service (docker logs, api, tenant-web, super-admin).
#>

$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Starting Docker backing services (postgres/redis/mailpit)..."
Push-Location $repoRoot
docker compose up -d
Pop-Location

Write-Host "Waiting for postgres to become healthy..."
$deadline = (Get-Date).AddSeconds(60)
while ((docker inspect -f "{{.State.Health.Status}}" gym-saas-postgres 2>$null) -ne "healthy") {
    if ((Get-Date) -gt $deadline) {
        Write-Host "Timed out waiting for postgres - continuing anyway."
        break
    }
    Start-Sleep -Seconds 1
}

$ports = 3001, 3002, 4000
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }
    foreach ($conn in $conns) {
        Write-Host "Killing PID $($conn.OwningProcess) on port $port"
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

$apps = @(
    @{ Title = "docker";      Command = "docker compose logs -f" },
    @{ Title = "api";         Command = "corepack pnpm --filter @gym-saas/api dev" },
    @{ Title = "tenant-web";  Command = "corepack pnpm --filter @gym-saas/tenant-web dev" },
    @{ Title = "super-admin"; Command = "corepack pnpm --filter @gym-saas/super-admin dev" }
)

$wtArgs = @()
foreach ($app in $apps) {
    if ($wtArgs.Count -gt 0) { $wtArgs += ";" }
    $wtArgs += @(
        "new-tab", "--title", $app.Title,
        "-d", $repoRoot,
        "powershell", "-NoExit", "-Command",
        $app.Command
    )
}

Start-Process wt -ArgumentList $wtArgs
