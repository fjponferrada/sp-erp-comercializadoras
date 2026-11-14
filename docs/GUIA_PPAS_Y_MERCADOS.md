# Guía Detallada: PPAs, Liquidaciones OMIE y Gestión de Riesgo (ERP)

Este documento recoge los fundamentos matemáticos, contables, de seguridad y de negocio que gobiernan la gestión de contratos **PPA (Power Purchase Agreements)**, liquidaciones contra OMIE, valoración Mark-to-Market (`MtM`), predicción diaria de compras y proyecciones de precios de futuros (`OMIE`/`OMIP`) dentro del ERP.

---

## 1. Arquitectura de Precios Futuros (`FuturePrice` — OMIP Carga Base)

El ERP cuenta con visibilidad multi-año explícita para evitar colisiones entre ejercicios:

*   **Modelo de Datos (`FuturePrice`):** Almacena la curva de futuros financieros Carga Base (`FTB`) en formato entero `YYYYMM` (`@unique`, ej. `202609` para Septiembre de 2026).
*   **Seguridad y Edición (`/api/settings/future-prices` y `/ajustes/costes-regulados`):**
    *   Lectura autenticada (`auth()`) y escritura (`POST` con `upsert`, `PUT`, `DELETE`) restringida estrictamente a `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`.
    *   Al pulsar **"Guardar y Sincronizar Portfolio"** en la pestaña *Precios Futuros OMIE*, el frontend persiste los futuros modificados y dispara automáticamente `POST /api/cron/update-portfolio`, actualizando al instante `PortfolioBaseCurve` para que tanto las proyecciones a 12 meses de PPAs como el Cotizador Comercial reflejen los nuevos precios sin pasos manuales adicionales.
*   **Proyección Estacional Multi-Año:** Para horizontes superiores al último año cargado en `FuturePrice` (ej. ofertas a 24/36 meses o PPAs a 5–10 años), el orquestador aplica *fallback* estacional buscando el mismo mes natural en el año cargado más reciente.

---

## 2. El Orquestador Financiero Multi-Empresa (`PortfolioBaseCurve`)

El proceso `/api/cron/update-portfolio` construye la tabla `PortfolioBaseCurve` aislada por comercializadora (`companyId`, restricción `@@unique([companyId, datetime])`) sobre un horizonte continuo de **1.250 días (~41 meses / 30.000 horas)** desde el día 1 del mes anterior.

### 2.1 Modelado de la "Curva de Pato" Solar
Para estimar el precio horario futuro (ej. 14:00 de un martes de Febrero de 2027 en `Europe/Madrid`):
1.  **Ventana Histórica de 365 días:** Consulta `SystemComponentPrice` (`component = 'OMIE'`) del último año móvil.
2.  **Agrupación `mes - díaSemana - hora`:** Promedia los precios reales horarios o cuarto-horarios (comprimiendo 96 cuartos a 24 medias horarias).
3.  **Normalización Unitaria:** Calcula el peso relativo de cada hora respecto a la media diaria (`suma de 24 ratios = 24`).
4.  **Escalado sobre Futuro FTB:** Multiplica `Futuro_YYYYMM × Ratio_m_w_h`.

### 2.2 Mezcla de Cobertura PPA (Separación Física vs Financiera) y Reemplazo Atómico
*   Filtra exclusivamente contratos activos (`brand.companyId = company.id`, excluyendo suspendidos), curvas agregadas (`AggregatedLoadCurve`) y acuerdos PPA con `includeInPricing = true` pertenecientes a esa comercializadora.
*   **Separación Estricta `FISICO` vs `FINANCIERO` (Reglas 143, 234 y 244):** El orquestador segrega hora a hora `ppaFisicoHoraMwh` (`type = 'FISICO'`) de `ppaFinancieroHoraMwh` (`type = 'FINANCIERO'`). **Únicamente los PPAs Físicos** reducen la compra física en el mercado diario (`compraOmieMwh = max(0, demandaBc - ppaFisicoHoraMwh)` y `PortfolioBaseCurve.ppaMwh = ppaFisicoHoraMwh`), mientras que los **PPAs Financieros (`CfD`)** jamás alteran el volumen físico comprado en OMIE y aportan su cobertura económica exclusivamente a través de su liquidación por diferencias (`cfdOrMtmEur`) al calcular `basePriceEurMwh`.
*   **Transacción Atómica (`prisma.$transaction`):** El borrado y la inserción por lotes (`batchSize = 5000`) se ejecutan dentro de una única transacción por empresa, impidiendo que `/pricing` o `/api/ppas/proyeccion` lean una tabla vacía durante la regeneración.

