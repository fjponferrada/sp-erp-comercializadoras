# SP Energía ERP - Documentación de Tareas Programadas Nativas (Windows Task Scheduler)

Este documento detalla todas las tareas automatizadas configuradas a nivel de sistema operativo en el servidor Windows. Estas tareas son fundamentales para mantener sincronizada la base de datos, importar ficheros de distribuidoras y lanzar procesos pesados fuera del hilo principal de la web.

## Tareas de Scraping (Automático y Persistente)

El sistema de Scraping para recuperar archivos F1 de las distribuidoras se divide en varias piezas para asegurar que siempre haya un motor gráfico activo:

### 1. `AED_Worker_Persistent`
- **Descripción**: Mantiene encendido de forma permanente e invisible el Worker local de Node.js (`C:\Scrapping\scraping_worker.js`) que ejecuta los scripts de scraping (`SCTD`, `F1` y `J1`) en modo `--headless=new`.
- **Desencadenador (Trigger)**: Se ejecuta automáticamente *Al iniciar sesión* el usuario Administrator. Configuración sin límite de tiempo de ejecución (`ExecutionTimeLimit = PT0S`, evitando el corte por defecto de 72 horas de Windows) y permitido en cualquier estado de energía.
- **Acción (Action)**: Ejecuta `wscript.exe "C:\Scrapping\worker_hidden.vbs"`, que lanza `C:\Scrapping\run_worker.bat` con ventana 100% oculta (`0`) sin abrir consolas CMD ni bloquear el archivo de log con redirección `>>` de `cmd.exe`.
- **Mecanismos Internos**:
  - Reserva el puerto local `127.0.0.1:59999` como mutex para evitar instancias duplicadas.
  - Gestiona directamente `C:\Scrapping\worker_output.log` con rotación automática (`fs.renameSync` hacia `worker_output.old.log` al superar `5 MB`) y reduce el log en reposo a 1 línea cada 30 ciclos (`15 minutos`).
  - Consulta cada **30 segundos** `GET http://127.0.0.1:3000/api/cron/scraping-worker` autenticado con `Authorization: Bearer <WORKER_SECRET_TOKEN || CRON_SECRET>`.
  - Ejecuta los 4 scrapers Python en serie estricta vía `execFile` pasando credenciales en `SCRAPER_USER` / `SCRAPER_PASS` (nunca en línea de comandos), con subcarpetas temporales aisladas `_raw_<dist>`, caché SHA-256 persistente post-subida (`C:\Scrapping\cache\<dist>_hashes.json`, 45 días) y terminación completa del árbol de subprocesos (`taskkill /PID <pid> /T /F`) si supera 10 minutos.
  - Reporta estados `COMPLETED`, `PARTIAL` o `ERROR` (actualizando `webLastSyncAt` solo en `successfulDistributors`) y, al cerrar el ciclo en `/api/cron/scraping-worker`, dispara automáticamente el barrido `retryUnresolvedSwitchingEventsInternal()`.
  - Si detecta que el puerto `3000` no responde en 2 intentos consecutivos, limpia procesos zombis de Next.js (`next dev` / `start-server.js`), elimina `.next\dev\lock` y levanta `npm.cmd run dev` oculto.
  - Si pasan más de 6,2 horas sin recibir un trabajo, auto-dispara `POST /api/cron/trigger-scraping` autenticado con `CRON_SECRET`.

### 2. `SPEnergia_Cron_RestartWorker`
- **Descripción**: Watchdog no destructivo del Worker. Verifica que el Worker siga vivo antes de cada ciclo de scraping sin interrumpir ejecuciones activas.
- **Desencadenador (Trigger)**: Cada 6 horas (1 minuto antes del trigger de scraping: `04:59, 10:59, 16:59, 22:59` en horario de invierno UTC+1 / `05:59, 11:59, 17:59, 23:59` en horario de verano UTC+2).
- **Acción (Action)**: Ejecuta PowerShell oculto que comprueba si el puerto `59999` está en estado `Listen` (`Get-NetTCPConnection -LocalPort 59999 -State Listen`). **Únicamente si el puerto no está escuchando**, limpia posibles `undetected_chromedriver` huérfanos y lanza `wscript.exe C:\Scrapping\worker_hidden.vbs`.
- **Importancia**: Garantiza alta disponibilidad del Worker sin matar navegadores de un scraping manual o programado que esté en curso.

### 3. `SPEnergia_Cron_TriggerScraping`
- **Descripción**: Llama a la API del ERP (`/api/cron/trigger-scraping`) mediante el lanzador `scripts/trigger-cron.ps1` para encolar un nuevo trabajo `PENDING` en la tabla `ScrapingJob` (si no hay ya uno activo).
- **Desencadenador (Trigger)**: Cada 6 horas (`23:00, 05:00, 11:00, 17:00` en horario de invierno UTC+1 / `00:00, 06:00, 12:00, 18:00` en horario de verano UTC+2).
- **Acción (Action)**: Ejecuta `powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\Users\Administrator\sp-erp-comercializadoras\scripts\trigger-cron.ps1" -CronName "trigger-scraping"`.

