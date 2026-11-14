# Guía de Sincronización FTP y Web Scraping de Distribuidoras (CCH, SCTD y F1)

Esta guía documenta la arquitectura, el aislamiento multi-comercializadora (`companyId`), las reglas de negocio y las peculiaridades técnicas asociadas a la ingesta, parseo y sincronización de las Curvas de Carga Horarias (CCH) y ficheros ATR desde los servidores y portales de las distribuidoras eléctricas españolas (e-distribución, i-DE, UFD, CIDE, ASEME, Viesgo, etc.) hacia el ERP.

## 1. Arquitectura de Conexión y Aislamiento Multi-Comercializadora

El módulo encargado de conectarse a los servidores FTP/SFTP de las distribuidoras vive en `src/app/api/cron/ftp-sync` (y su ejecutor por tramos `src/app/api/cron/ftp-sync/execute`), apoyándose en el modelo de configuración por empresa `DistributorCompanyConfig`:

- **Catálogo Global vs. Credenciales por Comercializadora (`DistributorCompanyConfig`):**
  - La tabla `Distributor` actúa como el catálogo maestro global de códigos REE (`reeCode @unique`, nombre legal, registro CNMC).
  - La tabla `DistributorCompanyConfig` (`@@unique([companyId, distributorId])`) almacena de forma estrictamente aislada por comercializadora (`Company`) los datos de conexión FTP/SFTP (`ftpActive`, `ftpHost`, `ftpPort`, `ftpUser`, `ftpPassword`, `ftpTargetPath`, `ftpLastSyncAt`) y de Web Scraping (`webScrapingActive`, `webUser`, `webPassword`, `webScriptPath`, `webLastSyncAt`).
  - La pantalla `/distribuidoras` y el importador `/ajustes/importador` resuelven dinámicamente el `companyId` activo mediante `resolveActiveCompanyId` (respetando el selector superior de marca `active-brand`), mientras que el CRON automático recorre todas las configuraciones activas de todas las comercializadoras.
- **Protocolos Soportados:** El sistema se adapta automáticamente a FTP estándar/FTPS (puerto 21 y otros) y SFTP (puertos 22, 2222, 6222, 11022).
- **Procesamiento por Tramos (Chunking) y Persistencia de Cola:** Debido a los límites de ejecución en serverless (`50s` en cloud / `240s` en local), el job procesa lotes controlados y devuelve `hasMore: true` guardando la cola `pendingFiles` en `SyncJob.results` (tanto en ejecución manual desde UI como en el CRON nocturno `CRON_FTP_SYNC`), evitando re-explorar los árboles SFTP en bloques sucesivos.
- **Seguimiento (Cursor Incremental Estricto `<=` y Modo Manual No Destructivo) y Resiliencia por Fichero:** Cada `(companyId, distributorId)` conserva su cursor `ftpLastSyncAt`. Cuando existe un cursor previo guardado (`hasSavedSyncCursor`), `ftp-sync` filtra con `fileDate <= effectiveSince` (en lugar de `<`), evitando re-descargar en bucle cada 6 horas el último lote cuyo `mtime` coincide exactamente con `ftpLastSyncAt`. El modo manual *"Hacia atrás: X días"* pasa `customSince` en metadatos del `SyncJob` sin alterar `ftpLastSyncAt` en base de datos si falla la conexión. Además, cada archivo individual se procesa dentro de su propio bloque `try/catch` para que un archivo corrupto no aborte el resto de la cola de esa distribuidora.
- **Seguridad de Credenciales y Alertas Visuales en `/distribuidoras`:** Los endpoints `GET /api/distributors` y `GET /api/distributors/[id]` enmascaran siempre `ftpPassword` y `webPassword` (`""`) exponiendo banderas booleanas `hasFtpPassword` y `hasWebPassword`, preservando en `POST`/`PUT` la clave almacenada cuando el formulario se guarda en blanco y replicando en `Distributor` los cambios realizados por `SUPERADMIN`. Tanto `/distribuidoras` (`DistribuidorasClient.tsx`) como `/importar-switching` (`ImportarSwitchingClient.tsx`) muestran indicadores cromáticos de frescura de sincronización (`< 12h` verde, `12h–36h` ámbar, `> 36h` rojo).