---

## 3. Motor Centralizado de PPAs (`src/lib/ppaEngine.ts`)

Toda la lógica de vigencias, huso horario, cambios de hora y liquidación está centralizada en `src/lib/ppaEngine.ts` (Reglas 233 y 234):

### 3.1 Modelo de Datos Completo (`Ppa`)
Además de la definición base (`name`, `companyId`, `type`, `subtype`, `priceType`, `priceValue`, `basePowerMw`, `profileData`, `includeInPricing`), cada contrato soporta cláusulas contractuales reales:
*   `counterparty`: Razón social del productor / SPV contraparte.
*   `annualDegradationPct`: Degradación lineal anual del volumen desde el Año 2 (`%`, ej. `0.55%` anual).
*   `annualEscalationPct`: Indexación / escalado anual compuesto del Strike o Fee en cada aniversario contractual (`%`, ej. IPC `2.0%`).
*   `contractPdfUrl`: Enlace al contrato firmado custodiado en **Cloudflare R2** (`folder: 'ppas'`, vía `/api/upload`).
*   `notes`: Condiciones particulares (GdOs, garantías, ventana de liquidación).

### 3.2 Vigencias en `Europe/Madrid` sin Desfase UTC (`-1 día`)
*   Las fechas guardadas a medianoche española (`22:00Z` en verano / `23:00Z` en invierno) se convierten mediante `toMadridYmd` en lugar de `.toISOString().split('T')[0]`, eliminando el desplazamiento de `-1 día` al editar un PPA.
*   Al guardar, `startDate` se fija a `00:00:00.000` (`parseMadridStartOfDay`) y `endDate` a `23:59:59.999` (`parseMadridEndOfDay`) en `Europe/Madrid`, garantizando cobertura completa del último día de vigencia.

### 3.3 Exactitud en Cambios de Hora Oficial (DST 23h Marzo / 25h Octubre)
*   **Primavera (23h / 92 cuartos):** `mapOmieIntervalToMadridClock` omite la inexistente hora `02:00` y asigna `03:00..23:00` a sus índices reales, evitando desplazar 1 hora la curva solar frente a los precios OMIE.
*   **Otoño (25h / 100 cuartos):** Desambigua `02:00 (A)` y `02:00 (B)` y mantiene alineadas las horas `03:00..23:00`.
*   **Cuadre Mensual Exacto (CEC):** `getClockHourOccurrencesInMonth` contabiliza el número exacto de veces que ocurre cada hora de reloj en el mes (`30` ocurrencias para la hora `02` en marzo, `32` en octubre y `díasDelMes` para todas las horas solares `06..21`), garantizando que la suma de intervalos liquidados coincida al **100,00%** con el Anexo de Perfil Fijo `12×24`.

### 3.4 Las 4 Modalidades y Semántica Financiera (`FINANCIERO` vs `FISICO`)
Se soportan las 4 combinaciones (`FISICO`/`FINANCIERO` × `CARGA_BASE`/`PERFIL_FIJO`), incluyendo `priceValue = 0` (OMIE puro) y fees negativos (descuento sobre OMIE):

| Modalidad | Liquidación Principal | Impacto en Compras Diarias OMIE (`ForecastService`) | Métrica Paralela |
| :--- | :--- | :--- | :--- |
| **`FINANCIERO` (CfD / Swap)** | `(OMIE - Precio_PPA) × MWh` (`> 0` cobro comercializadora; `< 0` pago productor) | **No resta** volumen físico (se compra el 100% en OMIE y se liquida financieramente) | Strike efectivo vs OMIE capturado |
| **`FISICO` (Bilateral)** | **Factura Física al Productor:** `Precio_PPA × MWh` | **Sí resta** hora a hora de la demanda bruta BC para calcular `TOTAL_OMIE` (Regla 143) | **Ahorro / MtM vs OMIE:** `(OMIE - Precio_PPA) × MWh` |

