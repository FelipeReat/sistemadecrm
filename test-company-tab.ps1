# Teste da Aba EMPRESA - Configurações da Empresa
Write-Host "=== TESTE DA ABA EMPRESA - CONFIGURAÇÕES DA EMPRESA ===" -ForegroundColor Cyan

# Configurações
$baseUrl = "http://localhost:5501"
$loginData = @{
    email = "admin@crm.com"
    password = "admin123"
} | ConvertTo-Json

# 1. Fazer login
Write-Host "`n1. Fazendo login..." -ForegroundColor Yellow
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session
    Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Carregar configurações atuais da empresa
Write-Host "`n2. Carregando configurações atuais da empresa..." -ForegroundColor Yellow
try {
    $currentSettings = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method GET -WebSession $session
    Write-Host "✅ Configurações carregadas com sucesso" -ForegroundColor Green
    Write-Host "Empresa atual: $($currentSettings.companyName)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro ao carregar configurações: $($_.Exception.Message)" -ForegroundColor Red
    # Criar configurações padrão se não existirem
    $currentSettings = @{
        companyName = ""
        phone = ""
        email = ""
        address = ""
        currency = "BRL"
        timezone = "America/Sao_Paulo"
        autoBackup = $true
        backupFrequency = "daily"
        allowedFileTypes = @("pdf", "doc", "docx", "jpg", "png")
        maxFileSize = 10485760
    }
}

# 3. Testar validações de campos obrigatórios
Write-Host "`n3. Testando validações..." -ForegroundColor Yellow

# 3.1. Testar com nome da empresa vazio
Write-Host "`n3.1. Testando com nome da empresa vazio..." -ForegroundColor Cyan
$invalidData = $currentSettings.PSObject.Copy()
$invalidData.companyName = ""
$invalidDataJson = $invalidData | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $invalidDataJson -ContentType "application/json" -WebSession $session
    Write-Host "⚠️ Deveria ter falhado com nome vazio, mas passou" -ForegroundColor Yellow
} catch {
    Write-Host "✅ Validação funcionando - nome da empresa obrigatório" -ForegroundColor Green
}

# 3.2. Testar com email inválido
Write-Host "`n3.2. Testando com email inválido..." -ForegroundColor Cyan
$invalidData = $currentSettings.PSObject.Copy()
$invalidData.email = "email-invalido"
$invalidDataJson = $invalidData | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $invalidDataJson -ContentType "application/json" -WebSession $session
    Write-Host "⚠️ Deveria ter falhado com email inválido, mas passou" -ForegroundColor Yellow
} catch {
    Write-Host "✅ Validação funcionando - email deve ser válido" -ForegroundColor Green
}

# 4. Testar salvamento de configurações válidas
Write-Host "`n4. Testando salvamento de configurações válidas..." -ForegroundColor Yellow

$testSettings = @{
    companyName = "Empresa Teste CRM"
    phone = "(11) 99999-9999"
    email = "contato@empresateste.com"
    address = "Rua Teste, 123, Centro, São Paulo, SP"
    currency = "BRL"
    timezone = "America/Sao_Paulo"
    autoBackup = $true
    backupFrequency = "weekly"
    allowedFileTypes = @("pdf", "doc", "docx", "jpg", "png", "xlsx")
    maxFileSize = 20971520  # 20MB
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $testSettings -ContentType "application/json" -WebSession $session
    Write-Host "✅ Configurações salvas com sucesso" -ForegroundColor Green
    Write-Host "Mensagem: $($response.message)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Erro ao salvar configurações: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Verificar se as configurações foram salvas corretamente
Write-Host "`n5. Verificando se as configurações foram salvas..." -ForegroundColor Yellow
try {
    $savedSettings = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method GET -WebSession $session
    
    if ($savedSettings.companyName -eq "Empresa Teste CRM") {
        Write-Host "✅ Nome da empresa salvo corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Nome da empresa não foi salvo corretamente" -ForegroundColor Red
    }
    
    if ($savedSettings.phone -eq "(11) 99999-9999") {
        Write-Host "✅ Telefone salvo corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Telefone não foi salvo corretamente" -ForegroundColor Red
    }
    
    if ($savedSettings.email -eq "contato@empresateste.com") {
        Write-Host "✅ Email salvo corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Email não foi salvo corretamente" -ForegroundColor Red
    }
    
    if ($savedSettings.currency -eq "BRL") {
        Write-Host "✅ Moeda salva corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Moeda não foi salva corretamente" -ForegroundColor Red
    }
    
    if ($savedSettings.backupFrequency -eq "weekly") {
        Write-Host "✅ Frequência de backup salva corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Frequência de backup não foi salva corretamente" -ForegroundColor Red
    }
    
    if ($savedSettings.maxFileSize -eq 20971520) {
        Write-Host "✅ Tamanho máximo de arquivo salvo corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Tamanho máximo de arquivo não foi salvo corretamente" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erro ao verificar configurações salvas: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Testar diferentes moedas
Write-Host "`n6. Testando diferentes moedas..." -ForegroundColor Yellow
$currencies = @("USD", "EUR", "GBP")

foreach ($currency in $currencies) {
    $currencyTest = $savedSettings.PSObject.Copy()
    $currencyTest.currency = $currency
    $currencyTestJson = $currencyTest | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $currencyTestJson -ContentType "application/json" -WebSession $session
        Write-Host "✅ Moeda $currency salva com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao salvar moeda $currency" -ForegroundColor Red
    }
}

# 7. Testar diferentes fusos horários
Write-Host "`n7. Testando diferentes fusos horários..." -ForegroundColor Yellow
$timezones = @("America/New_York", "Europe/London", "Asia/Tokyo")

foreach ($timezone in $timezones) {
    $timezoneTest = $savedSettings.PSObject.Copy()
    $timezoneTest.timezone = $timezone
    $timezoneTestJson = $timezoneTest | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $timezoneTestJson -ContentType "application/json" -WebSession $session
        Write-Host "✅ Fuso horário $timezone salvo com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao salvar fuso horário $timezone" -ForegroundColor Red
    }
}

# 8. Testar configurações de backup
Write-Host "`n8. Testando configurações de backup..." -ForegroundColor Yellow

# 8.1. Desativar backup automático
$backupTest = $savedSettings.PSObject.Copy()
$backupTest.autoBackup = $false
$backupTestJson = $backupTest | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $backupTestJson -ContentType "application/json" -WebSession $session
    Write-Host "✅ Backup automático desativado com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao desativar backup automático" -ForegroundColor Red
}

