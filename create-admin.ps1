# Script para criar usuário admin
$baseUrl = "http://localhost:5501"

# Dados do usuário admin
$adminData = @{
    email = "admin@admin.com"
    password = "Admin123!"
    name = "Administrador"
    role = "admin"
} | ConvertTo-Json

Write-Host "Criando usuário admin..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/auth/register" -Method POST -Body $adminData -ContentType "application/json"
    Write-Host "✓ Usuário admin criado com sucesso!" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "✓ Usuário admin já existe" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Erro ao criar usuário admin: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Testar login
Write-Host "`nTestando login..." -ForegroundColor Yellow
$loginData = @{
    email = "admin@admin.com"
    password = "Admin123!"
} | ConvertTo-Json

try {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session
    Write-Host "✓ Login realizado com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "✗ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
}