## 2. Archivos y Mapeo de Prioridades (`PRIORIDAD_MAP`)

Las distribuidoras nombran sus ficheros siguiendo nomenclaturas CNMC v4.3 (incluyendo prefijos de razón social como `VIESGO DISTRIBUCIÓN ELECTRICA, S.L_P2_0027_...`). El motor `cchParser.ts` extrae el token CNMC exacto mediante expresión regular delimitada (`extractCnmcFileType`) y aplica `PRIORIDAD_MAP`:

- **Prioridad 999 (Histórico Inmutable):** `MIGRACION_PKL`
- **Prioridad 100 (Facturación / Definitivos):** `F1`, `C1` *(ignorado en curvas por ser cierre mensual sin perfil)*, `Q1`, `F1H`, `F1QH`
- **Prioridad 90 (Curvas Mensuales Cerradas):** `F5D`, `RF5D`
- **Prioridad 80:** `A5D`, `B5D`
- **Prioridad 40 (Provisionales Mensuales):** `P5D`
- **Prioridad 20 (Provisionales Diarios):** `P1`, `P1D`, `P2`, `P2D`
- **Prioridad 10:** `P0`

**Reglas de Sobrescritura y Trazabilidad de `source`:**
1. Al guardar en `LoadCurve`, `source` se prefija con el tipo CNMC real detectado (ej. `F5D_FTP_EDISTRIBUCION...`, `P2_UPLOAD_ZIP`) para evaluar de forma exacta la prioridad existente frente a la entrante.
2. `isFileProvisional` solo marca como provisionales los tipos CNMC que comienzan por `P` (`P5D`, `P1`, `P1D`, `P2`, `P2D`, `P0`), evitando falsos positivos por letras `P` en nombres de carpetas o razones sociales.
3. Una curva provisional jamás sobrescribe una definitiva; a igualdad de carácter, nunca se sobrescribe un registro de mayor prioridad (`oldPrio > newPrio`), y `MIGRACION_PKL` es 100% inmutable.
4. En una misma pasada se extraen simultáneamente `CONSUMPTION` (Activa Entrante) y `SURPLUS` (Activa Saliente, guardada cuando existe inyección `> 0`), conservando las filas donde el consumo venga vacío pero exista excedente válido.

## 3. Peculiaridades de Datos y Parseo (`cchParser.ts`)

### A. Basura Informática y Seguridad (El Error `0x00` y BOM)
Algunas distribuidoras envían archivos con bytes nulos (`\0`) o cabeceras BOM (`\uFEFF`) que PostgreSQL rechaza en campos de texto. Antes de invocar `PapaParse`, el contenido se limpia con `csvContent.replace(/^\uFEFF/, '').replace(/\0/g, '')`.

### B. Parseo Numérico de Fechas y Aritmética `Date.UTC` Agnóstica al Servidor
El parser descompone explícitamente formatos `YYYY/MM/DD HH:MM[:SS]`, `DD/MM/YYYY HH:MM[:SS]`, `YYYY-MM-DD` y `DD-MM-YYYY` en sus componentes numéricos locales y opera exclusivamente con `Date.UTC(...)` y métodos `getUTC*`, eliminando cualquier desplazamiento `+1h/+2h` provocado por la zona horaria del sistema operativo (`Europe/Madrid` en Windows vs. `UTC` en Vercel).

### C. Timestamps de Fin de Periodo (`-15 min` en QH vs. `-60 min` en H) y Cambio Horario
Las distribuidoras sellan cada línea al **final** del intervalo de integración en hora local española (verificado sobre ficheros reales de Endesa, Iberdrola, UFD, CIDE, ASEME y Viesgo):
- **Curvas cuarto-horarias (`P2`, `P2D`, `F1QH`, `Q1` o ficheros con minutos `:15/:30/:45`):** Los 96 intervalos del día `D` vienen etiquetados desde `D 00:15` hasta `(D+1) 00:00` → se restan **15 minutos** para ubicarlos en `00:00 .. 23:45` (`readings[0..95]`) del día `D`.
- **Curvas horarias (`F5D`, `P5D`, `F1`, `P1`, `P1D`):** Los 24 intervalos del día `D` vienen etiquetados desde `D 01:00` hasta `(D+1) 00:00` → se restan **60 minutos** para ubicarlos en `00:00 .. 23:00` (`readings[0..23]`) del día `D`.
- **Día de 25 horas de octubre (DST):** Cuando la hora repetida llega dos veces con distinta bandera verano/invierno (`1` y `0`), ambas lecturas se suman en ese tramo horario para no perder energía, mientras que líneas duplicadas con idéntica bandera son idempotentes.

