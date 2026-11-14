# Guía del Motor de Predicción de Demanda e Inteligencia Artificial

Este documento detalla la arquitectura, reglas matemáticas y decisiones de diseño implementadas en el módulo de **Predicción y Auditoría de Compras de Energía** (`/compras`) del ERP. Sirve como referencia técnica para comprender por qué el motor actúa de forma 100% determinista, cómo sincroniza meteorología real provincial y cómo interactúa con los acuerdos PPA y el mercado diario OMIE.

---

## 1. Arquitectura Híbrida del Motor (`SDA` + `IA`)

El motor de predicción (`src/lib/services/ForecastService.ts`) filtra los contratos activos de la comercializadora activa excluyendo suministros con corte temporal por impago o reposición (`suspendido = true`, Regla 59), deduplica la cartera por la raíz física de **20 caracteres del CUPS** (evitando duplicidades por modificaciones o sufijos ATR), calcula dinámicamente el segmento mediante `calculateSegment` cuando `SupplyPoint.segment` aún esté vacío (con protección defensiva `kWh -> MWh` en tarifas `2.0TD`, Regla 188) y divide la cartera en dos algoritmos paralelos:

1. **SDA (*Similar Day Average*)**: Utilizado exclusivamente para los segmentos **`VIP`** (`> 100 MWh/año`) y **`VE` (Vehículo Eléctrico: `VE <15 MWh`, `VE >15 MWh`)**.
   - **Motivo**: Responden a procesos industriales o rutinas estables de recarga y no presentan correlación lineal fuerte con la temperatura exterior.
   - **Mecanismo**: Extrae las últimas 60 curvas reales (`LoadCurve` con `type = 'CONSUMPTION'` y `date < targetDate`) de ese mismo CUPS de 20 caracteres, filtra los **3 días equivalentes más recientes del mismo día de la semana UTC** y calcula su media horaria exacta.
2. **IA (*Decision Tree Regression*, `ml-cart`)**: Utilizado para el **Resto de Segmentos** (`HOGAR 0-5kW`, `HOGAR 5-10kW`, `HOGAR 10-15kW`, `PYME <50 MWh`, `PYME >50 MWh`).
   - **Motivo**: El consumo residencial y terciario depende estrechamente de la meteorología provincial (calefacción en invierno y climatización en verano) y del calendario laboral.
   - **Vector de características (`X`)**: `[segmentId, provinceId, dayOfWeekUTC, monthUTC, hour, temperatureC, isWeekend]`.

---

## 2. Normalización Geográfica y Sincronización Meteorológica Real (`WeatherSyncService`)

### 2.1 Normalización Canónica de las 52 Zonas Climáticas (`ProvinceService.ts`)
Para impedir que topónimos libres o variantes bilingües/erratas de importación (`"SEVILLA"`, `"Bádajoz"`, `"Guipuzcoa"`, `"Lérida"`, `"Valencia/València"`, `"Alicante/Alacant"`, `"MADRD"`, `"-"`) generen índices inválidos (`provinceId = -1`), `normalizeProvinceName(rawProvince, postalCode)` aplica la siguiente jerarquía:
1. **Prefijo postal (`01`..`52`)**: Si el suministro dispone de código postal válido de 4–5 dígitos, resuelve inequívocamente la provincia oficial.
2. **Diccionario normalizado sin diacríticos**: Normaliza mayúsculas, tildes y denominaciones cooficiales hacia las **52 provincias canónicas** de `PROVINCES_GEO` (`0..51`).
3. **Fallback seguro**: Solo ante ausencia total de código postal y provincia válida se asigna `'Madrid'` (`'28'`).

### 2.2 Clima Histórico Real (`archive-api.open-meteo.com`)
* **`WeatherSyncService.ts`** sincroniza automáticamente la tabla `WeatherHistory` (`@@unique([date, province])`) consultando el archivo histórico horario de Open-Meteo (`Europe/Madrid`) en bloques multiprovincia de 10 coordenadas.
* Resuelve cambios de hora oficiales (**23h en marzo** interpolando `02:00` y **25h en octubre** promediando la hora doble) garantizando siempre vectores finitos de **24 horas**.
* Tanto `AggregationService.regenerateAggregates` como `AggregationService.regenerateForDates` invocan `WeatherSyncService.syncWeatherHistoryRange` antes de cruzar curvas, y `WeatherSyncService.repairHistoricalAggregates()` sanea de forma masiva en SQL cualquier curva histórica que tuviera el fallback plano de `20,0 °C`.

---

## 3. Compresión Matemática Ponderada y Downsampling Determinista

