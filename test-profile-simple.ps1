# Teste da funcionalidade de upload de foto de perfil
Write-Host "=== TESTE SIMPLES DA ABA PERFIL ===" -ForegroundColor Green

# Primeiro, fazer login
$loginData = @{
    email = "admin@crm.com"
    password = "admin123"
} | ConvertTo-Json

Write-Host "1. Fazendo login..." -ForegroundColor Yellow
try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5501/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session
    Write-Host "✅ Login realizado com sucesso" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro no login: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Testar endpoint de perfil do usuário
Write-Host "`n2. Testando endpoint de perfil..." -ForegroundColor Yellow
try {
    $profileResponse = Invoke-RestMethod -Uri "http://localhost:5501/api/user/profile" -Method GET -WebSession $session
    Write-Host "✅ Perfil carregado com sucesso" -ForegroundColor Green
    Write-Host "Nome: $($profileResponse.name)" -ForegroundColor Cyan
    Write-Host "Email: $($profileResponse.email)" -ForegroundColor Cyan
    if ($profileResponse.profilePhoto) {
        Write-Host "Foto atual: $($profileResponse.profilePhoto)" -ForegroundColor Cyan
    } else {
        Write-Host "Foto atual: Não definida" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Erro ao carregar perfil: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorDetails = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorDetails)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Detalhes do erro: $errorBody" -ForegroundColor Red
    }
}

# Criar um arquivo PNG de teste (base64 de uma imagem 1x1 pixel)
$testImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
$testImageBytes = [Convert]::FromBase64String($testImageBase64)

$testImagePath = "test-profile-photo.png"
[System.IO.File]::WriteAllBytes($testImagePath, $testImageBytes)

Write-Host "`n3. Testando upload de foto de perfil..." -ForegroundColor Yellow
try {
    # Usar Add-Type para criar multipart form data
    Add-Type -AssemblyName System.Net.Http
    
    $httpClientHandler = New-Object System.Net.Http.HttpClientHandler
    $cookieContainer = New-Object System.Net.CookieContainer
    
    # Adicionar cookies da sessão
    foreach ($cookie in $session.Cookies) {
        $cookieContainer.Add($cookie)
    }
    
    $httpClientHandler.CookieContainer = $cookieContainer
    $client = New-Object System.Net.Http.HttpClient($httpClientHandler)
    
    $multipartContent = New-Object System.Net.Http.MultipartFormDataContent
    $fileContent = New-Object System.Net.Http.ByteArrayContent($testImageBytes)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("image/png")
    $multipartContent.Add($fileContent, "photo", "test-profile.png")
    
    $response = $client.PostAsync("http://localhost:5501/api/user/profile/photo", $multipartContent).Result
    $responseContent = $response.Content.ReadAsStringAsync().Result
    
    if ($response.IsSuccessStatusCode) {
        $uploadResult = $responseContent | ConvertFrom-Json
        Write-Host "✅ Upload de foto realizado com sucesso" -ForegroundColor Green
        Write-Host "Mensagem: $($uploadResult.message)" -ForegroundColor Cyan
        Write-Host "Nova foto URL: $($uploadResult.photoUrl)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Erro no upload de foto: Status $($response.StatusCode)" -ForegroundColor Red
        Write-Host "Detalhes: $responseContent" -ForegroundColor Red
    }
    
    $client.Dispose()
} catch {
    Write-Host "❌ Erro no upload de foto: $($_.Exception.Message)" -ForegroundColor Red
}

# Testar remoção de foto
Write-Host "`n4. Testando remoção de foto de perfil..." -ForegroundColor Yellow
try {
    $removeResponse = Invoke-RestMethod -Uri "http://localhost:5501/api/user/profile/photo" -Method DELETE -WebSession $session
    Write-Host "✅ Remoção de foto realizada com sucesso" -ForegroundColor Green
    Write-Host "Mensagem: $($removeResponse.message)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Erro na remoção de foto: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorDetails = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorDetails)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Detalhes do erro: $errorBody" -ForegroundColor Red
    }
}

# Verificar perfil após remoção
Write-Host "`n5. Verificando perfil após remoção..." -ForegroundColor Yellow
try {
    $profileAfterRemove = Invoke-RestMethod -Uri "http://localhost:5501/api/user/profile" -Method GET -WebSession $session
    if ($profileAfterRemove.profilePhoto) {
        Write-Host "⚠️  Foto ainda presente após remoção: $($profileAfterRemove.profilePhoto)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ Foto removida com sucesso" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro ao verificar perfil: $($_.Exception.Message)" -ForegroundColor Red
}

# Limpar arquivo de teste
if (Test-Path $testImagePath) {
    Remove-Item $testImagePath -Force
}

Write-Host "`n=== TESTE SIMPLES CONCLUÍDO ===" -ForegroundColor Green