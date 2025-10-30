# Teste da Aba SEGURANÇA - Alteração de Senha
# Este script testa todas as funcionalidades da aba de segurança

Write-Host "=== TESTE DA ABA SEGURANÇA - ALTERAÇÃO DE SENHA ===" -ForegroundColor Cyan

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

# 2. Testar alteração de senha com validações
Write-Host "`n2. Testando validações de alteração de senha..." -ForegroundColor Yellow

# 2.1. Teste sem senha atual
Write-Host "`n2.1. Testando sem senha atual..." -ForegroundColor Yellow
try {
    $changeData = @{
        currentPassword = ""
        newPassword = "novasenha123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/change-password" -Method PUT -Body $changeData -ContentType "application/json" -WebSession $session
    Write-Host "❌ Deveria ter falhado - senha atual vazia" -ForegroundColor Red
} catch {
    Write-Host "✅ Validação funcionando - senha atual obrigatória" -ForegroundColor Green
}

# 2.2. Teste com senha muito curta
Write-Host "`n2.2. Testando senha muito curta..." -ForegroundColor Yellow
try {
    $changeData = @{
        currentPassword = "admin123"
        newPassword = "123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/change-password" -Method PUT -Body $changeData -ContentType "application/json" -WebSession $session
    Write-Host "❌ Deveria ter falhado - senha muito curta" -ForegroundColor Red
} catch {
    Write-Host "✅ Validação funcionando - senha deve ter pelo menos 8 caracteres" -ForegroundColor Green
}

# 2.3. Teste com senha igual à atual
Write-Host "`n2.3. Testando senha igual à atual..." -ForegroundColor Yellow
try {
    $changeData = @{
        currentPassword = "admin123"
        newPassword = "admin123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/change-password" -Method PUT -Body $changeData -ContentType "application/json" -WebSession $session
    Write-Host "❌ Deveria ter falhado - senha igual à atual" -ForegroundColor Red
} catch {
    Write-Host "✅ Validação funcionando - nova senha deve ser diferente" -ForegroundColor Green
}

# 2.4. Teste com senha atual incorreta
Write-Host "`n2.4. Testando senha atual incorreta..." -ForegroundColor Yellow
try {
    $changeData = @{
        currentPassword = "senhaerrada"
        newPassword = "novasenha123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/change-password" -Method PUT -Body $changeData -ContentType "application/json" -WebSession $session
    Write-Host "❌ Deveria ter falhado - senha atual incorreta" -ForegroundColor Red
} catch {
    Write-Host "✅ Validação funcionando - senha atual incorreta" -ForegroundColor Green
}

# 3. Testar alteração de senha válida
Write-Host "`n3. Testando alteração de senha válida..." -ForegroundColor Yellow
try {
    $changeData = @{
        currentPassword = "admin123"
        newPassword = "novasenha123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/change-password" -Method PUT -Body $changeData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Senha alterada com sucesso" -ForegroundColor Green
    Write-Host "Mensagem: $($response.message)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro na alteração de senha: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorDetails = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorDetails)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Detalhes do erro: $errorBody" -ForegroundColor Red
    }
}

# 4. Testar login com nova senha
Write-Host "`n4. Testando login com nova senha..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@crm.com"
        password = "novasenha123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable newSession
    Write-Host "✅ Login com nova senha realizado com sucesso" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro no login com nova senha: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Restaurar senha original
Write-Host "`n5. Restaurando senha original..." -ForegroundColor Yellow
try {
    $changeData = @{
        currentPassword = "novasenha123"
        newPassword = "admin123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/change-password" -Method PUT -Body $changeData -ContentType "application/json" -WebSession $newSession
    Write-Host "✅ Senha original restaurada com sucesso" -ForegroundColor Green
    Write-Host "Mensagem: $($response.message)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro ao restaurar senha: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Verificar login com senha original
Write-Host "`n6. Verificando login com senha original..." -ForegroundColor Yellow
try {
    $loginData = @{
        email = "admin@crm.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    Write-Host "✅ Login com senha original confirmado" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro no login com senha original: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTE DA ABA SEGURANÇA CONCLUÍDO ===" -ForegroundColor Cyan