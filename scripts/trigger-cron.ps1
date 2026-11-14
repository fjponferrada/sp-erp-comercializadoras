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
    $startLockFile = "$logDir\starting_next.lock"
    $alreadyStarting = $false
    if (Test-Path $startLockFile) {
        $lockAge = (Get-Date) - (Get-Item $startLockFile).LastWriteTime
        if ($lockAge.TotalSeconds -lt 90) {
            $alreadyStarting = $true
        }
    }

    if (-not $alreadyStarting) {
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $startLockFile -Force
        "[$dateStr] Servidor no detectado en el puerto 3000. Limpiando procesos zombis de Next.js y lockfile..." | Out-File -FilePath $logFile -Append

        # Matar únicamente procesos node colgados de Next.js (sin tocar scraping_worker.js)
        Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -match "next.*dev|start-server\.js|\.next\\dev|npm-cli\.js.*run dev"
        } | ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2

        $nextLock = "C:\Users\Administrator\sp-erp-comercializadoras\.next\dev\lock"
        if (Test-Path $nextLock) {
            Remove-Item -Path $nextLock -Force -ErrorAction SilentlyContinue
        }

        "[$dateStr] Arrancando servidor Next.js en segundo plano..." | Out-File -FilePath $logFile -Append
        Start-Process -FilePath "C:\Program Files\nodejs\npm.cmd" -ArgumentList "run dev" -WorkingDirectory "C:\Users\Administrator\sp-erp-comercializadoras" -WindowStyle Hidden
    } else {
        "[$dateStr] Otro proceso ya está arrancando Next.js, esperando..." | Out-File -FilePath $logFile -Append
    }

    # Esperar hasta 45 segundos a que el puerto 3000 esté escuchando
    for ($i = 0; $i -lt 23; $i++) {
        Start-Sleep -Seconds 2
        if (netstat -ano | findstr :3000) {
            break
        }
    }
    Start-Sleep -Seconds 2
}

# Si la tarea es trigger-scraping, asegurar que el worker local de scraping esté activo (puerto 59999)
if ($CronName -eq "trigger-scraping") {
    $workerPort = netstat -ano | findstr :59999
    if (-not $workerPort) {
        "[$dateStr] Worker de scraping no detectado en puerto 59999. Arrancando AED_Worker_Persistent..." | Out-File -FilePath $logFile -Append
        try {
            Start-ScheduledTask -TaskName "AED_Worker_Persistent"
            Start-Sleep -Seconds 5
        } catch {
            "[$dateStr] Error arrancando AED_Worker_Persistent: $($_.Exception.Message)" | Out-File -FilePath $logFile -Append
        }
    } else {
        "[$dateStr] Worker de scraping verificado y activo en puerto 59999." | Out-File -FilePath $logFile -Append
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
$maxRetries = 30
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

