# Script para debug de templates
$baseUrl = "http://localhost:5501"

# Login
$loginData = @{
    email = "admin@crm.com"
    password = "admin123"
} | ConvertTo-Json

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session

Write-Host "Login realizado com sucesso" -ForegroundColor Green

# Criar template
$templateData = @{
    name = "Debug Template"
    subject = "Debug Subject"
    body = "Debug body content"
    trigger = "opportunity_created"
} | ConvertTo-Json

Write-Host "`nCriando template..." -ForegroundColor Yellow
$createResponse = Invoke-RestMethod -Uri "$baseUrl/api/email/templates" -Method POST -Headers @{"Content-Type"="application/json"} -Body $templateData -WebSession $session
Write-Host "Template criado: $($createResponse.id)" -ForegroundColor Green

# Listar templates
Write-Host "`nListando templates..." -ForegroundColor Yellow
$templates = Invoke-RestMethod -Uri "$baseUrl/api/email/templates" -Method GET -WebSession $session
Write-Host "Total de templates: $($templates.Count)" -ForegroundColor Cyan

foreach ($template in $templates) {
    Write-Host "- ID: $($template.id), Nome: $($template.name)" -ForegroundColor White
}

# Buscar o template criado
$debugTemplate = $templates | Where-Object { $_.name -eq "Debug Template" } | Select-Object -First 1
if ($debugTemplate) {
    Write-Host "`nTemplate encontrado: $($debugTemplate.id)" -ForegroundColor Green
    
    # Tentar atualizar
    $updateData = @{
        name = "Debug Template Updated"
        subject = "Updated Subject"
        body = "Updated body content"
    } | ConvertTo-Json
    
    Write-Host "`nAtualizando template..." -ForegroundColor Yellow
    try {
        $updateResponse = Invoke-RestMethod -Uri "$baseUrl/api/email/templates/$($debugTemplate.id)" -Method PUT -Headers @{"Content-Type"="application/json"} -Body $updateData -WebSession $session
        Write-Host "Template atualizado com sucesso!" -ForegroundColor Green
        
        # Deletar template
        Write-Host "`nDeletando template..." -ForegroundColor Yellow
        Invoke-RestMethod -Uri "$baseUrl/api/email/templates/$($debugTemplate.id)" -Method DELETE -WebSession $session
        Write-Host "Template deletado com sucesso!" -ForegroundColor Green
        
    } catch {
        Write-Host "Erro ao atualizar template: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
    }
} else {
    Write-Host "`nTemplate não encontrado na lista!" -ForegroundColor Red
}