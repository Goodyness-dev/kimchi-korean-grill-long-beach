Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  RESTAURANT ORDERING PLATFORM (PROD SPEC v1.0)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Seeding database..." -ForegroundColor Yellow
node server/seed.js

Write-Host "Starting API Server on port 5050..." -ForegroundColor Yellow
$serverJob = Start-Process node -ArgumentList "server/api.js" -PassThru

Write-Host "Starting Outbox & Expiry Worker..." -ForegroundColor Yellow
$workerJob = Start-Process node -ArgumentList "server/worker.js" -PassThru

Write-Host "Starting Vite Storefront on port 3000..." -ForegroundColor Yellow
Write-Host "Opening http://localhost:3000" -ForegroundColor Green
npm run dev

Stop-Process -Id $serverJob.Id -ErrorAction SilentlyContinue
Stop-Process -Id $workerJob.Id -ErrorAction SilentlyContinue