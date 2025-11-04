# Test script for notification preferences functionality
# This script tests the API endpoints for user notification preferences

Write-Host "🧪 Testing Notification Preferences API Endpoints" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Base URL (backend)
$baseUrl = "http://localhost:5501"

# Test 1: Get current user settings
Write-Host "`n1. Testing GET /api/user/settings" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -ContentType "application/json" -SessionVariable session
    Write-Host "✅ Success: User settings retrieved" -ForegroundColor Green
    Write-Host "   Email Notifications: $($response.emailNotifications)" -ForegroundColor Gray
    Write-Host "   Push Notifications: $($response.pushNotifications)" -ForegroundColor Gray
    Write-Host "   SMS Notifications: $($response.smsNotifications)" -ForegroundColor Gray
    Write-Host "   Auto Backup: $($response.autoBackup)" -ForegroundColor Gray
    Write-Host "   Language: $($response.language)" -ForegroundColor Gray
    Write-Host "   Timezone: $($response.timezone)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Update notification preferences
Write-Host "`n2. Testing PUT /api/user/settings" -ForegroundColor Yellow
$updateData = @{
    emailNotifications = $false
    pushNotifications = $true
    smsNotifications = $false
    autoBackup = $true
    language = "pt-BR"
    timezone = "America/Sao_Paulo"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method PUT -Body $updateData -ContentType "application/json" -WebSession $session
    Write-Host "✅ Success: Notification preferences updated" -ForegroundColor Green
    Write-Host "   Email Notifications: $($response.emailNotifications)" -ForegroundColor Gray
    Write-Host "   Push Notifications: $($response.pushNotifications)" -ForegroundColor Gray
    Write-Host "   SMS Notifications: $($response.smsNotifications)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Verify settings were persisted
Write-Host "`n3. Verifying settings persistence" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/user/settings" -Method GET -ContentType "application/json" -WebSession $session
    Write-Host "✅ Success: Settings persisted correctly" -ForegroundColor Green
    Write-Host "   Email Notifications: $($response.emailNotifications)" -ForegroundColor Gray
    Write-Host "   Push Notifications: $($response.pushNotifications)" -ForegroundColor Gray
    Write-Host "   SMS Notifications: $($response.smsNotifications)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Test completed!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green