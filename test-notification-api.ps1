# Test script for notification preferences API
Write-Host "Testing Notification Preferences API..." -ForegroundColor Green

# Base URL (backend server)
$baseUrl = "http://localhost:5501"

# Test GET user settings
Write-Host "`n1. Testing GET /api/user/settings" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -TimeoutSec 10 -SessionVariable session
    Write-Host "✅ GET request successful" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ GET request failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# Test PUT user settings (update notification preferences)
Write-Host "`n2. Testing PUT /api/user/settings" -ForegroundColor Yellow
$updateData = @{
    emailNotifications = $false
    smsNotifications = $true
    pushNotifications = $true
    autoBackup = $false
    language = "pt-BR"
    timezone = "America/Sao_Paulo"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updateData -ContentType "application/json" -TimeoutSec 10 -WebSession $session
    Write-Host "✅ PUT request successful" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ PUT request failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}

# Test GET again to verify changes
Write-Host "`n3. Verifying updated settings" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -TimeoutSec 10 -WebSession $session
    Write-Host "✅ Verification successful" -ForegroundColor Green
    Write-Host "Updated Settings: $($response | ConvertTo-Json -Depth 3)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✨ Test completed!" -ForegroundColor Green