### D. Identificación de Resolución (`QUARTER_HOURLY` vs `HOURLY`)
Si el fichero es cuarto-horario o contiene valores no nulos en los cuartos `:15/:30/:45`, se almacena con `resolution = 'QUARTER_HOURLY'` (96 lecturas); si es horario puro, se compacta a 24 lecturas con `resolution = 'HOURLY'`.

## 4. Normalización de Unidades (`Wh` vs `kWh`) y Límites de Sanidad

1. **Familia `5D` (`F5D`, `RF5D`, `A5D`, `B5D`, `P5D`):** Por estándar CNMC v4.3 vienen siempre en **Wh** enteros → se dividen todas las lecturas entre `1000`.
2. **Resto de ficheros (`F1`, `F1QH`, `P1`, `P1D`, `P2`, `P2D`):** Se cruzan los **20 primeros caracteres** del CUPS (`SUBSTRING(cups, 1, 20)`) contra `SupplyPoint` y se evalúa el **pico máximo horario/cuarto-horario de la curva diaria completa**:
   - Clientes VIP / `>50kW` / tarifas `6.XTD`: umbral `2000 kWh` por tramo.
   - Resto (`2.0TD` y `3.0TD <= 50kW`): umbral `300 kWh` por tramo.
   - Si el pico diario supera el umbral, se dividen de forma uniforme **todos los tramos del día** entre `1000` (evitando deformar horas nocturnas `< 300 Wh` y evitando dividir erróneamente suministros `3.0TD` legítimos en kWh cuya suma diaria supere 300 kWh/día).
3. **Filtro de picos corruptos (`UMBRAL_MAX_ABSOLUTE = 50000 kWh`):** Si incluso tras normalizar existe una lectura corrupta desorbitada o no finita, la curva defectuosa se descarta contabilizándola en `errors`.

## 5. Descompresión Unificada en Memoria (`processCchBuffer`)
Tanto la sincronización FTP/SFTP, la subida manual web (`/api/etl/cch`) como el escáner CLI (`scripts/import_local_cch.ts`) comparten `processCchBuffer`, que extrae recursivamente en memoria RAM archivos `.zip` (incluyendo `.zip`, `.gz`, `.bz2` o `.xlsx` anidados en su interior), `.gz`, `.bz2`, `.xlsx`/`.xls` y texto plano CSV/CNMC sin escribir temporales en disco.

---

## 6. Arquitectura de Web Scraping de Distribuidoras (SCTD y Facturación F1/Q1)

Además de la descarga de curvas horarias (CCH) por FTP/SFTP, el ERP cuenta con un motor autónomo de **Web Scraping** ubicado en `C:\Scrapping` para descargar automáticamente los ficheros XML de **Switching (SCTD)** y **Facturación ATR (`F1` / `Q1`)** desde los portales web de las distribuidoras que no entregan estos ficheros por FTP.

### A. Componentes del Sistema (`C:\Scrapping`)
- **Worker Persistente (`C:\Scrapping\scraping_worker.js`):**
  - Se ejecuta en segundo plano de forma 100% invisible mediante `wscript.exe C:\Scrapping\worker_hidden.vbs` (`run_worker.bat`, sin redirección `>>` de `cmd.exe` para no bloquear descriptores NTFS en Windows).
  - Gestiona directamente la escritura y rotación automática de `C:\Scrapping\worker_output.log` (`fs.renameSync` hacia `worker_output.old.log` al superar **5 MB**) y reduce la traza en reposo a 1 línea cada 30 ciclos (15 minutos).
  - Bloquea el puerto local `127.0.0.1:59999` como mutex para garantizar una única instancia activa en memoria.
  - Consulta cada **30 segundos** el endpoint `GET http://127.0.0.1:3000/api/cron/scraping-worker` autenticado con `Authorization: Bearer <WORKER_SECRET_TOKEN || CRON_SECRET>`, leyendo las configuraciones activas en `DistributorCompanyConfig` (con *fallback* defensivo hacia `Distributor.webUser` / `webPassword` / `webScriptPath`).
