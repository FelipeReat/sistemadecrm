# Test notification preferences with authenticated user
# This script logs in first, then tests the notification preferences API

$baseUrl = "http://localhost:5501"
$frontendUrl = "http://localhost:5500"

Write-Host "Testing Notification Preferences with Authentication" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

# Step 1: Login to get session
Write-Host "`n1. Logging in as admin user..." -ForegroundColor Yellow
$loginData = '{"email":"admin@crm.com","password":"admin123"}'

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginData -ContentType "application/json" -SessionVariable session
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "User: $($loginResponse.user.name) ($($loginResponse.user.role))" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Test GET user settings
Write-Host "`n2. Testing GET /api/user/settings" -ForegroundColor Yellow
try {
    $settings = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -WebSession $session
    Write-Host "✅ GET settings successful" -ForegroundColor Green
    Write-Host "Current user settings:" -ForegroundColor Cyan
    Write-Host "  - Email notifications: $($settings.emailNotifications)" -ForegroundColor White
    Write-Host "  - Push notifications: $($settings.pushNotifications)" -ForegroundColor White
    Write-Host "  - SMS notifications: $($settings.smsNotifications)" -ForegroundColor White
    Write-Host "  - Auto backup: $($settings.autoBackup)" -ForegroundColor White
    Write-Host "  - Language: $($settings.language)" -ForegroundColor White
    Write-Host "  - Timezone: $($settings.timezone)" -ForegroundColor White
} catch {
    Write-Host "❌ GET settings failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Step 3: Test PUT user settings (updating notification preferences)
Write-Host "`n3. Testing PUT /api/user/settings (updating notification preferences)" -ForegroundColor Yellow

$updatedSettings = @{
    emailNotifications = $false
    pushNotifications = $true
    smsNotifications = $false
    autoBackup = $true
    language = "pt-BR"
    timezone = "America/Sao_Paulo"
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updatedSettings -ContentType "application/json" -WebSession $session
    Write-Host "✅ PUT settings successful" -ForegroundColor Green
    Write-Host "Updated user settings:" -ForegroundColor Cyan
    Write-Host "  - Email notifications: $($updateResponse.emailNotifications)" -ForegroundColor White
    Write-Host "  - Push notifications: $($updateResponse.pushNotifications)" -ForegroundColor White
    Write-Host "  - SMS notifications: $($updateResponse.smsNotifications)" -ForegroundColor White
    Write-Host "  - Auto backup: $($updateResponse.autoBackup)" -ForegroundColor White
    Write-Host "  - Language: $($updateResponse.language)" -ForegroundColor White
    Write-Host "  - Timezone: $($updateResponse.timezone)" -ForegroundColor White
} catch {
    Write-Host "❌ PUT settings failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Status code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Step 4: Verify changes by getting settings again
Write-Host "`n4. Verifying updated settings" -ForegroundColor Yellow
try {
    $finalSettings = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -WebSession $session
    Write-Host "✅ Final verification successful" -ForegroundColor Green
    Write-Host "Final user settings:" -ForegroundColor Cyan
    Write-Host "  - Email notifications: $($finalSettings.emailNotifications)" -ForegroundColor White
    Write-Host "  - Push notifications: $($finalSettings.pushNotifications)" -ForegroundColor White
    Write-Host "  - SMS notifications: $($finalSettings.smsNotifications)" -ForegroundColor White
    Write-Host "  - Auto backup: $($finalSettings.autoBackup)" -ForegroundColor White
    Write-Host "  - Language: $($finalSettings.language)" -ForegroundColor White
    Write-Host "  - Timezone: $($finalSettings.timezone)" -ForegroundColor White
} catch {
    Write-Host "❌ Final verification failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Notification preferences testing completed!" -ForegroundColor Green
Write-Host "You can now test the UI at: $frontendUrl/settings" -ForegroundColor Cyan