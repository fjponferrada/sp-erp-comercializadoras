# Guía Técnica y Financiera: Energía Pendiente de Liquidar (REE) y Conciliación REGANECU

Este documento detalla la arquitectura matemática, contable, regulatoria y operativa del módulo **Energía Pendiente de Liquidar (REE)** (`/gestion/energia-pendiente`), así como su integración en tiempo real con **Curvas de Carga (`LoadCurve` / `AggregatedLoadCurve`)**, **REGANECU (`ReganecuData`)**, **COMPODEM / OMIE (`SystemComponentPrice`)** y **Facturación (`Invoice` / `InternalInvoice` / `F1Invoice`)**.

---

## 1. Propósito del Módulo

En el mercado eléctrico español, Red Eléctrica de España (**REE**) liquida mensualmente la energía consumida por la cartera de cada comercializadora en **Barras de Central (BC)** a través de un ciclo de **16 cierres sucesivos** que se extiende hasta **M+11 / M+18** (`A1 → C1 → A2 → C2 → A3 → C3 → A4 → C4 → A5 → C5 → A6 → C6 → A7 → C7 → A8 → C8`).

En los primeros cierres (`A1` a `C3`), las distribuidoras aún no han remitido el 100% de las curvas reales de telemedida (`F5D` / `F1`), por lo que REE estima huecos mediante perfiles y las distribuidoras emiten facturas de peajes (`F1`) que pueden diferir temporalmente de las curvas horarias recibidas (`CCH`).

El módulo `/gestion/energia-pendiente` responde simultáneamente a **dos preguntas críticas de tesorería y control de margen**:
1. **Conciliación Física Real (`Según CCH`):** ¿Cuántos MWh y cuántos euros nos faltan por pagar (o cobrar) a REE comparando estrictamente las curvas horarias medidas (`CCH` elevadas a BC y neteadas de excedentes solares según P.O. 14.8) frente a lo que REE ya nos ha liquidado en su último cierre `REGANECU`?
2. **Proyección Económica Final (`Estimada`):** Si además tenemos en cuenta el **Descuadre F1–CCH** (energía facturada al cliente final cuyo respaldo en curvas CCH aún no ha llegado o está sobrestimado por la distribuidora), ¿cuál será el saldo económico final previsible frente a REE cuando distribuidoras y operador del sistema converjan en cierres definitivos?

---

## 2. Arquitectura de Datos (`prisma/schema.prisma`)

### 2.1 `AggregatedLoadCurve` (Consolidación Horaria de Cartera)
Tabla intermedia alimentada por `AggregationService` (`src/lib/services/AggregationService.ts`) que pre-agrega las lecturas horarias en contador por `companyId`, `date` (`@db.Date` UTC `00:00:00Z`), `segment`, `province` y `tariff`:
- **`totalConsumption` (`Float[24]`):** Energía activa entrante medida en contador (`kWh` por hora `0..23`), excluyendo estimaciones inventadas.
- **`totalSurplus` (`Float[24]`):** Energía activa saliente / excedentes de autoconsumo medidos en contador (`kWh` por hora `0..23`, `LoadCurve.type = 'SURPLUS'`).
- **`clientCount` (`Int`):** Número de suministros físicos únicos (`Set<baseCups20>`) con medida válida en ese clúster y día, evitando duplicidades cuando un mismo contador presenta curva de consumo y de excedentes.
- **Índice compuesto:** `@@index([companyId, date])` para barridos mensuales ultrarrápidos.

### 2.2 `PendingEnergySummary` (Resumen Precalculado a 18 Meses)
Tabla aislada por comercializadora (`@@unique([companyId, month])`) alimentada por `runCalculatePendingEnergy` (`src/scripts/calculate_pending_energy.ts`):

