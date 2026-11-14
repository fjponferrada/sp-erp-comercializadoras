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
- **Seguimiento (Cursor No Destructivo) y Resiliencia por Fichero:** Cada `(companyId, distributorId)` conserva su cursor `ftpLastSyncAt`. El modo manual *"Hacia atrás: X días"* pasa `customSince` en metadatos del `SyncJob` sin alterar `ftpLastSyncAt` en base de datos si falla la conexión. Además, cada archivo individual se procesa dentro de su propio bloque `try/catch` para que un archivo corrupto no aborte el resto de la cola de esa distribuidora.

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
  - Se ejecuta en segundo plano de forma 100% invisible mediante `wscript.exe C:\Scrapping\worker_hidden.vbs` (`run_worker.bat`).
  - Bloquea el puerto local `127.0.0.1:59999` como mutex para garantizar una única instancia activa en memoria.
  - Consulta cada 60 segundos el endpoint `GET http://127.0.0.1:3000/api/cron/scraping-worker` (autenticado con `WORKER_SECRET_TOKEN`), que lee las configuraciones activas en `DistributorCompanyConfig`.
- **Scripts de Scraping en Python (`C:\Scrapping\scrapping-*-CRM.py`):**
  - `scrapping-ENDESA-CRM.py` (`EDISTRIBUCION REDES DIGITALES SL.`)
  - `scrapping-UFD-CRM.py` (`UNIÓN FENOSA DISTRIBUCIÓN, S.A.`)
  - `scrapping-CIDE-CRM.py` (`CIDE`)
  - `scrapping-IBERDROLA-CRM.py` (`I-DE REDES ELÉCTRICAS INTELIGENTES, S.A.U`)

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

4. **Subida y Actualización Individual de `webLastSyncAt`:**
   - Los archivos XML extraídos en `C:\Scrapping\Temp_Downloads\<Distribuidora>` (y subcarpeta `F1`) se envían a `POST /api/cron/scraping-upload`.
   - Al finalizar, el worker envía a `POST /api/cron/scraping-worker` el array `successfulDistributors`, actualizando `webLastSyncAt` en `DistributorCompanyConfig` (y en `Distributor` por retrocompatibilidad) únicamente para las distribuidoras que completaron su sincronización con éxito.

### C. Tareas Programadas de Windows Asociadas
- **`AED_Worker_Persistent`**: Ejecuta `wscript.exe C:\Scrapping\worker_hidden.vbs` al inicio de sesión y bajo demanda, sin límite de tiempo de ejecución (`ExecutionTimeLimit = PT0S`).
- **`SPEnergia_Cron_RestartWorker`**: Se ejecuta 1 minuto antes de cada pase de scraping (`04:59, 10:59, 16:59, 22:59` UTC+1 / `05:59, 11:59, 17:59, 23:59` UTC+2). Comprueba si el puerto `59999` está escuchando y, solo si está caído, levanta `worker_hidden.vbs` (sin reiniciar el worker si ya está sano).
- **`SPEnergia_Cron_TriggerScraping`**: Se ejecuta cada 6 horas (`05:00, 11:00, 17:00, 23:00` UTC+1 / `06:00, 12:00, 18:00, 00:00` UTC+2) invocando `scripts/trigger-cron.ps1 -CronName trigger-scraping`.

---

## 7. Integración con la Ingesta F1 (`f1Ingest.ts`) y el Motor de Facturación Interna (`InternalBillingEngine.ts`)

Los ficheros XML de facturación (`F1` / `Q1`) descargados por Web Scraping o FTP y las curvas de carga (`LoadCurve`) procesadas por `cchParser.ts` convergen directamente en el motor nativo de facturación interna del ERP:

1. **Ingesta de `FacturaATR` y `OtrasFacturas` (`src/lib/f1Ingest.ts`):**
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

*Documento técnico de arquitectura. Toda modificación de parsers, motores FTP o scripts de Web Scraping dentro del proyecto deberá respetar obligatoriamente las reglas expuestas en este archivo.*
