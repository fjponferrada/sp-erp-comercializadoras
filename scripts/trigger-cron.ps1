param (
    [string]$CronName
)

$secret = "SpEnergia2026_UltraCron"
$url = "http://127.0.0.1:3000/api/cron/${CronName}?secret=${secret}"

# Deshabilitar proxy para el usuario SYSTEM (evita el 404 fantasma)
[System.Net.WebRequest]::DefaultWebProxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()

# Create a log folder if it doesn't exist
$logDir = "C:\Users\Administrator\sp-erp-comercializadoras\logs\crons"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

$logFile = "$logDir\$CronName.log"
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$dateStr] Triggering CRON: $CronName" | Out-File -FilePath $logFile -Append
"[$dateStr] URL: $url" | Out-File -FilePath $logFile -Append

# Verificar si el puerto 3000 está activo
$portCheck = netstat -ano | findstr :3000
if (-not $portCheck) {
    "[$dateStr] Servidor no detectado en el puerto 3000. Arrancando servidor en segundo plano..." | Out-File -FilePath $logFile -Append
    # Arranca el servidor de Next.js en modo oculto (usamos run dev porque el ERP local no suele estar buildeado en producción continuamente)
    Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory "C:\Users\Administrator\sp-erp-comercializadoras" -WindowStyle Hidden
    
    # Espera 20 segundos para dar tiempo a que el servidor de desarrollo arranque y esté listo
    Start-Sleep -Seconds 20
}

if ($CronName -eq "trigger-scraping") {
    "[$dateStr] Arrancando worker de scraping (C:\Scrapping\run_worker.bat)..." | Out-File -FilePath $logFile -Append
    if (Test-Path "C:\Scrapping\run_worker.bat") {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c C:\Scrapping\run_worker.bat" -WorkingDirectory "C:\Scrapping" -WindowStyle Hidden
        Start-Sleep -Seconds 10
    } else {
        "[$dateStr] ADVERTENCIA: No se encontró C:\Scrapping\run_worker.bat" | Out-File -FilePath $logFile -Append
    }
}

$method = "Get"
if ($CronName -in @("trigger-scraping", "update-portfolio", "scraping-upload")) {
    $method = "Post"
}

$headers = @{
    "Authorization" = "Bearer $secret"
}

$hasMore = $true
$maxRetries = 10
$retryCount = 0

while ($hasMore -and $retryCount -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri $url -Method $method -Headers $headers
        $resJson = $response | ConvertTo-Json -Depth 5 -Compress
        "[$dateStr] Success ($method): $resJson" | Out-File -FilePath $logFile -Append
        
        if ($response.hasMore -eq $true) {
            "[$dateStr] hasMore es true, continuando la ejecución (Intento $($retryCount+1))..." | Out-File -FilePath $logFile -Append
            $hasMore = $true
            $retryCount++
        } else {
            $hasMore = $false
        }
    } catch {
        $err = $_.Exception.Message
        "[$dateStr] ERROR ($method): $err" | Out-File -FilePath $logFile -Append
        
        if ($_.ErrorDetails) {
            $detail = $_.ErrorDetails.Message
            "[$dateStr] DETAILS: $detail" | Out-File -FilePath $logFile -Append
        }
        
        # Fallback: Si da 404 o 405 en el primer intento, probamos el otro método
        if ($retryCount -eq 0 -and $err -match "404|405") {
            $method = if ($method -eq "Get") { "Post" } else { "Get" }
            "[$dateStr] Intentando fallback con $method..." | Out-File -FilePath $logFile -Append
        } else {
            $hasMore = $false # Cortar el bucle si hay error que no sea 404
        }
    }
}
