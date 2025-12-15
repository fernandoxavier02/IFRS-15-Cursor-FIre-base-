# Script PowerShell para executar o agente E2E com as variáveis de ambiente

# Configuração das variáveis de ambiente
$env:E2E_BASE_URL = "https://ifrs15-revenue-manager.firebaseapp.com"
$env:E2E_EMAIL = "fernandocostaxavier@gmail.com"
$env:E2E_PASSWORD = "Fcxv020781@"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "E3E Autocrawler - IFRS 15 Revenue Manager" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URL Base: $env:E2E_BASE_URL" -ForegroundColor Green
Write-Host "Email: $env:E2E_EMAIL" -ForegroundColor Green
Write-Host ""
Write-Host "Iniciando teste E2E com browser visivel..." -ForegroundColor Yellow
Write-Host ""

# Executar Playwright
npx playwright test

# Mostrar relatório
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Teste finalizado!" -ForegroundColor Cyan
Write-Host "Para ver o relatorio HTML, execute:" -ForegroundColor Yellow
Write-Host "  npx playwright show-report" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