| Campo | Unidad | Descripción |
| :--- | :--- | :--- |
| `month` | `YYYY-MM` | Mes natural de suministro (ventana de **18 meses cerrados** para cubrir el ciclo completo hasta `C8`). |
| `invoicedMwh` | `MWh` | Energía neta facturada a clientes prorrateada exactamente a los días del mes en calendario `Europe/Madrid`. |
| `f1UnbilledMwh` | `MWh` | Energía en ficheros `F1Invoice` recibidos de distribuidora aún pendientes de emitir factura comercial (informativo). |
| `rawCchMwh` | `MWh` | Consumo bruto medido en contador según curvas `CCH` antes de pérdidas. |
| `surplusMwh` | `MWh` | Excedentes horarios de autoconsumo (`SURPLUS`) minorados a `1.0x` según **P.O. 14.8**. |
| `estimatedBcMwh` | `MWh` | **Demanda BC CCH Recibidas:** Consumo CCH elevado hora a hora a Barras de Central menos excedentes `P.O. 14.8`. |
| `reganecuMwh` | `MWh` | **Liquidado REE:** Suma mensual consolidada de compras del componente `CAD` en el mejor cierre disponible por día. |
| `settlementVersion` | `String` | Cierre representativo del mes (ej. `C2`, `A3`, `C4`, `C5`) más indicador si algún día presenta distinto grado de madurez. |
| `pendingMwh` | `MWh` | **Energía Pte. según CCH:** `estimatedBcMwh - reganecuMwh`. |
| `estimatedCostEur` | `€` | **B.Imp. Pte. según CCH:** Valoración horaria exacta del desvío físico entre `CCH BC` y `CAD REE`. |
| `marketPrice` | `€/MWh` | Precio medio mensual **`OMIE + Restricciones`** (media de medias diarias) aplicado para valorar el descuadre `F1 - CCH`. |
| `cchDays` / `reganecuDays` / `daysInMonth` | `Int` | Cobertura real de días con curvas CCH y días con liquidación REGANECU sobre el total de días del mes. |
| `details` | `Json` | Trazabilidad completa: `closureHistory` (evolución histórica de todos los cierres `A1..C8` del mes), `tariffBreakdown` (reparto por tarifa) y alertas de cobertura. |

---

## 3. Reglas Matemáticas y Regulatorias del Motor (`calculate_pending_energy.ts`)

### 3.1 Resolución Día a Día del Mejor Cierre REE (`SETTLEMENT_RANKS`)
REE publica liquidaciones quincenales/parciales (como `C1` de 15 días) y cierres mensuales sucesivos (`A1 < C1 < A2 < C2 < A3 < C3 < A4 < C4 < A5 < C5 < A6 < C6 < A7 < C7 < A8 < C8`).
1. **Selección por Día Natural (`bestDayReg`):** En lugar de exigir un único cierre monolítico para todo el mes, el motor selecciona **para cada día `D` del mes** la versión de mayor rango en `SETTLEMENT_RANKS` disponible en `ReganecuData`.
2. **Independencia frente a Huecos CCH:** Todos los días liquidados por REE en `ReganecuData` se contabilizan íntegramente en `reganecuMwh` incluso si en algún día concreto aún no se han recibido curvas `CCH` (`estimatedBcMwh = 0` en ese día), impidiendo ocultar liquidaciones reales de REE.
3. **Fusión `H + QH` y Blindaje `upr: false` (`mergeDailyReganecuRecords`):** En cada día se fusionan los ficheros cuartohorarios (`QH`: `BS3`, `CBM`, `DSV`, `RAD3`) con los exclusivos horarios (`H`: `CAD`, `PC3`) priorizando registros consolidados de comercializadora (`!r.upr`) frente a filas heredadas con `upr = true`, evitando duplicar por `2x` la energía o los importes.

