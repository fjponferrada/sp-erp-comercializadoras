# 📈 Guía Definitiva: Curvas de Carga Horaria (CCH) y su Importación

Esta guía documenta exhaustivamente la arquitectura, lógica de negocio y los flujos de importación relacionados con las Curvas de Carga Horaria (CCH) dentro del ERP SP Energía, basándose en las normativas del sistema y las restricciones de infraestructura (Vercel Serverless).

---

## 1. Conceptos Fundamentales

Las **Curvas de Carga Horaria (CCH)** representan el consumo (y opcionalmente la inyección de excedentes) de un punto de suministro eléctrico (CUPS) medido cuarto-hora a cuarto-hora, u hora a hora. 

El sistema almacena esta información en la tabla `LoadCurve` (o su equivalente en base de datos), que sirve como base para:
1. **Facturación Comercial**: Cruzar la curva con los precios de mercado (OMIE) en los contratos indexados.
2. **Agregación de Demanda**: Calcular la energía total consumida por la comercializadora (Demanda BC) para liquidar contra Red Eléctrica (REE).

---

## 2. Jerarquía de Veracidad (Prioridad de Ficheros)

Las distribuidoras envían constantemente ficheros con diferentes niveles de madurez. El motor de importación (`cchParser.ts`) implementa una **jerarquía absoluta** para proteger los datos definitivos frente a rectificaciones erróneas o envíos atrasados provisionales. 

La prioridad (de mayor a menor) es la siguiente:

1. **Datos Históricos Auditados (`MIGRACION_PKL`)**: Prioridad `999`. Son los datos heredados del sistema antiguo. Son inmutables y nunca serán sobrescritos.
2. **Facturación Definitiva (`F1`, `C1`, `Q1`, `F1H`, `F1QH`)**: Prioridad `100` (máxima regular). Es el dato certificado por el que se ha cobrado/pagado. (Los `C1` se ignoran en curvas al contener cierres totales sin perfil horario).
3. **Curvas Definitivas (`F5D`, `RF5D`, `A5D`, `B5D`)**: Prioridad `90` (`F5D`/`RF5D`) y `80` (`A5D`/`B5D`). Ficheros mensuales cerrados por la distribuidora.
4. **Curvas Provisionales Mensuales (`P5D`)**: Prioridad `40`. Ficheros que la distribuidora envía antes del cierre definitivo.
5. **Curvas Diarias (`P1`, `P1D`, `P2`, `P2D`)**: Prioridad `20`. Envíos del día a día, sujetos a estimaciones y fallos de telemedida.
6. **Curvas sin clasificar (`P0`)**: Prioridad `10`.

**Regla de Oro**: Al guardar en `LoadCurve`, el sistema prefija `source` con el tipo CNMC detectado (ej. `F5D_FTP_EDISTRIBUCION...`, `P2_UPLOAD_ZIP`) y *JAMÁS* sobrescribe una curva existente si el fichero entrante tiene una prioridad menor que el dato ya almacenado o si intenta pisar un dato definitivo con uno provisional.

---

## 3. Procesamiento y Estandarización de Datos

El parseo de los archivos CCH implica complejas reglas de estandarización defensiva:

### A. Naturaleza Dual y Posiciones (Consumo vs. Excedentes)
Los archivos CCH **no son exclusivos de consumo**. Una misma fila de un fichero puede contener simultáneamente columnas de Energía Activa Entrante (Consumo) y Energía Activa Saliente (Excedentes Solares). 

**Atención a la nomenclatura de columnas (REE vs Código)**:
La documentación oficial de Red Eléctrica (REE / CNMC v4.3) lista las columnas utilizando letras (A, B, C, D...). Sin embargo, a nivel de programación (JavaScript/TypeScript), los arrays se indexan desde el cero. Por tanto, la correspondencia es: `A=0, B=1, C=2, D=3, E=4, F=5, G=6`, etc.