### 3.1 Media Ponderada por Volumen Real de Clientes (`clientCount`)
En `/api/cron/train-forecast`, el histórico de los últimos 365 días de `AggregatedLoadCurve` (priorizando la comercializadora activa si supera 500 curvas y usando el pool físico español en comercializadoras de nueva creación) se comprime por la clave:
`segmentId | provinceId | dowUTC | monthUTC | hour | round(temp) | isWeekend`

A diferencia de una media simple entre filas de distintas tarifas, el entrenamiento pondera estrictamente por el número de suministros activos de cada registro:
* `avgY = sum(totalConsumption[h]) / sum(clientCount)` (kWh reales por cliente).
* `avgTemp = sum(temperature[h] * clientCount) / sum(clientCount)`.

### 3.2 Límites Serverless y Muestreo Sistemático PPS Determinista (Regla 205)
Si el número de configuraciones únicas supera `10.000` muestras:
1. Se ordena numéricamente toda la matriz `X` por sus 7 columnas para eliminar cualquier dependencia del orden de iteración de memoria o PostgreSQL.
2. Se extraen exactamente `10.000` muestras mediante **muestreo sistemático PPS (*Probability Proportional to Size*) 100% determinista** ponderado por `sumClients` (`targetW = (i + 0.5) * (totalWeight / 10000)`), asegurando que cada nodo hoja de `ml-cart` refleje el peso estadístico real de las provincias con mayor volumen de clientes sin sesgos por cubetas aisladas de 1 suministro y manteniendo una reproducibilidad del **100%**.
3. El modelo serializado en `ForecastModelCache` conserva telemetría auditable (`_meta`: muestras, curvas elegibles, provincias entrenadas y `%` de clima real).

---

## 4. Elevación a Barras de Central, Zonas Horarias y Horizonte `D+1..D+14`

1. **Calendario Peninsular Estricto (`Europe/Madrid`) y Selector de Fecha (`D+0..D+14`)**:
   - Todas las fechas `@db.Date` se almacenan y leen en medianoche UTC pura (`YYYY-MM-DDT00:00:00.000Z`) usando `getUTCDay()` / `getUTCMonth()`.
   - En `/compras`, el operador puede generar la predicción para **Mañana (`D+1`, por defecto)** o seleccionar cualquier fecha hasta **`+14 días`**, permitiendo los viernes generar y descargar las ofertas OMIE de **sábado, domingo y lunes**.
2. **Evaluación Horaria Exacta de Periodos ATR (`getPeriodoREE`)**:
   - Cada hora de reloj `h = 0..23` se convierte con `fromZonedTime(targetDate + h:30, 'Europe/Madrid')` y se evalúa junto al prefijo provincial (`01..52`) en `getPeriodoREE`, respetando los husos y calendarios específicos de **Península/Baleares**, **Canarias (`35`, `38`)** y **Ceuta/Melilla (`51`, `52`)** (Circular 3/2020) sin desplazamientos `+1h/+2h` UTC.
3. **Pérdidas BOE × Factor `K` Resiliente**:
   - Se selecciona el registro `RegulatedCost` (`concept = 'PERDIDAS'`) vigente en la fecha objetivo y se modula con el `SystemComponentPrice` (`component = 'K'`) de hace exactamente 52 semanas (`-364 días`, mismo día de la semana); si ese día aún no existiera, aplica fallback automático al registro `K` más reciente del mismo día de la semana.

---

## 5. Regla Estricta de Mercado: PPAs Físicos vs PPAs Financieros en OMIE (Reglas 143 y 234)

En el mercado mayorista ibérico (MIBEL / OMIE):
* **PPAs Físicos (`type = 'FISICO'`)**: Asignación bilateral física de energía del sujeto productor al sujeto comprador. **Reducen hora a hora** la energía física que la comercializadora necesita adquirir en OMIE:
  $$\text{Compra Neta OMIE}_h = \max\left(0,\; \text{Demanda Bruta BC}_h - \text{PPA Físico}_h\right)$$
