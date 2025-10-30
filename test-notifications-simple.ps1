# Teste da Aba NOTIFICAÇÕES - Configurações de Notificação
# Este script testa todas as funcionalidades da aba de notificações

Write-Host "=== TESTE DA ABA NOTIFICAÇÕES ===" -ForegroundColor Cyan

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

# 2. Buscar configurações atuais
Write-Host "`n2. Buscando configurações atuais..." -ForegroundColor Yellow
try {
    $currentSettings = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -WebSession $session
    Write-Host "✅ Configurações carregadas com sucesso" -ForegroundColor Green
    Write-Host "Email Notifications: $($currentSettings.emailNotifications)" -ForegroundColor Cyan
    Write-Host "Push Notifications: $($currentSettings.pushNotifications)" -ForegroundColor Cyan
    Write-Host "Auto Backup: $($currentSettings.autoBackup)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao buscar configurações: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Testar alteração de configurações de notificação
Write-Host "`n3. Testando alteração de configurações..." -ForegroundColor Yellow

# 3.1. Ativar todas as notificações
Write-Host "`n3.1. Ativando todas as notificações..." -ForegroundColor Yellow
try {
    $updateData = @{
        emailNotifications = $true
        notifications = $true
        autoBackup = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updateData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Notificações ativadas com sucesso" -ForegroundColor Green
    Write-Host "Email Notifications: $($response.emailNotifications)" -ForegroundColor Cyan
    Write-Host "Push Notifications: $($response.pushNotifications)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao ativar notificações: $($_.Exception.Message)" -ForegroundColor Red
}

# 3.2. Desativar notificações por email
Write-Host "`n3.2. Desativando notificações por email..." -ForegroundColor Yellow
try {
    $updateData = @{
        emailNotifications = $false
        notifications = $true
        autoBackup = $true
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updateData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Notificações por email desativadas" -ForegroundColor Green
    Write-Host "Email Notifications: $($response.emailNotifications)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao desativar notificações por email: $($_.Exception.Message)" -ForegroundColor Red
}

# 3.3. Desativar todas as notificações
Write-Host "`n3.3. Desativando todas as notificações..." -ForegroundColor Yellow
try {
    $updateData = @{
        emailNotifications = $false
        notifications = $false
        autoBackup = $false
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updateData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Todas as notificações desativadas" -ForegroundColor Green
    Write-Host "Email Notifications: $($response.emailNotifications)" -ForegroundColor Cyan
    Write-Host "Push Notifications: $($response.pushNotifications)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao desativar todas as notificações: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Restaurar configurações originais
Write-Host "`n4. Restaurando configurações originais..." -ForegroundColor Yellow
try {
    $restoreData = @{
        emailNotifications = $currentSettings.emailNotifications
        notifications = $currentSettings.pushNotifications
        autoBackup = $currentSettings.autoBackup
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $restoreData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Configurações originais restauradas" -ForegroundColor Green
    Write-Host "Email Notifications: $($response.emailNotifications)" -ForegroundColor Cyan
    Write-Host "Push Notifications: $($response.pushNotifications)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao restaurar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Verificar configurações finais
Write-Host "`n5. Verificando configurações finais..." -ForegroundColor Yellow
try {
    $finalSettings = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -WebSession $session
    Write-Host "✅ Configurações verificadas" -ForegroundColor Green
    Write-Host "Email Notifications: $($finalSettings.emailNotifications)" -ForegroundColor Cyan
    Write-Host "Push Notifications: $($finalSettings.pushNotifications)" -ForegroundColor Cyan
    Write-Host "Auto Backup: $($finalSettings.autoBackup)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao verificar configurações finais: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTE DA ABA NOTIFICAÇÕES CONCLUÍDO ===" -ForegroundColor Cyan