- **Scripts de Scraping en Python (`C:\Scrapping\scrapping-*-CRM.py`):**
  - `scrapping-ENDESA-CRM.py` (`EDISTRIBUCION REDES DIGITALES SL.` — Portal Salesforce `portal.edistribucion.com`, subcarpeta aislada `_raw_endesa`, compatible con descargas blob `<uuid>.zip` y `descarga_MD-*.zip` validadas con `zipfile.is_zipfile`).
  - `scrapping-UFD-CRM.py` (`UNIÓN FENOSA DISTRIBUCIÓN, S.A.` — Portal SCTD `sctd.gasnaturalfenosa.com`, subcarpeta aislada `_raw_ufd`, inspección de `page_source` + `body` para avisos de caducidad y errores de login con captura diagnóstica en `C:\Scrapping\logs\ufd_error.png`).
  - `scrapping-CIDE-CRM.py` (`CIDE` — Portal Volta `comercializadores.volta.sercide.com`, subcarpeta aislada `_raw_cide`, eliminación de filtro `Leído = No` y bucle multi-página de hasta 10 páginas / 400 ficheros por ejecución).
  - `scrapping-IBERDROLA-CRM.py` (`I-DE REDES ELÉCTRICAS INTELIGENTES, S.A.U` — Portal `accesoterceros.i-de.es`, subcarpeta aislada `_raw_iberdrola` sin tocar `Downloads` del sistema y bypass anti-bot Akamai).

### B. Reglas Técnicas y Blindaje Operativo
1. **Ejecución 100% Oculta (`--headless=new`) y No Intrusiva:**
   - Todos los scripts se ejecutan en modo `--headless=new` con `undetected_chromedriver`, configurando la ruta de descarga por CDP (`Page.setDownloadBehavior`).
   - **Prohibido matar `chrome.exe` o `msedge.exe` globalmente:** El worker únicamente limpia procesos `undetected_chromedriver.exe` entre ejecuciones para no cerrar jamás el navegador personal del administrador.
   - **Detección Dinámica de Versión de Chrome:** Todos los scripts consultan el registro de Windows (`BLBeacon`) antes de arrancar para pasar `version_main` exacto a `undetected_chromedriver` tras actualizaciones automáticas de Google Chrome.
   - **Bypass Anti-Bot (Akamai en Iberdrola):** En `scrapping-IBERDROLA-CRM.py` se inyecta un `User-Agent` estándar sin la marca `HeadlessChrome` y se navega con eventos nativos (`Keys.TAB` + `.click()`) sobre el formulario reactivo de Angular.
   - **Perfiles Limpios y Salida Segura (`os._exit`):** No se reutilizan directorios `--user-data-dir` persistentes (evitando bloqueos por sesiones cacheadas en CIDE) y se hace `sys.stdout.flush()` / `sys.stderr.flush()` antes de `os._exit(0|1)` (evitando el error `[WinError 6] Controlador no válido` de Python 3.13).

2. **Cálculo Dinámico de Ventana de Descarga (`--dias`):**
   - El endpoint `GET /api/cron/scraping-worker` envía el campo `lastSyncAt` (`DistributorCompanyConfig.webLastSyncAt`) de cada configuración activa.
   - `scraping_worker.js` calcula automáticamente los días transcurridos desde `lastSyncAt` (`Math.max(6, Math.min(30, diffDays + 1))`), descargando un mínimo de **6 días** en operación normal y ampliando automáticamente hasta **30 días** si una distribuidora estuvo varios días sin sincronizar.

3. **Auto-Recuperación del Servidor Local (`Puerto 3000`) y del Worker (`Puerto 59999`):**
   - Tanto `scripts/trigger-cron.ps1` como `C:\Scrapping\scraping_worker.js` verifican que el servidor Next.js local esté escuchando en el puerto `3000`.
   - Si el puerto `3000` no responde, el sistema mata automáticamente posibles procesos zombis de `next dev` / `start-server.js`, elimina el archivo de bloqueo `.next\dev\lock` y levanta `npm.cmd run dev` en segundo plano oculto.
   - Si transcurren más de 6,2 horas sin que se haya encolado un trabajo, el propio `scraping_worker.js` dispara automáticamente `POST /api/cron/trigger-scraping`.