* **PPAs Financieros (`type = 'FINANCIERO'` / CfD / Swap)**: Contratos puramente financieros por diferencias liquidados al margen del despacho físico. **Jamás pueden reducir ni alterar la compra física en OMIE**, ya que la comercializadora sigue obligada a adquirir el `100%` físico de su demanda en el mercado diario.
* Esta separación física vs financiera se aplica de forma unificada tanto en `ForecastService.generateTomorrowForecast` y la exportación CSV (`PPA_FISICO_BILATERAL` → `TOTAL_OMIE_DD/MM/YYYY` con BOM UTF-8 `\uFEFF`) como en el orquestador `/api/cron/update-portfolio` (`PortfolioBaseCurve.ppaMwh` y `compraOmieMwh`).
* **Unidad Obligatoria de Oferta Cuarto-Horaria en OMIE (`MW` de Potencia, nunca `MWh`)**: OMIE exige que cada uno de los **96 cuartos de hora (`Q1`..`Q96`)** se indique en **megavatios (`MW`) de potencia** (redondeados a `1` decimal en `TOTAL_OMIE_DD/MM/YYYY`), nunca en `MWh` de energía cuarto-horaria. La interpolación lineal cuarto-horaria (`interpolateHourlyKwhToQuarterlyMw` en `ComprasDashboard.tsx`) evalúa los puntos medios centrados de cada cuarto (`q * 0.25 + 0.125`) frente a los puntos medios horarios (`h + 0.5`) para evitar desfases de `-7,5 min` y conservar al `100%` la energía diaria ($\sum_{q=1}^{96} P_{\text{MW}}(q) \times 0,25\text{ h} = E_{\text{MWh}}$), mostrándose por defecto en pantalla la vista **`96 Cuartos OMIE (Q1–Q96 MW)`**.

---

## 6. Proyección a 12 Meses, Sincronización por Bloques y «Auditoría de Datos» (con *Backtesting*)

* **Proyección de Consumo a 12 Meses (`portfolioProjectionActions.ts`)**: Resuelve la comercializadora activa con `resolveActiveCompanyId`, soporta herencia de marca vía `Contract.brandId` o `Client.brandId`, excluye suministros suspendidos (`suspendido = true`), deduplica por CUPS de 20 caracteres, prioriza `Contract.annualConsumption` frente a `SupplyPoint.annualConsumption` (con defensa `kWh -> MWh` en `2.0TD`) y aplica perfil real facturado `M12` (con días inclusivos `+ 1` y descontando abonos `'Abono'`, `'A'`, `'AR'`, `'S'`) en suministros `>= 40 MWh/año`.
* **Sincronización Profunda Progresiva (`365d` en bloques de `30d`)**: Para eliminar timeouts Serverless al regenerar un año completo de curvas y clima, `/api/cron/aggregate-history` soporta ventanas acotadas `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`, y el botón **Sincronización Profunda** de `ComprasDashboard.tsx` itera secuencialmente en 12 bloques de ~30 días mostrando una barra de progreso en tiempo real (`0% → 100%`).
* **Comportamiento ante `0` Contratos Activos**: Si la comercializadora no tiene suministros en estado `ACTIVO`, tanto la proyección de cartera actual a 12 meses como la compra diaria mañana muestran `0 MWh` acompañada de un aviso explicativo explícito, mientras el modelo IA permanece entrenado sobre el histórico de curvas y clima real.
* **Pestaña «Auditoría de Datos» y *Backtesting* Histórico**: Muestra telemetría verificada en vivo desde PostgreSQL (contratos activos vs finalizados, frescura de `LoadCurve` bruta, cobertura de las `52` zonas climáticas en `WeatherHistory`, volumen y `%` de clima real en `AggregatedLoadCurve`, versión y nodos de `ForecastModelCache`, días de Factor `K`, desglose de PPAs Físicos vs Financieros y **Radiografía de Cartera Activa por Segmento**), e incorpora un evaluador interactivo de **Backtesting Histórico (`POST /api/compras/backtest` → `runHistoricalBacktest`)** que compara hora a hora la predicción `IA + SDA` elevada a Barras de Central (`MW`) contra las curvas reales consolidadas, calculando **MAPE (`%`)**, **MAE (`MW`)** y **Sesgo Diario (`%`)**.

---

## 7. Formulación Matemática del *Backtesting* Histórico (`runHistoricalBacktest`)

Para auditar objetivamente la precisión del motor sin sesgos de unidad, `runHistoricalBacktest(targetDateStr, companyId)` reconstruye la predicción horaria de cualquier día histórico consolidado (`AggregatedLoadCurve`) aplicando:
1. **Elevación Homogénea a Barras de Central (`BC`)**: Tanto la demanda real medida (`realHourlyKwh`) como la predicha (`predHourlyKwh` combinando `DecisionTreeRegression` para HOGAR/PYME y `SDA` sobre los días `-7d`, `-14d` y `-21d` para VIP/VE) se multiplican hora a hora por `1 + Pérdida_BOE(tarifa, periodo_Madrid) × K_real(hora)`.
2. **Indicadores Estándar de Precisión Mayorista**:
   * **MAE (*Mean Absolute Error*, en `MW`)**:
     $$\text{MAE}_{\text{MW}} = \frac{1}{24} \sum_{h=0}^{23} \left| P_{\text{pred,BC}}(h) - P_{\text{real,BC}}(h) \right|$$
   * **MAPE (*Mean Absolute Percentage Error*, en `%`)**:
     $$\text{MAPE}_{\%} = \frac{100}{N_h} \sum_{h:\, P_{\text{real,BC}}(h) > 0,01} \frac{\left| P_{\text{pred,BC}}(h) - P_{\text{real,BC}}(h) \right|}{P_{\text{real,BC}}(h)}$$
   * **Sesgo Diario Neto (*Daily Bias*, en `%`)**:
     $$\text{Sesgo}_{\%} = \frac{E_{\text{pred,BC}} - E_{\text{real,BC}}}{E_{\text{real,BC}}} \times 100$$
