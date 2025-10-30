# Teste da Aba EMAIL - Templates de Email
# Este script testa todas as funcionalidades da aba de email

Write-Host "=== TESTE DA ABA EMAIL - TEMPLATES ===" -ForegroundColor Cyan

# Configurações
$baseUrl = "http://localhost:5501"
$session = $null
$testTemplateId = $null

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

# 2. Listar templates existentes
Write-Host "`n2. Listando templates existentes..." -ForegroundColor Yellow
try {
    $templates = Invoke-RestMethod -Uri "$baseUrl/api/email/templates" -Method GET -WebSession $session
    Write-Host "✅ Templates carregados com sucesso" -ForegroundColor Green
    Write-Host "Total de templates: $($templates.Count)" -ForegroundColor Cyan
    
    if ($templates.Count -gt 0) {
        Write-Host "Templates existentes:" -ForegroundColor Cyan
        foreach ($template in $templates) {
            Write-Host "  - $($template.name) (ID: $($template.id))" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Erro ao listar templates: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Criar novo template
Write-Host "`n3. Criando novo template de teste..." -ForegroundColor Yellow
try {
    $newTemplate = @{
        name = "Template de Teste PowerShell"
        subject = "Teste de Template - {{company}}"
        body = "Olá {{contact}}, este é um template de teste para a empresa {{company}}. Valor: {{finalValue}}"
        trigger = "test_trigger"
        active = $true
    } | ConvertTo-Json

    $createdTemplate = Invoke-RestMethod -Uri "$baseUrl/api/email/templates" -Method POST -Body $newTemplate -ContentType "application/json" -WebSession $session
    $testTemplateId = $createdTemplate.id
    Write-Host "✅ Template criado com sucesso" -ForegroundColor Green
    Write-Host "ID: $($createdTemplate.id)" -ForegroundColor Cyan
    Write-Host "Nome: $($createdTemplate.name)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao criar template: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Atualizar template
Write-Host "`n4. Atualizando template..." -ForegroundColor Yellow
if ($testTemplateId) {
    try {
        $updateTemplate = @{
            name = "Template de Teste PowerShell - ATUALIZADO"
            subject = "Teste ATUALIZADO - {{company}}"
            body = "Olá {{contact}}, este template foi ATUALIZADO para a empresa {{company}}. Novo valor: {{finalValue}}"
            trigger = "test_trigger_updated"
            active = $true
        } | ConvertTo-Json

        $updatedTemplate = Invoke-RestMethod -Uri "$baseUrl/api/email/templates/$testTemplateId" -Method PUT -Body $updateTemplate -ContentType "application/json" -WebSession $session
        Write-Host "✅ Template atualizado com sucesso" -ForegroundColor Green
        Write-Host "Nome: $($updatedTemplate.name)" -ForegroundColor Cyan
        Write-Host "Subject: $($updatedTemplate.subject)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Erro ao atualizar template: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Pulando atualização - template não foi criado" -ForegroundColor Yellow
}

# 5. Listar templates novamente para verificar
Write-Host "`n5. Verificando lista atualizada..." -ForegroundColor Yellow
try {
    $templatesUpdated = Invoke-RestMethod -Uri "$baseUrl/api/email/templates" -Method GET -WebSession $session
    Write-Host "✅ Lista atualizada carregada" -ForegroundColor Green
    Write-Host "Total de templates: $($templatesUpdated.Count)" -ForegroundColor Cyan
    
    $testTemplate = $templatesUpdated | Where-Object { $_.id -eq $testTemplateId }
    if ($testTemplate) {
        Write-Host "Template de teste encontrado:" -ForegroundColor Cyan
        Write-Host "  Nome: $($testTemplate.name)" -ForegroundColor Gray
        Write-Host "  Subject: $($testTemplate.subject)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erro ao verificar lista: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Deletar template de teste
Write-Host "`n6. Removendo template de teste..." -ForegroundColor Yellow
if ($testTemplateId) {
    try {
        $deleteResponse = Invoke-RestMethod -Uri "$baseUrl/api/email/templates/$testTemplateId" -Method DELETE -WebSession $session
        Write-Host "✅ Template removido com sucesso" -ForegroundColor Green
        Write-Host "Mensagem: $($deleteResponse.message)" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Erro ao remover template: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Pulando remoção - template não foi criado" -ForegroundColor Yellow
}

# 7. Verificar remoção
Write-Host "`n7. Verificando remoção..." -ForegroundColor Yellow
try {
    $finalTemplates = Invoke-RestMethod -Uri "$baseUrl/api/email/templates" -Method GET -WebSession $session
    Write-Host "✅ Lista final carregada" -ForegroundColor Green
    Write-Host "Total de templates: $($finalTemplates.Count)" -ForegroundColor Cyan
    
    $testTemplateExists = $finalTemplates | Where-Object { $_.id -eq $testTemplateId }
    if (-not $testTemplateExists) {
        Write-Host "✅ Template de teste removido com sucesso" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Template de teste ainda existe" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erro ao verificar remoção: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTE DA ABA EMAIL CONCLUÍDO ===" -ForegroundColor Cyan