4. **Seguridad de Credenciales, Caché Persistente de Hashes y Enrutado XML:**
   - **Paso Seguro de Credenciales (`execFile` + Variables de Entorno):** `scraping_worker.js` invoca Python mediante `execFile` inyectando `SCRAPER_USER` y `SCRAPER_PASS` en el entorno del proceso (sin pasar `--passw` en línea de comandos ni `cmd.exe`), y sanea cualquier traza antes de persistir `ScrapingJob.logs`. Las APIs `/api/distributors` enmascaran siempre `ftpPassword` y `webPassword` en las respuestas JSON (`hasFtpPassword` / `hasWebPassword`).
   - **Caché SHA-256 Persistente Post-Subida (`C:\Scrapping\cache\<Distribuidora>_hashes.json`):** Los hashes SHA-256 de los XML (con retención automática de 45 días) solo se marcan como procesados **después** de recibir confirmación `HTTP 200` de `POST /api/cron/scraping-upload`. Así, los scripts Python omiten extraer ficheros ya subidos en ejecuciones previas de la ventana móvil de 6–30 días, pero reintentan automáticamente cualquier fichero cuya subida hubiera fallado.
   - **Aislamiento de Descargas, Paginación y Detección de Caducidad:** Cada distribuidora descarga en su propia subcarpeta temporal aislada (`_raw_<dist>`), aceptando cualquier archivo `*.zip` íntegro (`zipfile.is_zipfile`) generado durante la ejecución (incluidos los blobs `<uuid>.zip` que Chrome `--headless=new` genera en Salesforce/Endesa) sin contaminar `Downloads` ni colisionar en `TempDescargas`. En caso de *timeout* de un proceso Python, el worker termina el árbol completo de subprocesos en Windows (`taskkill /PID <pid> /T /F`). CIDE recorre automáticamente múltiples páginas (hasta 400 mensajes por ejecución), y Endesa/UFD/Iberdrola detectan credenciales rechazadas, bloqueos o avisos de próxima caducidad de contraseña emitiendo `[AVISO_CADUCIDAD]` / `[ALERTA_CREDENCIALES]` en el log del trabajo.
   - **Enrutado por Cabecera XML, Codificación `ISO-8859-1` y Soporte `J1`:** `POST /api/cron/scraping-upload` inspecciona la raíz/cabecera real del XML (`<MensajeFacturacion>` / `CodigoDeProceso = F1`, Regla 57) en lugar del nombre de archivo, acepta `.xml`, `.zip` y extensiones numéricas CNMC (`.0`, `.1`, `.2`), devuelve `HTTP 422` ante errores deterministas de validación (evitando 3 reintentos inútiles del worker, reservados solo para errores de red o `5xx`), decodifica automáticamente `ISO-8859-1` / `Windows-1252` (`decodeXmlBuffer`) tanto en Switching como en `F1` (con subida diferida e idempotente a Cloudflare R2 solo para facturas nuevas), soporta expedientes de anomalía/fraude `J1` (`<Cabecera><Codigo>ES...</Codigo></Cabecera>`), reporta estados reales (`COMPLETED`, `PARTIAL`, `ERROR`) actualizando `webLastSyncAt` exclusivamente para `successfulDistributors` y ejecuta automáticamente el barrido `retryUnresolvedSwitchingEventsInternal()` al finalizar cada ciclo del worker.

