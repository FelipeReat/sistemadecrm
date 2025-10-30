# Teste Simples da Aba EMPRESA
Write-Host "=== TESTE SIMPLES DA ABA EMPRESA ===" -ForegroundColor Cyan

$baseUrl = "http://localhost:5501"

# 1. Login
Write-Host "`n1. Fazendo login..." -ForegroundColor Yellow
$loginData = '{"email":"admin@crm.com","password":"admin123"}'
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session
    Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Carregar configurações atuais
Write-Host "`n2. Carregando configurações atuais..." -ForegroundColor Yellow
try {
    $currentSettings = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method GET -WebSession $session
    Write-Host "✅ Configurações carregadas com sucesso" -ForegroundColor Green
    Write-Host "Empresa: $($currentSettings.companyName)" -ForegroundColor Gray
    Write-Host "Email: $($currentSettings.companyEmail)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro ao carregar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. Testar salvamento de configurações válidas
Write-Host "`n3. Testando salvamento de configurações..." -ForegroundColor Yellow

$testSettings = @{
    companyName = "Empresa Teste CRM"
    companyPhone = "(11) 99999-9999"
    companyEmail = "contato@empresateste.com"
    companyAddress = "Rua Teste, 123, Centro, São Paulo, SP"
    currency = "BRL"
    timezone = "America/Sao_Paulo"
    dateFormat = "DD/MM/YYYY"
    timeFormat = "24h"
    language = "pt-BR"
    autoBackupEnabled = $true
    autoBackupFrequency = "weekly"
    autoBackupTime = "02:00"
    maxFileSizeMb = 20
    allowedFileTypes = @("pdf", "doc", "docx", "jpg", "png", "xlsx")
}

$testSettingsJson = $testSettings | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $testSettingsJson -ContentType "application/json" -WebSession $session
    Write-Host "✅ Configurações salvas com sucesso" -ForegroundColor Green
    Write-Host "Resposta: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro ao salvar configurações: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Detalhes do erro: $errorBody" -ForegroundColor Red
    }
}

# 4. Verificar se as configurações foram salvas
Write-Host "`n4. Verificando configurações salvas..." -ForegroundColor Yellow
try {
    $savedSettings = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method GET -WebSession $session
    
    if ($savedSettings.companyName -eq "Empresa Teste CRM") {
        Write-Host "✅ Nome da empresa salvo corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Nome da empresa não foi salvo. Atual: $($savedSettings.companyName)" -ForegroundColor Red
    }
    
    if ($savedSettings.companyPhone -eq "(11) 99999-9999") {
        Write-Host "✅ Telefone salvo corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Telefone não foi salvo. Atual: $($savedSettings.companyPhone)" -ForegroundColor Red
    }
    
    if ($savedSettings.companyEmail -eq "contato@empresateste.com") {
        Write-Host "✅ Email salvo corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Email não foi salvo. Atual: $($savedSettings.companyEmail)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erro ao verificar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTE SIMPLES CONCLUÍDO ===" -ForegroundColor Cyan