---

## Lanzador Común y Auto-Recuperación (`scripts/trigger-cron.ps1`)

Todas las tareas `SPEnergia_Cron_*` (excepto `RestartWorker`) delegan su ejecución en `scripts/trigger-cron.ps1`, que incorpora protección frente a caídas del servidor web local:
1. Comprueba si `127.0.0.1:3000` está escuchando.
2. Si el puerto `3000` está caído:
   - Utiliza un archivo de bloqueo temporal (`C:\Users\Administrator\sp-erp-comercializadoras\logs\starting_next.lock`) para evitar que dos tareas programadas simultáneas arranquen Next.js a la vez.
   - Finaliza cualquier proceso `node.exe` colgado de `next dev` o `start-server.js` y elimina el bloqueo `.next\dev\lock`.
   - Levanta `npm.cmd run dev` en segundo plano oculto y espera hasta **45 segundos** verificando cada segundo hasta que el puerto `3000` esté listo.
3. Realiza la petición `GET` o `POST` a `http://127.0.0.1:3000/api/cron/<CronName>` autenticada con `Authorization: Bearer <CRON_SECRET>` (sin `fallback_secret` inseguro), iterando automáticamente en bucle mientras la respuesta devuelva `hasMore: true`, y registra el resultado en `logs/crons/<CronName>.log`.

---

## Tareas del Core de Negocio (Endpoints CRON)

Las siguientes tareas se encargan de automatizar la facturación, los correos y los análisis de mercado, llamando a la API de Next.js (`/api/cron/`):

### 4. `SPEnergia_Cron_ActivateRenewals`
- **Descripción**: Comprueba periódicamente (`/api/cron/activate-renewals`) los contratos en renovación cuya fecha de inicio ha llegado: pasa el contrato padre saliente a `FINALIZADO` con `terminationDate = expectedEndDate` (cierre anual inclusivo reconocido como 365 días por `CommissionEngine`), activa el contrato renovado (`ACTIVO`), dispara automáticamente el cálculo y snapshot de su nueva comisión anual (`calculateAndSnapshotContractCommission` con `{ onlyIfEmpty: true }`) y envía las notificaciones correspondientes.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `01:00` (01:00, 07:00, 13:00, 19:00).

### 5. `SPEnergia_Cron_UpdatePortfolio`
- **Descripción**: Ejecuta el Orquestador Financiero Multi-Empresa (`/api/cron/update-portfolio`) autenticado con `CRON_SECRET` / token local del programador. Recorre todas las comercializadoras activas y regenera de forma atómica (`prisma.$transaction`) las **30.000 horas (1.250 días)** de `PortfolioBaseCurve` por `companyId` en huso `Europe/Madrid`, combinando la cartera viva en Barras de Central, el patrón histórico de `AggregatedLoadCurve`, los futuros `FuturePrice` modulados con la curva de pato OMIE de los últimos 365 días y las coberturas `Ppa` marcadas con `includeInPricing: true` (`ppaEngine.ts`), descontando del volumen físico OMIE (`compraOmieMwh` y `ppaMwh`) **únicamente los PPAs Físicos (`FISICO`)** mientras que los **PPAs Financieros (`FINANCIERO` / CfD)** liquidan por diferencias (`cfdOrMtmEur`) sin alterar la compra física (Regla 244).
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `02:00` (02:00, 08:00, 14:00, 20:00), además de dispararse bajo demanda desde `/pricing`, `/compras/ppas` y automáticamente al guardar futuros en `/ajustes/costes-regulados`.

### 6. `SPEnergia_Cron_SyncEsios` *(Legacy — Deshabilitada en Windows Task Scheduler)*
- **Descripción**: Descargaba los precios de OMIE desde ESIOS. **Deshabilitada explícitamente (`State: Disabled`)** en el Programador de Tareas de Windows (`Regla 187`), ya que toda la ingesta de precios del sistema se realiza mediante el Importador nativo COMPODEM.
- **Desencadenador (Trigger)**: Inactivo (`Disabled`).

### 7. `SPEnergia_Cron_FtpSync`
- **Descripción**: Recorre todas las configuraciones FTP/SFTP activas por comercializadora (`DistributorCompanyConfig`), aplicando un filtro incremental estricto `fileDate <= effectiveSince` cuando existe `ftpLastSyncAt` previo (evitando re-descargar el último lote en cada ciclo) y reutilizando un `SyncJob` (`type = 'CRON_FTP_SYNC'`) entre bloques `hasMore` para descargar, descomprimir en RAM (`.zip`, `.gz`, `.bz2`, `.xlsx`, CSV) e ingerir curvas de carga CNMC (`F1`, `F1QH`, `F5D`, `RF5D`, `P5D`, `P1D`, `P2D`, etc.) en `LoadCurve` (consumo y excedentes) respetando prioridades y husos horarios. Acumula las fechas reales afectadas (`affectedDates`) entre lotes y, al concluir la cola (`hasMore === false`), dispara `AggregationService.regenerateForDates` y `runCalculatePendingEnergy` sobre los meses impactados.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `03:00` (03:00, 09:00, 15:00, 21:00).