### 3.2 Elevación Horaria a Barras de Central y P.O. 14.8 (Autoconsumo)
Para cada día `D` y hora `h` (`0..23`):
1. **Huso Horario Oficial (`Europe/Madrid`):** El periodo tarifario (`P1`–`P6`) se determina construyendo el instante real en `Europe/Madrid` (`fromZonedTime`) e invocando `getPeriodoREE(dt, tariff, zone)` (distinguiendo Península, Canarias y Ceuta/Melilla).
2. **Vigencia Histórica de Costes Regulados:** Los coeficientes reglamentarios `PERDIDAS` (BOE) y `Pagos_Capacidad` se consultan respetando `startDate <= D <= endDate` para todas las tarifas activas (`2.0TD`, `3.0TD`, `3.0TDVE`, `6.1TD`, `6.1TDVE`, `6.2TD`, `6.3TD`, `6.4TD`).
3. **Compresión Exacta del Factor `K` (`96qh → 24h`):** Dado que COMPODEM almacena `K` en 96 cuartos de hora (`kestimqh` en `A1..C4` y `krealqh` en `A5..C8`), el motor promedia los **4 cuartos de cada hora** (`toHourly24`) antes de modular el coeficiente BOE:
   $$\text{Perd}_{\text{real}}(h) = \text{BOE}_{P(h)} \times \overline{K}(h)$$
   $$E_{\text{BC,consumo}}(h) = E_{\text{CCH,consumo}}(h) \times \bigl(1 + \text{Perd}_{\text{real}}(h)\bigr)$$
4. **Minoración de Excedentes de Autoconsumo (P.O. 14.8):** Conforme al Procedimiento de Operación 14.8 de REE, la energía horaria excedentaria vertida por instalaciones de autoconsumo acogidas a compensación simplificada minora la demanda horaria de la comercializadora **a factor `1.0x` (sin multiplicar por coeficiente de pérdidas)**:
   $$E_{\text{BC,neta}}(h) = E_{\text{BC,consumo}}(h) - E_{\text{CCH,excedente}}(h)$$
5. **Ratio Efectivo de Pérdidas del Mes (`lossRatio`):** Se calcula exclusivamente sobre el consumo bruto antes de restar excedentes para no distorsionar la elevación de la energía facturada:
   $$\text{lossRatio} = \frac{\text{estimatedBcMwh} + \text{surplusMwh}}{\text{rawCchMwh}}$$

### 3.3 Valoración Horaria de `B.Imp. Pte. según CCH` (`estimatedCostEur`)
Para cada hora `h`, la diferencia física pendiente frente a REE es:
$$\Delta E(h) = E_{\text{BC,neta}}(h) - \text{CAD}_{\text{REE}}(h)$$
- **Si $\Delta E(h) > 0$ (Falta energía por liquidar → A pagar a REE):** Se valora al precio horario de **Desvío de Compra** (`DSV` obligación/compras) más el coste unitario horario de **`CAD`** (`OS + Restricciones`) y **`PC3`** (`Pagos por Capacidad`).
- **Si $\Delta E(h) < 0$ (REE nos ha sobrestimado energía → A cobrar de REE):** Se valora al precio horario de **Desvío de Venta** (`DSV` derecho/ventas) más el coste unitario horario de **`CAD`** y **`PC3`**.
- **Anclaje Horario Anti-Distorsión:** En aquellas horas concretas en que la comercializadora no tuvo desvío neto en `DSV` (y por tanto REE no informa precio transaccionado en esa fila), en lugar de arrastrar una media mensual plana, el motor ancla el precio base de esa hora a **`OMIE(h)` real** (promediado de 96qh a 24h si procede) + coste unitario real de `CAD(h)` + `PC3(h)`.

### 3.4 Prorrateo de Facturación en Calendario `Europe/Madrid` y Valoración `OMIE + Restricciones`
1. **Prorrateo Diario Exacto (`toMadridCalendarUtc`):**
   - Consolida tanto `Invoice` (`totalMWh` almacenado en `kWh` → `/ 1000`, excluyendo `Penalización`, preservando el signo negativo natural en `Regularizadora`/`Rectificativa` e invirtiendo a `-Math.abs` los tipos `Abono`) como `InternalInvoice` emitidas (`status IN ('EMITIDA', 'ABONO')`, `hidden = false`, almacenadas directamente en `MWh`) aún no volcadas a `Invoice` (deduplicadas por `f1InvoiceId` e `invoiceNumber`).
   - Convierte `billingStart` y `billingEnd` al día civil en `Europe/Madrid` (inmune a timestamps `22:00Z` CEST / `23:00Z` CET) y reparte linealmente los MWh entre los días de intersección con cada mes natural.