---

## 4. Valoración Mark-to-Market (`MtM`) y Gestión de Riesgo vs OMIP (`FTS`)

### 4.1 Exposición Neta `MtM` Descontada (`/api/ppas/proyeccion`)
Al seleccionar cualquier PPA en la pestaña *Liquidaciones OMIE y Proyección MtM*, el sistema calcula automáticamente (incluso antes de existir datos OMIE históricos para el mes consultado):
1.  **Tabla Mensual a 12 Meses:** Energía estimada, OMIE capturado solar/base, precio contractual efectivo y liquidación estimada.
2.  **Valoración `MtM` Total en Curva:** Descuenta cada flujo horario futuro `(OMIE_proyectado - Precio_PPA) × MWh` mediante el factor `1 / (1 + r)^t` (por defecto `r = 3,5%` anual, configurable en tiempo real en la UI para simular cláusulas de resolución anticipada `Euribor + spread`). Si el PPA ya está vencido, devuelve estado `expired` sin proyectar importes ficticios.

### 4.2 Divergencias entre el ERP y OMIP Solar (`FTS`)
*   **Estimación Captura ERP (Stress Test Caníbal):** Arrastra la canibalización real observada en los últimos 365 días de OMIE sobre las horas centrales de sol.
*   **Futuros OMIP Solar (`FTS`):** Reflejan expectativas de consenso del mercado y prima de riesgo.
*   **Recomendación de Negociación (Blended Forecast):** Valorar nuevos PPAs ponderando `(Futuro OMIP Solar + Estimación Captura ERP) / 2`.

---

## 5. Mapa de Archivos Clave

*   `src/lib/ppaEngine.ts`: Motor unificado de fechas Madrid, DST, degradación, escalado, validación `12×24` y liquidación.
*   `src/app/api/ppas/route.ts` y `src/app/api/ppas/[id]/route.ts`: CRUD multi-empresa con RBAC (`SUPERADMIN` / `COMPANYADMIN` / `BACKOFFICE` para escritura).
*   `src/app/api/ppas/liquidaciones/route.ts`: Liquidación real contra `SystemComponentPrice` (`OMIE`) con intersección automática de vigencia contractual y resumen diario + cuarto-horario.
*   `src/app/api/ppas/proyeccion/route.ts`: Proyección financiera a 12 meses y cálculo de exposición neta `MtM` descontada.
*   `src/app/api/cron/update-portfolio/route.ts`: Orquestador multi-empresa transaccional de `PortfolioBaseCurve` con separación estricta entre cobertura física (`ppaFisicoHoraMwh`) y cobertura financiera CfD (`ppaFinancieroHoraMwh`).
*   `src/lib/services/ForecastService.ts` y `src/components/compras/ComprasDashboard.tsx`: Descuento horario exclusivo de PPAs Físicos (`FISICO`) en `TOTAL_OMIE` e interpolación cuarto-horaria centrada (`Q1`–`Q96`) estrictamente en **`MW` de potencia** (Reglas 143, 234 y 244).
*   `src/components/compras/PpaForm.tsx`, `src/components/compras/LiquidacionesPpa.tsx` y `src/app/(app)/compras/ppas/PpaClient.tsx`: Interfaz completa con lector Excel resiliente, visor `12×24`, custodia PDF en R2 y exportación Excel `.xlsx` de 4 pestañas.
*   *Documentación complementaria de conciliación mayorista REE:* Para el cruce entre liquidaciones `REGANECU` (`A1..C8`), curvas agregadas en Barras de Central (`AggregatedLoadCurve`), valoración `OMIE + Restricciones` y auditoría de descuadres `F1–CCH`, consúltese [`docs/GUIA_ENERGIA_PENDIENTE_REE.md`](./GUIA_ENERGIA_PENDIENTE_REE.md).