### C. Endpoints API del Subsistema de Scraping
| Endpoint | Autenticación | Responsabilidad |
| :--- | :--- | :--- |
| `POST /api/cron/trigger-scraping` | `CRON_SECRET` / cabecera Vercel Cron o sesión `SUPERADMIN` / `ADMIN` / `BACKOFFICE` (sin `fallback_secret`) | Encola un `ScrapingJob` en estado `PENDING` únicamente si no existe ya otro trabajo en `PENDING` o `PROCESSING`. |
| `GET / POST /api/cron/scraping-worker` | `Bearer <WORKER_SECRET_TOKEN \|\| CRON_SECRET>` | Entrega las tareas activas (con `lastSyncAt` y fallback a credenciales de `Distributor`), registra el cierre `COMPLETED` / `PARTIAL` / `ERROR` saneando secretos en logs, actualiza `webLastSyncAt` solo en `successfulDistributors` y lanza `retryUnresolvedSwitchingEventsInternal()`. |
| `POST /api/cron/scraping-upload` | `Bearer <WORKER_SECRET_TOKEN \|\| CRON_SECRET>` o sesión autorizada | Inspecciona la cabecera real XML/ZIP y enruta hacia `processF1UploadBuffer` (`F1`) o `ingestSingleSwitchingXml` / `ingestSwitchingZipBuffer` (`SCTD`/`J1`), devolviendo `422` en rechazos de validación y `200` en ingestas válidas o duplicadas. |
| `GET /api/jobs/scraping/[id]` | Sesión `SUPERADMIN` / `ADMIN` / `BACKOFFICE` | Consulta el progreso del `ScrapingJob` desde `/importar-switching` aplicando redacción defensiva de credenciales sobre `logs`. |

### D. Tareas Programadas de Windows Asociadas
- **`AED_Worker_Persistent`**: Ejecuta `wscript.exe C:\Scrapping\worker_hidden.vbs` al inicio de sesión y bajo demanda, sin límite de tiempo de ejecución (`ExecutionTimeLimit = PT0S`).
- **`SPEnergia_Cron_RestartWorker`**: Se ejecuta 1 minuto antes de cada pase de scraping (`04:59, 10:59, 16:59, 22:59` UTC+1 / `05:59, 11:59, 17:59, 23:59` UTC+2). Comprueba si el puerto `59999` está escuchando y, **únicamente si está caído**, limpia `undetected_chromedriver` huérfanos y levanta `worker_hidden.vbs` (sin interrumpir jamás navegadores de una ejecución en curso).
- **`SPEnergia_Cron_TriggerScraping`**: Se ejecuta cada 6 horas (`05:00, 11:00, 17:00, 23:00` UTC+1 / `06:00, 12:00, 18:00, 00:00` UTC+2) invocando `scripts/trigger-cron.ps1 -CronName trigger-scraping`.

---

## 7. Integración con la Ingesta F1 (`f1Ingest.ts`) y el Motor de Facturación Interna (`InternalBillingEngine.ts`)

Los ficheros XML de facturación (`F1` / `Q1`) descargados por Web Scraping o FTP y las curvas de carga (`LoadCurve`) procesadas por `cchParser.ts` convergen directamente en el motor nativo de facturación interna del ERP:

1. **Ingesta de `FacturaATR` y `OtrasFacturas` (`src/app/actions/f1Ingest.ts`):**
   - Decodifica el buffer XML con `decodeXmlBuffer(buffer)` (soportando `UTF-8`, `ISO-8859-1` y `Windows-1252` sin corromper tildes ni `ñ`), extrae entradas `.xml` y numéricas CNMC (`.0`, `.1`, `.2`) dentro de ZIPs, e incorpora *fallback* de CUPS sobre `<Cabecera><Codigo>` cuando `<DatosGeneralesFacturaATR><CUPS>` no viene informado.
   - Ejecuta **subida diferida e idempotente a Cloudflare R2 (`ensureR2Uploaded`)**: comprueba primero en PostgreSQL si cada `codigoFiscalFactura` ya existe en `F1Invoice`, invocando `PutObjectCommand` hacia R2 **única y exclusivamente** cuando el XML aporta al menos una factura nueva.
   - El motor de ingesta registra cada XML en `F1Invoice`, conservando el árbol XML íntegro en `rawData`, vinculando el contrato activo del CUPS (20 primeros caracteres) y almacenando `fechaInicio` a las `00:00 Europe/Madrid` del primer día y `fechaFin` desplazada **`+1 día` a las `00:00 Europe/Madrid`** (Regla 170) para cubrir las 24h/96qh completas del último día facturado.
   - Cuando ingresa una factura **Rectificadora (`R`)** o **Regularizadora (`G`)** y la distribuidora no remite un XML de anulación independiente, `f1Ingest.ts` genera automáticamente el registro sintético de abono asociado (`AR-<CodFiscal>` o `S-<CodFiscal>`) para garantizar la reversión contable de la factura sustituida.
   - Los ficheros **`<OtrasFacturas>`** (derechos de acometida, enganche, verificación, depósitos de garantía o inspecciones sin término de potencia/energía) se procesan en `InternalBillingEngine.ts` mediante un flujo *pass-through* directo que no exige curva horaria en `LoadCurve`.