Además, la posición de estas magnitudes varía erráticamente según el tipo de fichero. El sistema lo detecta dinámicamente:
- **Ficheros F5D / P5D**: La Activa Entrante es la letra D (columna `3`) y la Saliente la letra E (columna `4`).
- **Ficheros F1 / C1**: La Activa Entrante es la letra E (columna `4`) y la Saliente la letra F (columna `5`).
- **Ficheros P1 / P1D**: La Activa Entrante es la letra E (columna `4`), pero la Saliente es la letra G (columna `6`), porque la letra F la ocupa un indicador de calidad.

Para cada fila válida, el `cchParser.ts` lee estas magnitudes a la vez y genera **DOS** curvas independientes en la base de datos para el mismo CUPS y fecha:
- `type = CONSUMPTION` (Consumo)
- `type = SURPLUS` (Excedentes)
(Solo se insertará la curva `SURPLUS` si contiene al menos un cuarto de hora con inyección mayor que cero, para evitar saturar la base de datos).

### B. Corrección de Unidades (Wh a kWh)
La base de datos almacena estricta y únicamente en **kWh**:
- **Familia `5D` (`F5D`, `RF5D`, `A5D`, `B5D`, `P5D`)**: Por estándar CNMC v4.3 vienen siempre en **Wh** enteros, por lo que todas las lecturas se dividen entre `1000`.
- **Resto de ficheros (`F1`, `F1QH`, `P1`, `P1D`, `P2`, `P2D`)**: Por estándar vienen en **kWh** (con decimales), pero ante distribuidoras que remitan anomalías en Wh, el parser cruza los 20 primeros caracteres del CUPS contra `SupplyPoint` y evalúa el **pico máximo horario/cuarto-horario de la curva diaria completa** (`> 2000` en suministros VIP/`>50kW`/`6.XTD` o `> 300` en resto). Si supera el umbral, divide de forma uniforme los 24/96 periodos del día entre `1000` (evitando partir curvas nocturnas/diurnas o dividir por error consumos `3.0TD` legítimos en kWh).

### C. Timestamps de Fin de Periodo (-15 min vs -60 min) y Zonas Horarias
Las distribuidoras etiquetan cada registro en **Hora Local Española al final del intervalo medido**:
- **Ficheros horarios (`F5D`, `P5D`, `F1`, `P1`, `P1D`)**: Los 24 intervalos del día `D` vienen sellados desde `D 01:00` hasta `(D+1) 00:00` -> se restan **60 minutos** para asignarlos a `00:00 .. 23:00` del día `D`.
- **Ficheros cuarto-horarios (`P2`, `P2D`, `F1QH`, `Q1` o curvas con minutos `:15/:30/:45`)**: Los 96 intervalos del día `D` vienen sellados desde `D 00:15` hasta `(D+1) 00:00` -> se restan **15 minutos** para asignarlos a `00:00 .. 23:45` del día `D`.
- **Cálculo agnóstico al huso del servidor**: `cchParser.ts` opera con aritmética pura `Date.UTC` sobre los componentes numéricos locales para guardar `LoadCurve.date` (`@db.Date` `YYYY-MM-DDT00:00:00.000Z`) y el array `readings` en hora local española sin verse afectado por el huso del servidor Windows/Linux. En el día de cambio horario de octubre (25 horas, doble bandera verano `1` e invierno `0`), ambas lecturas de la hora repetida se suman en su hueco horario para no perder energía. Posteriormente, `InternalBillingEngine` utiliza `fromZonedTime(fechaLocal, 'Europe/Madrid')` al cruzar contra OMIE y periodos tarifarios REE.

---

## 4. Vías de Importación y Aislamiento Multi-Comercializadora

Existen dos vías principales para introducir curvas al sistema, centralizadas en la página `/ajustes/importador` (restringida a `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`):