### 8. `SPEnergia_Cron_AggregateHistory`
- **Descripción**: Ejecuta `AggregationService.regenerateAggregates` (`/api/cron/aggregate-history`, soportando también ventanas acotadas `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`) sobre todas las comercializadoras: sincroniza automáticamente temperaturas horarias reales desde Open-Meteo Archive (`WeatherSyncService.syncWeatherHistoryRange` sobre las **52 provincias canónicas** resueltas por `normalizeProvinceName`), consolida las curvas `CONSUMPTION` (`totalConsumption`) y `SURPLUS` (`totalSurplus`) de `LoadCurve` en `AggregatedLoadCurve` por `companyId`, `segment`, `province` y `tariff` en fechas exactas `@db.Date` (`YYYY-MM-DDT00:00:00.000Z`), y recalcula la energía pendiente de liquidar con REE (`runCalculatePendingEnergy` → `PendingEnergySummary`).
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `04:00` (04:00, 10:00, 16:00, 22:00).

### 9. `SPEnergia_Cron_TrainForecast`
- **Descripción**: Ejecuta `/api/cron/train-forecast` (protegido estrictamente por `CRON_SECRET` / cabecera oficial / rol de Compras, sin `fallback_secret`): auto-repara `WeatherHistory` si estuviera vacía, comprime en UTC puro los últimos 365 días de `AggregatedLoadCurve` (excluyendo `VIP`/`VE`, gestionados por `SDA`) ponderando por volumen real de suministros (`sumCons / sumClients`), aplica muestreo sistemático determinista PPS a `10.000` muestras y entrena el árbol de regresión `DecisionTreeRegression` (`ml-cart`) guardando el modelo y su telemetría `_meta` en `ForecastModelCache` (Reglas 204, 205 y 244).
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `05:00` (05:00, 11:00, 17:00, 23:00).

---

## Flujo de Trabajo Secuencial y Desacoplamiento Cloud (`vercel.json`)

Todas las tareas locales de Windows están escalonadas hora a hora cada 6 horas (`TriggerScraping` → `ActivateRenewals` → `UpdatePortfolio` → `FtpSync` → `AggregateHistory` → `TrainForecast`), mientras que los crons diarios de respaldo en Vercel (`vercel.json`) están desplazados al minuto `:30` (`01:30 .. 05:30 UTC`) para no colisionar nunca en el minuto `:00` con las tareas locales sobre PostgreSQL:
1. **23:00 / 05:00 / 11:00 / 17:00 (Invierno UTC+1)** -> Se pone en cola el Scraping (`SPEnergia_Cron_TriggerScraping`).
2. **00:00 / 06:00 / 12:00 / 18:00** -> Renovaciones de contratos (`SPEnergia_Cron_ActivateRenewals`).
3. **01:00 / 07:00 / 13:00 / 19:00** -> Actualización de portfolio (`SPEnergia_Cron_UpdatePortfolio`).
4. **02:00 / 08:00 / 14:00 / 20:00** -> Sincronización FTP/SFTP incremental con cursor estricto `<=` (`SPEnergia_Cron_FtpSync`).
5. **03:00 / 09:00 / 15:00 / 21:00** -> Consolidación de curvas de consumo (`SPEnergia_Cron_AggregateHistory`).
6. **04:00 / 10:00 / 16:00 / 22:00** -> Entrenamiento de previsión de demanda (`SPEnergia_Cron_TrainForecast`).

*(En horario de verano UTC+2 los triggers `PT6H` corren +1h manteniendo exactamente la misma separación secuencial de 1 hora entre tareas; `SPEnergia_Cron_SyncEsios` permanece en estado `Disabled`, y los ficheros de bloqueo `/logs/*.lock` y `/logs/crons/*.lock` están excluidos en `.gitignore`).*

### Tabla de Respaldo Cloud en `vercel.json` (Plan Hobby)
| Endpoint | Expresión Cron (UTC) | Propósito |
| :--- | :--- | :--- |
| `/api/cron/activate-renewals` | `30 1 * * *` | Activación diaria de respaldo para renovaciones vencidas |
| `/api/cron/update-portfolio` | `30 2 * * *` | Regeneración diaria de respaldo de `PortfolioBaseCurve` |
| `/api/cron/ftp-sync` | `30 3 * * *` | Sincronización FTP diaria de respaldo fuera de `:00` |
| `/api/cron/aggregate-history` | `30 4 * * *` | Consolidación diaria de respaldo de `AggregatedLoadCurve` |
| `/api/cron/train-forecast` | `30 5 * * *` | Reentrenamiento diario de respaldo del modelo de previsión |