2. **Alineación Horaria `Europe/Madrid` entre `F1Invoice` y `LoadCurve`:**
   - Dado que `fechaInicio` y `fechaFin` representan medianoches locales españolas (p. ej. `2026-06-19T22:00:00.000Z` en horario de verano CEST para el `20/06/2026`), `InternalBillingEngine.ts` convierte todas las marcas temporales mediante `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' })`, cruzando con exactitud las curvas `CONSUMPTION` y `SURPLUS` almacenadas por `cchParser.ts`.
   - En la interfaz (`/facturacion/interna`), PDF Proforma/Emitido, XML e informes Excel, `fechaFin` se presenta restando 12 horas en zona `Europe/Madrid` para mostrar el último día natural incluido en el ciclo sin alterar el límite exclusivo en base de datos.

3. **Auto-Ajuste ante Retrasos de Curva CCH (`AUTO-AJUSTADO` vs `REQUIERE_REPARACION`):**
   - Es habitual en operación real que el portal web de la distribuidora publique el XML `F1` antes de que el servidor FTP haya entregado los últimos días de curva provisional (`P2D` / `P5D`) o cerrada (`F5D`).
   - Cuando `calculate`, `recalculate`, `repair` o `export-excel` ejecutan `InternalBillingEngine.calculate(f1Id, true, ...)`:
     - Si faltan días o difiere el volumen de consumo respecto al XML `F1`, el motor escala proporcionalmente los periodos (`P1`–`P6`) con lecturas disponibles y perfila los periodos sin lecturas apoyándose en los perfiles oficiales REE (`ReeProfile`: `p20td`, `p30td`), dejando constancia auditada en `repairData` bajo la etiqueta **`AUTO-AJUSTADO`**.
     - En autoconsumo (`SURPLUS`), reparte con `pSolar` cuando no existe curva saliente (respetando ceros nocturnos, Regla 173) o escala proporcionalmente sobre el volumen total de excedentes del F1 (Regla 174).
     - Solo si se produce una anomalía estructural irresoluble (falta de contrato/producto o error crítico de datos), el borrador queda bloqueado en estado `REQUIERE_REPARACION` hasta su subsanación y recálculo.

---

## 8. Integración con el Motor de Parseo e Ingesta de Switching SCTD (`parser.ts` y `switchingIngest.ts`)

Los ficheros XML de **Switching (SCTD)** descargados automáticamente por Web Scraping (`POST /api/cron/scraping-upload`), sincronizados por SFTP o importados manualmente convergen en `src/lib/switching/parser.ts` y `src/app/actions/switchingIngest.ts` bajo las **Reglas 249–252** (Estándar CNMC V3.0):

1. **Prohibición Absoluta de Fallbacks a `new Date()` en Fechas Reglamentarias (Regla 249):**
   - El parser extrae las fechas de efecto reales de cada bloque CNMC (ej. `<NotificacionComercializadorSalienteT1><DatosNotificacion><FechaActivacion>` en `T1_06`, `<FechaActivacion>` en `A3/C1/C2/M1/M2/C1_06/C2_06/E1_06/E1_11/E2_05/E2_06`, `<FechaBaja>` o `<FechaFinalizacion>` en `B1_05/B2_05/E1_05`).
   - **Jamás se aplica `|| new Date()`** ni se sustituye por `<FechaSolicitud>` de cabecera. Si un XML llega con su fecha reglamentaria ausente o inválida, el motor aborta la mutación de fechas del contrato y persiste el `SwitchingEvent` como `isResolved = false` con `tipoError` y `warning` explícito en `/switching-warnings` para revisión manual.

