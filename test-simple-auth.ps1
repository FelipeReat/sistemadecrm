# Simple authentication test using basic HTTP client
$baseUrl = "http://localhost:5502"

Write-Host "Testing simple authentication to $baseUrl" -ForegroundColor Green

# Create a simple HTTP request
$loginData = '{"email":"admin@crm.com","password":"admin123"}'

# Use .NET HttpClient instead of Invoke-RestMethod
Add-Type -AssemblyName System.Net.Http

$httpClient = New-Object System.Net.Http.HttpClient
$httpClient.Timeout = [TimeSpan]::FromSeconds(10)

# Set headers
$content = New-Object System.Net.Http.StringContent($loginData, [System.Text.Encoding]::UTF8, "application/json")

try {
    Write-Host "Sending login request..." -ForegroundColor Yellow
    $response = $httpClient.PostAsync("$baseUrl/api/auth/login", $content).Result
    
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Cyan
    Write-Host "Response Headers:" -ForegroundColor Cyan
    foreach ($header in $response.Headers) {
        Write-Host "  $($header.Key): $($header.Value -join ', ')" -ForegroundColor White
    }
    
    $responseContent = $response.Content.ReadAsStringAsync().Result
    Write-Host "Response Body: $responseContent" -ForegroundColor Green
    
    if ($response.IsSuccessStatusCode) {
        Write-Host "✅ Login successful!" -ForegroundColor Green
    } else {
        Write-Host "❌ Login failed with status: $($response.StatusCode)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.InnerException) {
        Write-Host "Inner Exception: $($_.Exception.InnerException.Message)" -ForegroundColor Red
    }
}

$httpClient.Dispose()