### Vía 1: Sincronización FTP Automática (Aislada por `companyId`)
Cada comercializadora (`Company`) dispone de sus propios servidores y credenciales FTP/SFTP por distribuidora en la tabla `DistributorCompanyConfig` (gestionables desde `/distribuidoras` según la marca/comercializadora activa resuelta por `resolveActiveCompanyId`).
- **Lógica de Ejecución (Chunking y Persistencia de Cola)**: Debido a que las funciones Serverless de Vercel tienen un tiempo de vida acotado (`50s` en cloud / `240s` en local), el backend procesa los archivos en lotes ("chunks"). El front-end (`page.tsx`) llama en bucle al endpoint `/api/cron/ftp-sync/execute` mientras responda con `hasMore: true`. En modo CRON nocturno (`/api/cron/ftp-sync`), el servidor reutiliza automáticamente un `SyncJob` (`type = 'CRON_FTP_SYNC'`) entre iteraciones de `trigger-cron.ps1` para conservar la cola `pendingFiles` sin re-escanear los árboles SFTP en cada bloque, recorriendo las configuraciones activas de todas las comercializadoras.
- **Mutex, Cursor Incremental Estricto (`<=`) y Ventana Manual No Destructiva**: `triggerFtpSyncManually` impide lanzar trabajos duplicados simultáneos sobre la misma comercializadora (expirando automáticamente jobs zombis `> 10 min`). En ejecuciones incrementales con `ftpLastSyncAt` previo (`hasSavedSyncCursor`), `ftp-sync` filtra con `fileDate <= effectiveSince` (en lugar de `<`) para no re-descargar cada 6 horas el último lote cuyo `mtime` coincide exactamente con el cursor guardado; cuando se usa la opción *"Hacia atrás: X días"*, inyecta `customSince` en los metadatos del job sin machacar `ftpLastSyncAt` en base de datos si falla la conexión. Además, `/api/distributors*` enmascara siempre `ftpPassword` (`hasFtpPassword`) y `/distribuidoras` muestra alertas cromáticas cuando la última sincronización supera `12h` (ámbar) o `36h` (rojo).
- **Polling y Resiliencia**: La UI consulta cada 3 segundos el estado del Job (`/api/jobs/sync/[id]`, saneando en tránsito la cola interna `pendingFiles`) mostrando el progreso global acumulado y el desglose final por distribuidora; si un archivo individual falla al descomprimir o parsear, se registra el aviso y la cola continúa sin bloquear el resto del servidor FTP.
- **Reagrupación Selectiva y Recálculo Automático al Concluir (`hasMore: false`)**: Durante los lotes, el job acumula las fechas reales afectadas (`affectedDates` devueltas por `cchParser.ts`, incluidas las de ficheros anidados en `.zip`). Al finalizar la cola (`hasMore === false`), dispara automáticamente `AggregationService.regenerateForDates` y `runCalculatePendingEnergy` para actualizar al instante `AggregatedLoadCurve` y `/gestion/energia-pendiente` en los meses impactados.

### Vía 2: Subida Manual (UI Drag & Drop)
Útil para inyectar históricos masivos desde el ordenador del usuario.
- **Procesamiento Unificado en Memoria**: Tanto el FTP como el Dropzone comparten `processCchBuffer`, soportando archivos `.zip` (incluidos `.zip`, `.gz`, `.bz2` o `.xlsx` anidados en su interior), `.gz`, `.bz2`, `.xlsx` y `.csv`/`.txt` en memoria RAM sin escribir temporales en disco.
- **Actualización Reactiva Inmediata (`POST /api/etl/cch`)**: Tras ingerir el fichero, el endpoint regenera en el acto las curvas agregadas (`AggregationService.regenerateForDates`) exclusivamente para las fechas contenidas en el archivo subido y recalcula `PendingEnergySummary` (`runCalculatePendingEnergy`) en los meses afectados.
- **Límite Inteligente Cloud vs. Local (4.5 MB)**: El Dropzone sube los ficheros de uno en uno con parseo defensivo ante errores HTTP no-JSON (`413` / `504`). Cuando se accede desde despliegue cloud (Vercel), pre-valida en cliente el límite de `4.5 MB` por archivo; cuando se opera desde `localhost` o red local del servidor Windows, permite subir ZIPs de mayor tamaño sin restricción artificial.

---

## 5. Excedentes y Facturación F1 (Reparación)

Durante la generación de facturas, si un cliente indexado inyecta excedentes según la factura de peajes (F1) pero su medición real no es perfecta, el motor interviene:

1. **Escalado Proporcional**: Si existe curva de excedentes en base de datos (`SURPLUS`), pero la suma total difiere del volumen cobrado en el F1, el motor calcula un coeficiente (`F1 / Suma CCH`) y multiplica cada hora por ese factor. Así se cuadran los totales respetando la forma y picos reales de inyección del cliente.
2. **Perfilado Teórico (`pSolar`)**: Si la distribuidora cobró excedentes en el F1, pero la curva real de telemedida NO LLEGÓ al sistema (hueco de datos), el motor reparte los excedentes usando el perfil de generación fotovoltaica `pSolar`. Queda **prohibido** usar coeficientes de consumo (P1-P6) para repartir energía solar, y se garantizan ceros absolutos durante las horas nocturnas para no adulterar el precio medio percibido.

---

## 6. Agregación de Demanda BC y Clima Provincial (`AggregationService`)

Para liquidar compras en el mercado eléctrico (REE/OMIE) y entrenar el motor de predicción IA (`/compras`), se consolida la demanda horaria y los excedentes de la cartera en `AggregatedLoadCurve` (`/api/cron/aggregate-history`):

- **Sin Inventos (Consumo y Excedentes)**: El servicio de agregación (`AggregationService`) es conservador. Acumula en `totalConsumption` únicamente lo medido (`type = 'CONSUMPTION'`) y en `totalSurplus` los excedentes medidos (`type = 'SURPLUS'`, comprimiendo curvas cuarto-horarias de 96 periodos a 24 sumas horarias en `kWh`). Si un cliente no tiene CCH reportada en un día, suma `0` sin inventar perfiles estimados.
- **Normalización Canónica de las 52 Provincias y Clima Real (`WeatherSyncService`)**: Cada suministro resuelve su provincia mediante `normalizeProvinceName(sp.province, sp.postalCode)` (`ProvinceService.ts`), garantizando una de las **52 provincias oficiales** (`0..51`, sin erratas ni bilingüismos sueltos). Antes de consolidar cada rango de fechas, `AggregationService` invoca automáticamente `WeatherSyncService.syncWeatherHistoryRange` contra `archive-api.open-meteo.com` (normalizando cambios horarios DST de `23h`/`25h` a `24h`), asegurando temperaturas horarias reales al `100%`.
- **Alineación Exacta `@db.Date` (`Europe/Madrid` -> UTC `00:00:00Z`)**: Todas las fechas de consulta, borrado e inserción se calculan a partir de la fecha natural española (`Europe/Madrid`) anclada a medianoche UTC exacta (`YYYY-MM-DDT00:00:00.000Z`), evitando desfases de `-1 día` en servidores Windows con huso horario local.
- **Ventana Contractual y Multi-Titularidad por CUPS**: El servicio agrupa las fichas por `baseCups` (20 caracteres), permitiendo que un mismo contador físico que haya cambiado de titular, tarifa o comercializadora del grupo impute cada día al `companyId`, `segment`, `province` y `tariff` vigentes en esa fecha (`activationDate <= fecha <= terminationDate`), excluyendo contratos en estado `BORRADOR`, `TRAMITANDO`, `ANULADO` o `RECHAZADO` y evitando doble conteo dentro de la misma agrupación.
- **Optimización por Bloques, Regeneración Selectiva y Recálculo de Energía Pendiente**: Soporta tanto ventanas relativas (`?days=...`) como rangos acotados (`?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`, empleados por la *Sincronización Profunda* del dashboard en 12 bloques de 30 días sin timeouts Serverless), así como `AggregationService.regenerateForDates(isoDates, targetCompanyId)` para regenerar únicamente los días afectados tras cargas manuales o FTP, deduplicando `clientCount` mediante `Set<string>` sobre `@@index([companyId, date])`. Al concluir actualiza automáticamente la energía pendiente de liquidar con REE (`runCalculatePendingEnergy` → `PendingEnergySummary`, véase [`docs/GUIA_ENERGIA_PENDIENTE_REE.md`](./GUIA_ENERGIA_PENDIENTE_REE.md)).
- **Descuadres Estructurales y Auditoría CUPS a CUPS**: Es normal que en cierres provisionales (`A1–C3`) el volumen agrupado difiera del facturado provisionalmente por REE o por distribuidoras. En `/gestion/energia-pendiente` se puede auditar mes a mes el desglose por distribuidora y el **Top 50 CUPS** con mayor discrepancia entre facturación y curvas CCH.