2. **Demanda BC Estimada y Descuadre `F1 - CCH`:**
   $$\text{Demanda BC Estimada} = \bigl(\text{invoicedMwh} \times \text{lossRatio}\bigr) - \text{surplusMwh}$$
   $$\text{Descuadre F1–CCH} = \text{Demanda BC Estimada} - \text{Demanda BC CCH Recibidas}$$
3. **Valoración Económica del Descuadre (`OMIE + Restricciones`):**
   - El precio `marketPrice` de cada mes es la suma del **Promedio Mensual de `OMIE`** + **Promedio Mensual de `RESTRICCIONES`** (`SystemComponentPrice`), calculado como **media aritmética de las medias diarias** (de modo que días horarios de 24h y días cuartohorarios de 96qh pesan exactamente 1 día cada uno, cuadrando al céntimo con `/compras/precios-componentes`). Si en un mes aún no se ha importado COMPODEM, aplica como respaldo el coste unitario medio de `CAD` en REGANECU.
   - El saldo económico final proyectado se obtiene sumando la valoración del descuadre a la deuda física medida:
     $$\text{Energía Pte. Estimada} = \text{Energía Pte. según CCH} + \text{Descuadre F1–CCH}$$
     $$\text{B.Imp. Pte. Estimada} = \text{B.Imp. Pte. según CCH} + \bigl(\text{Descuadre F1–CCH} \times \text{marketPrice}\bigr)$$

---

## 4. Sincronización Reactiva Automática (Hooks de Ingesta y Crons)

El resumen de Energía Pendiente se mantiene actualizado automáticamente sin intervención manual ante cualquier cambio en sus fuentes primarias:

1. **Subida Manual de Curvas CCH (`POST /api/etl/cch`):** `cchParser.ts` devuelve todas las fechas afectadas (`affectedDates`, propagadas incluso dentro de `.zip` anidados), ejecuta `AggregationService.regenerateForDates(affectedDates, companyId)` y recalcula `runCalculatePendingEnergy` para los meses tocados.
2. **Sincronización FTP/SFTP Automática (`GET /api/cron/ftp-sync`):** Acumula las fechas afectadas a lo largo de los lotes (`chunks`) del `SyncJob` y, al concluir la cola (`hasMore === false`), regenera `AggregatedLoadCurve` y recalcula `PendingEnergySummary` para los meses impactados.
3. **Importación de REGANECU (`POST /api/reganecu/import`):** Detecta los meses de liquidación contenidos en los ficheros `reganecuH` / `reganecuQH` y recalcula inmediatamente `PendingEnergySummary` para esa comercializadora.
4. **Importación de COMPODEM (`POST /api/compodem/import`):** `CompodemService.processZipBuffer` retorna `affectedMonths` (`K`, `RESTRICCIONES`, `OS`) y dispara automáticamente el recálculo de esos meses.
5. **Importación de OMIE (`POST /api/compras/importar-omie`):** Extrae los meses presentes en el fichero SPOT importado y actualiza `PendingEnergySummary` al instante.
6. **Cron de Agregación Histórica (`GET /api/cron/aggregate-history`):** Tras consolidar `CONSUMPTION` y `SURPLUS` en `AggregatedLoadCurve`, ejecuta `runCalculatePendingEnergy` y revalida `/gestion/energia-pendiente`.

---

## 5. Interfaz Ejecutiva y Modal de Auditoría Mensual (`/gestion/energia-pendiente`)

### 5.1 KPIs Separados por Madurez de Liquidación y Controles
La vista `EnergiaPendienteClient.tsx` (`src/components/gestion/EnergiaPendienteClient.tsx`) consume `GET /api/gestion/energia-pendiente?months=12|18` en una única lectura indexada (`0` queries N+1, `Cache-Control: no-store`):
- **4 Tarjetas KPI Ejecutivas:**
  1. **Saldo Físico Neto según CCH:** Deuda o derecho real acumulado estrictamente según contadores telemedidos.
  2. **Provisión Cierres Vivos (`A1–C3`):** Exposición estimada en meses abiertos donde distribuidoras y REE aún están incorporando medidas reales.
  3. **Saldo Residual Cierres Maduros (`A4–C8`):** Desviación en meses ya consolidados que requiere auditoría CUPS a CUPS (estimaciones altas no regularizadas o huecos crónicos de curva).
  4. **Estado de Sincronización:** Fecha/hora del último cálculo, cobertura de meses y acceso rápido a recálculo.
