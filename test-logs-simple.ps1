# Teste da Aba LOGS - System Logs Viewer
# Este script testa as funcionalidades da aba de logs do sistema

Write-Host "=== TESTE DA ABA LOGS - SYSTEM LOGS ===" -ForegroundColor Cyan

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

# 2. Buscar logs do sistema
Write-Host "`n2. Buscando logs do sistema..." -ForegroundColor Yellow
try {
    $logs = Invoke-RestMethod -Uri "$baseUrl/api/system/logs" -Method GET -WebSession $session
    Write-Host "Logs carregados com sucesso" -ForegroundColor Green
    Write-Host "Total de logs: $($logs.data.Count)" -ForegroundColor Cyan
    Write-Host "Total geral: $($logs.total)" -ForegroundColor Cyan
    
    if ($logs.data.Count -gt 0) {
        Write-Host "Logs recentes:" -ForegroundColor Cyan
        foreach ($logEntry in $logs.data | Select-Object -First 3) {
            Write-Host "  - $($logEntry.timestamp) | Level: $($logEntry.level) | Message: $($logEntry.message)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "Erro ao buscar logs: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Testar filtro por nivel
Write-Host "`n3. Testando filtro por nivel (info)..." -ForegroundColor Yellow
try {
    $logsInfo = Invoke-RestMethod -Uri "$baseUrl/api/system/logs?level=info" -Method GET -WebSession $session
    Write-Host "Filtro por nivel funcionando" -ForegroundColor Green
    Write-Host "Logs de nivel info: $($logsInfo.data.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "Erro ao filtrar por nivel: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Testar filtro por categoria
Write-Host "`n4. Testando filtro por categoria (auth)..." -ForegroundColor Yellow
try {
    $logsAuth = Invoke-RestMethod -Uri "$baseUrl/api/system/logs?category=auth" -Method GET -WebSession $session
    Write-Host "Filtro por categoria funcionando" -ForegroundColor Green
    Write-Host "Logs de categoria auth: $($logsAuth.data.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "Erro ao filtrar por categoria: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Testar busca por texto
Write-Host "`n5. Testando busca por texto (login)..." -ForegroundColor Yellow
try {
    $logsSearch = Invoke-RestMethod -Uri "$baseUrl/api/system/logs?search=login" -Method GET -WebSession $session
    Write-Host "Busca por texto funcionando" -ForegroundColor Green
    Write-Host "Logs com 'login': $($logsSearch.data.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "Erro na busca por texto: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Testar paginacao
Write-Host "`n6. Testando paginacao..." -ForegroundColor Yellow
try {
    $uri = "$baseUrl/api/system/logs" + "?page=2" + "&" + "limit=10"
    $logsPage2 = Invoke-RestMethod -Uri $uri -Method GET -WebSession $session
    Write-Host "Paginacao funcionando" -ForegroundColor Green
    Write-Host "Logs na pagina 2: $($logsPage2.data.Count)" -ForegroundColor Cyan
    Write-Host "Pagina atual: $($logsPage2.page)" -ForegroundColor Cyan
} catch {
    Write-Host "Erro na paginacao: $($_.Exception.Message)" -ForegroundColor Red
}

# 7. Testar limite personalizado
Write-Host "`n7. Testando limite personalizado..." -ForegroundColor Yellow
try {
    $logsLimit = Invoke-RestMethod -Uri "$baseUrl/api/system/logs?limit=5" -Method GET -WebSession $session
    Write-Host "Limite personalizado funcionando" -ForegroundColor Green
    Write-Host "Logs retornados: $($logsLimit.data.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "Erro no limite personalizado: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TESTE DA ABA LOGS CONCLUIDO ===" -ForegroundColor Cyan