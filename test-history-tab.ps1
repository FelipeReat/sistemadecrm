# Teste da Aba HISTORICO - Historico de Login
# Este script testa as funcionalidades da aba de historico

Write-Host "=== TESTE DA ABA HISTORICO - LOGIN HISTORY ===" -ForegroundColor Cyan

# Configuracoes
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
    Write-Host "Login realizado com sucesso" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name)" -ForegroundColor Cyan
} catch {
    Write-Host "Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Buscar historico de login
Write-Host "`n2. Buscando historico de login..." -ForegroundColor Yellow
try {
    $history = Invoke-RestMethod -Uri "$baseUrl/api/user/login-history" -Method GET -WebSession $session
    Write-Host "Historico carregado com sucesso" -ForegroundColor Green
    Write-Host "Total de registros: $($history.records.Count)" -ForegroundColor Cyan
    Write-Host "Total geral: $($history.total)" -ForegroundColor Cyan
    
    if ($history.records.Count -gt 0) {
        Write-Host "Ultimos logins:" -ForegroundColor Cyan
        foreach ($login in $history.records | Select-Object -First 3) {
            Write-Host "  - $($login.created_at) | IP: $($login.ip_address) | Status: $($login.success)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "Erro ao buscar historico: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Testar paginacao
Write-Host "`n3. Testando paginacao..." -ForegroundColor Yellow
try {
    $uri = "$baseUrl/api/user/login-history" + "?page=2" + "&" + "limit=10"
    $historyPage2 = Invoke-RestMethod -Uri $uri -Method GET -WebSession $session
    Write-Host "Pagina 2 carregada com sucesso" -ForegroundColor Green
    Write-Host "Registros na pagina 2: $($historyPage2.records.Count)" -ForegroundColor Cyan
    Write-Host "Pagina atual: $($historyPage2.currentPage)" -ForegroundColor Cyan
    Write-Host "Total de paginas: $($historyPage2.totalPages)" -ForegroundColor Cyan
} catch {
    Write-Host "Erro ao buscar pagina 2: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Testar limite personalizado
Write-Host "`n4. Testando limite personalizado..." -ForegroundColor Yellow
try {
    $historyLimit = Invoke-RestMethod -Uri "$baseUrl/api/user/login-history?limit=5" -Method GET -WebSession $session
    Write-Host "Limite personalizado funcionando" -ForegroundColor Green
    Write-Host "Registros retornados: $($historyLimit.records.Count)" -ForegroundColor Cyan
    Write-Host "Limite aplicado: 5" -ForegroundColor Cyan
} catch {
    Write-Host "Erro ao testar limite: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Buscar sessoes ativas
Write-Host "`n5. Buscando sessoes ativas..." -ForegroundColor Yellow
try {
    $sessions = Invoke-RestMethod -Uri "$baseUrl/api/user/sessions" -Method GET -WebSession $session
    Write-Host "Sessoes ativas carregadas" -ForegroundColor Green
    Write-Host "Total de sessoes ativas: $($sessions.Count)" -ForegroundColor Cyan
    
    if ($sessions.Count -gt 0) {
        Write-Host "Sessoes ativas:" -ForegroundColor Cyan
        foreach ($sessionItem in $sessions) {
            Write-Host "  - ID: $($sessionItem.id) | Criada em: $($sessionItem.createdAt)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "Erro ao buscar sessoes: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTE DA ABA HISTORICO CONCLUIDO ===" -ForegroundColor Cyan