3. **Referencia Empírica Verificada (`ForecastModelCache v561`, `100%` Clima Real)**:
   * **Invierno (`21/01/2026`, `2.399` suministros, `79,47 MWh` BC)**: `MAPE = 9,65%`, `MAE = 0,332 MW`, `Sesgo = -5,99%`.
   * **Verano (`15/07/2026`, `1.598` suministros, `59,26 MWh` BC)**: `MAPE = 12,96%`, `MAE = 0,317 MW`, `Sesgo = -11,97%`.

---

## 8. Mapa Completo de Archivos, Tablas y Endpoints

| Componente / Ruta | Responsabilidad Técnica |
| :--- | :--- |
| `src/lib/services/ProvinceService.ts` | Catálogo oficial de las **52 provincias canónicas** (`PROVINCES_GEO`, `PROVINCE_NAMES`) y normalizador `normalizeProvinceName(rawProvince, postalCode)`. |
| `src/lib/services/WeatherSyncService.ts` | Descarga histórica multiprovincia desde `archive-api.open-meteo.com` hacia `WeatherHistory` (gestión DST `23h`/`25h`) y reparación masiva SQL `repairHistoricalAggregates()`. |
| `src/lib/services/SegmentService.ts` | Clasificación determinista en los 8 segmentos oficiales (`HOGAR`, `PYME`, `VE`, `VIP`) con blindaje defensivo `kWh -> MWh` en `2.0TD`. |
| `src/lib/services/AggregationService.ts` | Consolidación diaria de `LoadCurve` (`CONSUMPTION` y `SURPLUS`) en `AggregatedLoadCurve` por `companyId`, `segment`, `province` canónica y `tariff`, sincronizando clima previo. |
| `src/lib/services/ForecastService.ts` | Motor principal `generateTomorrowForecast` (`D+0..D+14`, pérdidas BOE × `K`, descuento exclusivo de PPAs `FISICO`, deduplicación `DemandForecast`) y evaluador `runHistoricalBacktest`. |
| `src/app/actions/portfolioProjectionActions.ts` | Proyección estacional a 12 meses de la cartera viva (`get12MonthProjectionAction`) con aislamiento multi-tenant, perfil facturado `M12` (`>= 40 MWh`) e inversión de abonos. |
| `GET /api/cron/aggregate-history` | Regeneración histórica completa (`?days=...`) o por bloques progresivos (`?startDate=...&endDate=...`), reparación opcional de clima y recálculo de energía pendiente (`runCalculatePendingEnergy`). |
| `GET /api/cron/train-forecast` | Compresión ponderada por `clientCount`, muestreo sistemático determinista PPS (`10.000` nodos) y persistencia de `DecisionTreeRegression` + `_meta` en `ForecastModelCache`. |
| `POST /api/compras/forecast` | Endpoint RBAC (`SUPERADMIN`, `COMPANYADMIN`, `BACKOFFICE`) para generar la oferta diaria OMIE de una fecha objetivo (`targetDate`). |
| `POST /api/compras/backtest` | Endpoint RBAC que ejecuta `runHistoricalBacktest` para auditar `MAPE`, `MAE` y curva horaria Predicho vs Real en Barras de Central (`MW`). |
| `GET/POST /api/cron/update-portfolio` | Orquestador de `PortfolioBaseCurve` (30.000 h) que separa estrictamente `ppaFisicoHoraMwh` (reduce compra física OMIE) de `ppaFinancieroHoraMwh` (liquida por diferencias `cfdOrMtmEur`). |
| `src/app/(app)/compras/page.tsx` y `ComprasDashboard.tsx` | SSR de telemetría real en vivo, selector de fecha `D+0..D+14`, Sincronización Profunda en bloques de 30 días, vista cuarto-horaria por defecto `Q1–Q96` en **`MW`**, exportación CSV con BOM UTF-8 y panel interactivo de *Backtesting*. |
