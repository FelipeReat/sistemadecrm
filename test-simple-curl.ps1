# Teste simples com curl
Write-Host "=== TESTE CURL SIMPLES ===" -ForegroundColor Cyan

$baseUrl = "http://localhost:5501"

# 1. Login
Write-Host "`n1. Fazendo login..." -ForegroundColor Yellow
$loginResponse = curl -X POST "$baseUrl/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@crm.com","password":"admin123"}' -c cookies.txt
Write-Host "Login response: $loginResponse" -ForegroundColor Gray

# 2. Testar salvamento com dados simples
Write-Host "`n2. Testando salvamento..." -ForegroundColor Yellow

$testData = @'
{
  "companyName": "Empresa Teste",
  "companyPhone": "(11) 99999-9999",
  "companyEmail": "teste@empresa.com",
  "companyAddress": "Rua Teste, 123",
  "currency": "BRL",
  "timezone": "America/Sao_Paulo",
  "dateFormat": "DD/MM/YYYY",
  "timeFormat": "24h",
  "language": "pt-BR",
  "autoBackupEnabled": true,
  "autoBackupFrequency": "weekly",
  "autoBackupTime": "02:00",
  "maxFileSizeMb": 20,
  "allowedFileTypes": ["pdf", "doc", "docx"]
}
'@

$response = curl -X PUT "$baseUrl/api/company/settings" -H "Content-Type: application/json" -d $testData -b cookies.txt
Write-Host "Response: $response" -ForegroundColor Gray

Write-Host "`n=== TESTE CONCLUÍDO ===" -ForegroundColor Cyan