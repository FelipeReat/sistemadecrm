# Teste da Aba SISTEMA - Configurações do Sistema
# Este script testa as funcionalidades da aba de sistema

Write-Host "=== TESTE DA ABA SISTEMA ===" -ForegroundColor Cyan

# Configurações
$baseUrl = "http://localhost:5501"
$session = $null

# 1. Fazer login
Write-Host "`n1. Fazendo login..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@crm.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session
    Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Buscar configurações atuais do sistema
Write-Host "`n2. Buscando configurações do sistema..." -ForegroundColor Yellow
try {
    $currentSettings = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -WebSession $session
    Write-Host "✅ Configurações do sistema carregadas" -ForegroundColor Green
    Write-Host "Language: $($currentSettings.language)" -ForegroundColor Cyan
    Write-Host "Timezone: $($currentSettings.timezone)" -ForegroundColor Cyan
    Write-Host "Session Timeout: $($currentSettings.sessionTimeout)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao buscar configurações: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Testar alteração de configurações do sistema
Write-Host "`n3. Testando alteração de configurações do sistema..." -ForegroundColor Yellow

# 3.1. Alterar idioma e timezone
Write-Host "`n3.1. Alterando idioma e timezone..." -ForegroundColor Yellow
try {
    $updateData = @{
        language = "en-US"
        timezone = "America/New_York"
        sessionTimeout = 60
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updateData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Configurações alteradas com sucesso" -ForegroundColor Green
    Write-Host "Language: $($response.language)" -ForegroundColor Cyan
    Write-Host "Timezone: $($response.timezone)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao alterar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

# 3.2. Testar timeout de sessão
Write-Host "`n3.2. Testando timeout de sessão..." -ForegroundColor Yellow
try {
    $updateData = @{
        sessionTimeout = 30
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updateData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Timeout de sessão alterado" -ForegroundColor Green
    Write-Host "Session Timeout: $($response.sessionTimeout) minutos" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao alterar timeout: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Restaurar configurações originais
Write-Host "`n4. Restaurando configurações originais..." -ForegroundColor Yellow
try {
    $restoreData = @{
        language = $currentSettings.language
        timezone = $currentSettings.timezone
        sessionTimeout = $currentSettings.sessionTimeout
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $restoreData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Configurações originais restauradas" -ForegroundColor Green
    Write-Host "Language: $($response.language)" -ForegroundColor Cyan
    Write-Host "Timezone: $($response.timezone)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao restaurar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Verificar configurações finais
Write-Host "`n5. Verificando configurações finais..." -ForegroundColor Yellow
try {
    $finalSettings = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -WebSession $session
    Write-Host "✅ Configurações verificadas" -ForegroundColor Green
    Write-Host "Language: $($finalSettings.language)" -ForegroundColor Cyan
    Write-Host "Timezone: $($finalSettings.timezone)" -ForegroundColor Cyan
    Write-Host "Session Timeout: $($finalSettings.sessionTimeout)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao verificar configurações finais: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTE DA ABA SISTEMA CONCLUÍDO ===" -ForegroundColor Cyan