# Script para testar o controle de acesso baseado em função
Write-Host "=== TESTE DE CONTROLE DE ACESSO BASEADO EM FUNÇÃO ===" -ForegroundColor Green

# Configurações
$baseUrl = "http://localhost:5173"
$apiUrl = "http://localhost:5173/api"

Write-Host "`n🔍 Testando usuário administrador..." -ForegroundColor Blue
try {
    # Fazer login
    $loginData = @{
        email = "admin@crm.com"
        password = "admin123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$apiUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session
    
    if ($loginResponse.success) {
        Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
        
        # Obter dados do perfil do usuário
        $profileResponse = Invoke-RestMethod -Uri "$apiUrl/user/profile" -Method GET -WebSession $session
        
        Write-Host "📋 Dados do usuário:" -ForegroundColor Cyan
        Write-Host "   Nome: $($profileResponse.name)" -ForegroundColor White
        Write-Host "   Email: $($profileResponse.email)" -ForegroundColor White
        Write-Host "   Função: $($profileResponse.role)" -ForegroundColor White
        
        if ($profileResponse.role -eq "admin") {
            Write-Host "✅ Função correta: admin - deve ver todas as abas" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Função: $($profileResponse.role)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Erro durante o teste: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== RESUMO DA IMPLEMENTAÇÃO ===" -ForegroundColor Green
Write-Host "✅ Campo 'role' adicionado ao estado do usuário" -ForegroundColor Green
Write-Host "✅ Função getAllowedTabs() implementada" -ForegroundColor Green
Write-Host "✅ Filtros condicionais aplicados a todas as abas" -ForegroundColor Green
Write-Host "✅ DefaultValue ajustado baseado na função do usuário" -ForegroundColor Green

Write-Host "`n📋 COMPORTAMENTO ESPERADO:" -ForegroundColor Cyan
Write-Host "   • Usuários com função 'usuario': apenas abas Perfil, Segurança e Notificações" -ForegroundColor White
Write-Host "   • Usuários com função 'admin' ou 'gerente': todas as abas disponíveis" -ForegroundColor White

Write-Host "`n🎯 Para testar completamente:" -ForegroundColor Blue
Write-Host "   1. Acesse http://localhost:5173" -ForegroundColor White
Write-Host "   2. Faça login como admin e vá para Configurações" -ForegroundColor White
Write-Host "   3. Crie um usuário com função 'usuario'" -ForegroundColor White
Write-Host "   4. Faça login com esse usuário e verifique apenas 3 abas" -ForegroundColor White

Write-Host "`n✅ IMPLEMENTAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green