2. **Matriz Direccional Dinámica (`determineIsEnviado`), Clave `uniqueProcess` y Mensajes Informativos (Regla 250):**
   - La dirección real del mensaje (`isEnviado`), el enrutado en Cloudflare R2 (`switching/enviados/` vs `switching/recibidos/`) y el código de comercializadora en `uniqueProcess` (`<Solicitud>_<CodComercializadora>_<CUPS>_<Proceso>_<Paso>`) se resuelven cruzando `<CodigoREEEmpresaEmisora>` y `<CodigoREEEmpresaDestino>` contra los códigos REE propios en `Company.codigoRee` (`getOwnReeCodes`) y la matriz oficial de pasos CNMC V3.0.
   - Se clasifican correctamente como **recibidos** las notificaciones iniciadas por distribuidora (`Q1_01`, `W1`, `B2_01`, `T1_01`, `D1_01`, `R1_03` e incidencias `A3/C2/M1_03`) y como **enviados** las anulaciones (`A3/M1_06`, `C1/C2/E2/R1_08`, `B1/E1_03`), el rechazo `D1_02` y la respuesta `E2_15`.
- Los mensajes informativos (`Q1`, autolecturas `W1`, rechazos de corte `B1_07`), los **expedientes de anomalía/fraude e inspección `J1`** (`<Cabecera><Codigo>ES...</Codigo></Cabecera>`, extrayendo `NumExpediente`, `CodAnomaliaFraude`, `ImporteTotal` y levantando aviso `J1_EXPEDIENTE_<paso>` en `/switching-warnings` para Backoffice) y los rechazos estructurales `P0` se registran limpiamente sin errores de parseo ni falsas alertas de `PROCESO_DESCONOCIDO`.

3. **Conversión Automática de Unidades CNMC (`Watts -> kW`) y Catálogos Oficiales (Reglas 249 y 250):**
   - `XMLParser` opera con `ignoreAttributes: false`, leyendo `@_Periodo="1..6"` y dividiendo automáticamente entre `1000` (`extractPotenciasKw`) todas las potencias contratadas y `<PotInstaladaGen>` (expresadas en **vatios enteros** en CNMC) antes de actualizar `SupplyPoint` o clonar contratos en `M2_05`.
   - `<TarifaATR>` se traduce de la **Tabla 17 CNMC** (`018..026`) al catálogo ERP (`2.0TD`, `3.0TD`, `6.1TD..6.4TD`, `3.0TDVE`, `6.1TDVE`, `6.2TDVE`).
   - `extractCnmcRechazos` extrae `<Rechazos><Rechazo><CodigoMotivo>` y `<Comentarios>` (Tabla 27) en Pasos `02`, `04` y `12` (distinguiendo `MensajeAceptacionAnulacion` frente a `MensajeRechazo`), además de las incidencias de actuación en campo en Paso `03` (`MensajeIncidenciasATRDistribuidor`, Tabla 28 -> `INCIDENCIA_CAMPO`).

4. **Selección por `version: 'desc'`, Cierres en Cascada y Procesamiento Concurrente (Reglas 249 y 252–262):**
   - La selección del contrato activo vigente prioriza siempre `version: 'desc'` (`findHighestActiveContract`), sincroniza atómicamente `iban`, `cnae`, `tariff` y `p1c..p6c` hacia `SupplyPoint` al activar (`syncContractDataToSupplyPoint`), diferencia en `B1_05` el corte temporal por impago (`Motivo = '03'` -> `suspendido = true`) frente a la baja definitiva (`01`, `02`, `04` -> `FINALIZADO` + `bajaProcess = 'B1'`), cierra el contrato al perder el suministro por reposición (`E2_06`) y anula en cascada (`RECHAZADO`) borradores, modificaciones o renovaciones futuras huérfanas tras una baja firme (`cancelSubsequentAndOrphanContracts`).
   - Tanto la ingesta de archivos `.zip` (incluidas extensiones numéricas CNMC `.0`, `.1`, `.2`) como el barrido automático `retryUnresolvedSwitchingEventsInternal()` lanzado al final de cada ciclo del worker procesan los eventos en **lotes concurrentes de `10` elementos** (`CONCURRENCY = 10`).

---

*Documento técnico de arquitectura actualizado conforme a las Reglas de Negocio 57, 170–174, 249–252 y 260–262. Toda modificación de parsers, motores FTP o scripts de Web Scraping dentro del proyecto deberá respetar obligatoriamente las reglas expuestas en este archivo.*