# 8.2. Testar diferentes frequências de backup
$frequencies = @("daily", "monthly")
foreach ($frequency in $frequencies) {
    $freqTest = $savedSettings.PSObject.Copy()
    $freqTest.autoBackup = $true
    $freqTest.backupFrequency = $frequency
    $freqTestJson = $freqTest | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $freqTestJson -ContentType "application/json" -WebSession $session
        Write-Host "✅ Frequência de backup $frequency salva com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao salvar frequência $frequency" -ForegroundColor Red
    }
}

# 9. Testar tipos de arquivo permitidos
Write-Host "`n9. Testando tipos de arquivo permitidos..." -ForegroundColor Yellow

# 9.1. Testar com todos os tipos
$allFileTypes = @("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "gif", "bmp", "svg", "txt", "csv", "zip", "rar")
$fileTypeTest = $savedSettings.PSObject.Copy()
$fileTypeTest.allowedFileTypes = $allFileTypes
$fileTypeTestJson = $fileTypeTest | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $fileTypeTestJson -ContentType "application/json" -WebSession $session
    Write-Host "✅ Todos os tipos de arquivo salvos com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao salvar todos os tipos de arquivo" -ForegroundColor Red
}

# 9.2. Testar com apenas alguns tipos
$limitedFileTypes = @("pdf", "jpg", "png")
$fileTypeTest.allowedFileTypes = $limitedFileTypes
$fileTypeTestJson = $fileTypeTest | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $fileTypeTestJson -ContentType "application/json" -WebSession $session
    Write-Host "✅ Tipos de arquivo limitados salvos com sucesso" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao salvar tipos de arquivo limitados" -ForegroundColor Red
}

# 10. Testar diferentes tamanhos máximos de arquivo
Write-Host "`n10. Testando diferentes tamanhos máximos de arquivo..." -ForegroundColor Yellow
$fileSizes = @(5242880, 52428800, 104857600)  # 5MB, 50MB, 100MB

foreach ($fileSize in $fileSizes) {
    $sizeTest = $savedSettings.PSObject.Copy()
    $sizeTest.maxFileSize = $fileSize
    $sizeTestJson = $sizeTest | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $sizeTestJson -ContentType "application/json" -WebSession $session
        $sizeMB = [math]::Round($fileSize / 1024 / 1024, 0)
        Write-Host "✅ Tamanho máximo ${sizeMB}MB salvo com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao salvar tamanho máximo de arquivo" -ForegroundColor Red
    }
}

# 11. Restaurar configurações originais
Write-Host "`n11. Restaurando configurações originais..." -ForegroundColor Yellow
if ($currentSettings) {
    $originalJson = $currentSettings | ConvertTo-Json
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/company/settings" -Method PUT -Body $originalJson -ContentType "application/json" -WebSession $session
        Write-Host "✅ Configurações originais restauradas com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao restaurar configurações originais: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== TESTE DA ABA EMPRESA CONCLUÍDO ===" -ForegroundColor Cyan