- **Barra de Herramientas:**
  - Selector de horizonte **`12 meses` / `18 meses (Ciclo C8 completo)`**.
  - Casilla opcional **`Reconstruir CCH`** + botón **`Recalcular Ahora`** con progreso en vivo vía **Server-Sent Events (`POST /api/gestion/energia-pendiente/recalculate`)** habilitado para `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`.
  - **Exportación Excel (`.xlsx`)** de toda la tabla con fila sumatoria `TOTAL` y subtotales numéricos exactos.
- **Alertas Visuales en Tabla:** Badges de cobertura incompleta (`CCH X/Yd`, `REE X/Yd`), `% pérdidas` efectivo debajo de `Demanda BC CCH`, volumen de excedentes solares minorados (`-X MWh exc.`) y precio `@ XX,XX €/MWh` debajo del importe estimado.

### 5.2 Auditoría Detallada por Mes (`GET /api/gestion/energia-pendiente/[month]`)
Al hacer clic en cualquier fila mensual (o en el icono de lupa), se abre el **Modal de Auditoría Mensual** en 3 pestañas con exportación propia a `.xlsx`:
1. **Top 50 CUPS con Mayor Descuadre (`|Facturado + F1 Pte. - CCH|`):**
   - Cruza en tiempo real las facturas prorrateadas al mes (`Invoice` + `InternalInvoice` + `F1Invoice` pendiente) contra las curvas reales `LoadCurve` (`$queryRaw` `unnest(lc.readings)`) acotadas estrictamente a los días de vigencia contractual del suministro en ese mes.
   - Clasifica automáticamente la causa raíz de cada CUPS (`Sin curvas CCH`, `CCH incompleta`, `F1 > CCH (Posible estimación)` o `CCH > Facturado (Pte. facturar)`), incluye buscador instantáneo y enlace directo a `/puntos-suministro/[id]`.
2. **Desglose por Distribuidora:** Agrupa Nº de CUPS auditados, CUPS sin telemedida, energía facturada, energía CCH medida y descuadre neto en `MWh` por distribuidora (`Distributor` / código REE) para detectar de un vistazo qué distribuidora retiene curvas `P5D`/`F5D`.
3. **Evolución de Cierres REE y Reparto Tarifario:** Muestra la tabla histórica completa de todos los cierres `A1..C8` recibidos para ese mes (`closureHistory`: cómo ha ido convergiendo `CAD MWh` e importe liquidado entre `A1`, `C1`, `A2`, `C2`, `C3`, `A4`, `C4`, `C5`...) junto al desglose de consumo BC por tarifa de acceso (`2.0TD`, `3.0TD`, `6.1TD`, etc.).

---

## 6. Mapa de Archivos Clave

- `src/scripts/calculate_pending_energy.ts`: Motor principal de cálculo horario a 18 meses (`runCalculatePendingEnergy`).
- `src/lib/services/AggregationService.ts`: Agregador horario `CONSUMPTION` + `SURPLUS` (`regenerateAggregates` y `regenerateForDates`).
- `src/lib/reganecuServer.ts` y `src/lib/reganecuShared.ts`: Orden jerárquico `SETTLEMENT_ORDER` (`A1..C8`) y fusión diaria `mergeDailyReganecuRecords` con prioridad `!upr`.
- `src/app/api/gestion/energia-pendiente/route.ts`: Lectura rápida multi-empresa sin consultas N+1.
- `src/app/api/gestion/energia-pendiente/recalculate/route.ts`: Endpoint SSE de recálculo bajo demanda (con opción `rebuildAggregates`).
- `src/app/api/gestion/energia-pendiente/[month]/route.ts`: Motor SQL/Prisma de auditoría mensual por CUPS y distribuidora.
- `src/components/gestion/EnergiaPendienteClient.tsx` y `src/app/(app)/gestion/energia-pendiente/page.tsx`: Interfaz ejecutiva, KPIs, exportación `.xlsx` y modal interactivo de auditoría.
