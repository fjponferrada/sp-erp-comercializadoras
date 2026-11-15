# 📚 Guía Maestra del Ecosistema de Comisiones y Liquidaciones

Esta guía documenta de forma exhaustiva la arquitectura técnica, el modelo de datos inmutable, las fórmulas matemáticas y las pantallas operativas del motor de comisiones del ERP (`CommissionEngine`, Configuración de Parrillas, Liquidación Mensual y Comisiones Activas), en plena correspondencia con `docs/BUSINESS_RULES_UTF8.md` (**Reglas 11, 22, 44, 47, 112, 116–118, 121, 123, 131, 135, 156, 245–248 y 279**).

---

## 1. Principios Rectores de Negocio

### 1.1 Independencia Total entre Permanencia del Cliente y Horizonte de Comisión (365 Días)
* **Permanencia del Cliente (`Contract.permanenceMonths`)**: Gobierna **exclusivamente** si al cliente final se le emite o no una factura de penalización (`PenaltyInvoice`, documentada en [`docs/GUIA_BAJAS_Y_PENALIZACIONES.md`](./GUIA_BAJAS_Y_PENALIZACIONES.md)) por baja anticipada.
* **Horizonte de Comisión al Canal**: Opera **siempre sobre un ciclo fijo de 365 días (12 meses)** por cada contrato anual, con independencia absoluta de si el cliente firmó `"12 Meses"` o `"Sin Permanencia"`.
  * Si el canal cobra una comisión `Upfront` (100% adelantado por 1 año) y el suministro causa baja con `díasActivos < 365`, se ejecuta la regularización/decomisión correspondiente aunque el contrato del cliente no tuviera permanencia.
  * Si el suministro alcanza o supera `díasActivos >= 365`, la comisión anual queda 100% devengada y **nunca** genera decomisión.
  * Las comisiones de **Servicios Adicionales** vinculados al contrato también se calculan sobre una anualidad fija de **12 meses**.

### 1.2 Inmutabilidad Histórica ("Foto Fija" en el Contrato)
Un producto comercial (`Product`) o una regla de comisión (`CommissionRule`) pueden editarse hoy para futuras ventas sin alterar jamás las condiciones económicas ni las liquidaciones de contratos firmados en el pasado.
Por ello, cada `Contract` almacena su propia **foto fija inmutable** en base de datos en el momento de su creación/cálculo:
* **Márgenes del Producto/Oferta**:
  * `fee` y `marginFC`: Margen de energía (€/MWh). En productos `Indexado Personalizable`, refleja el fee pactado en el contrato (`contractData.indexado.fee`); en productos `Fijo` o `Indexado Estándar`, congela el `marginFC` del producto en la fecha de contratación.
  * `ip1..ip6`: Márgenes de potencia por periodo (€/kW/año). En `Indexado Personalizable` toma `contractData.indexado.ip1..ip6`; en el resto congela `product.ip1..ip6`.
  * `productTypeSnapshot`: Tipo exacto del producto en el momento de la firma (`Fijo`, `Indexado Estándar`, `Indexado Personalizable`, etc.).
* **Potencias y Consumo Base**:
  * `p1c..p6c` (con respaldo en el punto de suministro si el contrato heredado no las tuviera) y `annualConsumption` (kWh estimados en el alta).
* **Regla Ganadora Aplicada**:
  * `commissionRuleType` (`POWER_TIERS` o `MARGIN_PERCENTAGE`) y `commissionRuleValue` (€ fijos o % de margen).
  * Importes calculados: `commissionEnergy`, `commissionServices`, `commissionTotal` y `commissionFinal` (base líquida definitiva tras posibles ajustes manuales de dirección).

### 1.3 Aislamiento Multi-Marca (`Brand`) y Permisos por Rol
* **Aislamiento por Comercializadora**: Tanto los Niveles de Comisión (`CommissionTier.brandId`) como los Canales (`Channel`), Productos (`Product`), Servicios Adicionales (`AdditionalService`) y Contratos (`Contract`) están estrictamente aislados por la marca activa en sesión (`getActiveBrand()`). Dos marcas distintas pueden tener un `"Nivel Oro"` propio sin colisión (`@@unique([name, brandId])`).
* **Control de Acceso (RBAC) y Confidencialidad de Márgenes Mayoristas**:
  * `/comisiones-config` y sus APIs (`/api/commission-tiers`, `/api/commission-rules`): Exclusivo para `SUPERADMIN` y `COMPANYADMIN`. Oculto y bloqueado para `BACKOFFICE`, `CANAL` y `COMERCIAL`.
  * **Blindaje de márgenes en catálogo (`GET /api/products`), Previsualización en Vivo (`estimateLeadCommissionAction`) y Sanitización en Contratos (`/contratos`, `/contratos/[id]`)**: Los endpoints de catálogo omiten `marginFC` e `ip1..ip6` cuando quien consulta es `COMERCIAL`, `CANAL` o una integración por API Key. Para que el agente comercial conozca en tiempo real su retribución mientras configura una **Oferta** o **Alta Luz** en `NewLeadModal.tsx` (Paso 3), la Server Action `estimateLeadCommissionAction` (`src/app/actions/leadActions.ts`) ejecuta el cálculo en el servidor usando `CommissionEngine` y devuelve al navegador **únicamente** el resultado final (`{ available, commissionTotal, commissionEnergy, commissionServices, channelName }`), sin exponer jamás los márgenes internos del producto ni los porcentajes/reglas de la parrilla. Del mismo modo, en `/contratos` y `/contratos/[id]`, `sanitizeContractForRole` (`contractActions.ts`) suprime en servidor `marginFC` e `ip1..ip6` para `CANAL`, `COMERCIAL` y `CLIENT` (ocultando también las comisiones y el `fee` al rol `CLIENT`), exporta una **Cartera Comercial Limpia** sin márgenes para `CANAL`/`COMERCIAL`, y mantiene estrictamente separado `Contract.fee` frente a `Contract.commissionBase` en `EditContractModal.tsx` y `ContractDetailClient.tsx` (**Regla 279**).
  * `/liquidacion-comisiones` y `/comisiones-activas`: Accesibles según filtro de visibilidad jerárquica (`getUserVisibilityFilter()`), permitiendo a administración auditar toda la marca y a canales/agentes consultar únicamente su ámbito autorizado si tienen permiso de vista.

### 1.4 Cadenas Contractuales: Modificaciones vs. Renovaciones
* **Modificaciones intra-anuales (`M1`, `M2`, `E1`, `E2`)**: Se agrupan dentro de la **misma cadena comisionable** liderada por su `V0` (vinculadas por `parentContractId` o raíz de código contractual antes de `-M1`/`-E1`). Los cambios de potencia o condiciones intermedios no duplican el alta ni reinician el contador de 365 días.
* **Renovaciones (`tipo = 'R'` o `isTacitRenewal = true`)**: Cada renovación anual abre una **nueva cadena comisionable independiente de 365 días** con su propio cálculo de comisión y su propio ciclo de devengo/regularización (Regla 135).
  * Cuando el cron de renovaciones cierra el contrato saliente fijando `terminationDate = expectedEndDate` (último día inclusivo del año cumplido, p. ej. `31/12` antes de activar la renovación el `01/01`), el motor reconoce el día final inclusivo (`365 días` cumplidos) para evitar falsas decomisiones de 1 día.
* **Sustitución anticipada por un nuevo contrato**: Si un contrato se da de baja a mitad de año para firmar otro distinto, no existe "perdón automático": el contrato saliente liquida/regulariza sus días reales frente a sus 365 días, y el contrato entrante inicia su propio ciclo de 365 días.

### 1.5 Fechas en Calendario `Europe/Madrid` (Inmunidad DST)
Todas las comparaciones de meses y restas de días del motor (`CommissionEngine.ts`) proyectan los `Date` a fecha civil `YYYY-MM-DD` en zona horaria `Europe/Madrid` antes de operar en UTC puro (`toMadridYmd` / `toMadridDayUtcMs`). Esto elimina desajustes de +/- 1 día provocados por cambios de hora de verano/invierno (días de 23h o 25h) o por timestamps almacenados como `22:00:00Z` / `23:00:00Z`.

---

## 2. Configuración de Parrillas (`/comisiones-config` y `/canales`)

La jerarquía de configuración sigue el esquema: **Marca -> Nivel de Comisión (`CommissionTier`) -> Reglas (`CommissionRule`)**, asignando cada Canal Comercial (`Channel.commissionTierId`) a un Nivel de su misma marca.

### 2.1 Gestión de Niveles (`CommissionTier`)
* Modificar las reglas de un Nivel actualiza el criterio aplicable a futuras contrataciones o recálculos explícitos de todos los canales suscritos a dicho Nivel.
* **Duplicación de Niveles**: Clona en un clic todas las reglas (incluidos sus vínculos con productos y servicios adicionales específicos), creando un nivel nuevo sin canales asignados.

### 2.2 Reglas y Sistema de Puntuación por Especificidad (`matchBestCommissionRule`)
Cada regla define condiciones opcionales y un modo de pago (`POWER_TIERS` para importe fijo en € o `MARGIN_PERCENTAGE` para % sobre margen).

#### Reglas de Energía (Suministro)
Se evalúan únicamente reglas que **no** estén restringidas exclusivamente a Servicios Adicionales:
1. **Tarifa específica** (`tariff`, ej. `2.0TD`, `3.0TD`, `3.0TDVE`, `6.1TD`, `6.1TDVE`, `6.2TD`, `6.3TD`, `6.4TD`): Si no coincide con la tarifa del contrato, se descarta. Si coincide -> **`+1 punto`**.
2. **Tipo de producto** (`productType`):
   * Coincidencia genérica (`Fijo` captura cualquier fijo; `Indexado` captura `Indexado Estándar` e `Indexado Personalizable`) -> **`+1 punto`**.
   * Coincidencia exacta de subtipo (`Indexado Estándar` o `Indexado Personalizable`) -> **`+2 puntos`**.
3. **Tramo de potencia contratada máxima** (`maxPower = max(P1C..P6C)`):
   * Límite inferior inclusivo (`maxPower >= powerMin`) -> **`+1 punto`**.
   * Límite superior **estricto** (`maxPower < powerMax`) -> **`+1 punto`**. *(Permite encadenar tramos contiguos `0 a 5` y `5 a 10` sin solapamiento en `5,00 kW`).*
4. **Producto específico** (`products` seleccionados en la regla): Si la regla tiene productos marcados y el contrato no pertenece a ninguno de ellos, se descarta. Si coincide -> **`+100 puntos`** (prioridad absoluta sobre reglas genéricas).

*(En la UI de `RuleModal` se dispone de botones **"Seleccionar todos" / "Borrar todos"** tanto en Productos Específicos —filtrados por tarifa y tipo— como en Servicios Adicionales).*

#### Reglas de Servicios Adicionales (`matchBestServiceRule`)
Para cada servicio activo en `Contract.additionalServices`, el motor busca reglas que apunten explícitamente a ese servicio (`+50 puntos` base + puntos por tarifa/tipo de producto si la regla también los restringe):
* Si la regla ganadora es `POWER_TIERS`: suma `value` (€ fijos) por ese servicio.
* Si la regla ganadora es `MARGIN_PERCENTAGE`: calcula el margen anual fijo de 12 meses del servicio `max(0, precioVentaMensual - costeMensual) * 12` y aplica `value %`.

---

## 3. Cálculo Automático y Recálculo Manual

### 3.1 Cálculo Automático en el Ciclo de Vida del Contrato
El motor central [`calculateAndSnapshotContractCommission`](file:///c:/Users/Administrator/sp-erp-comercializadoras/src/lib/services/CommissionEngine.ts) se ejecuta automáticamente para que ningún contrato quede con comisión a `0 €` por olvido operativo:
1. **Conversión de Oferta/Lead a Contrato** y **Rehacer Contrato** (`contractActions.ts`): Guarda los snapshots del producto/oferta y calcula la comisión inicial.
2. **Renovaciones Tácitas y Expresas** (`renovacionesActions.ts` y cron `/api/cron/activate-renewals`): Congela los snapshots del producto renovado (heredando el consumo anual del suministro si procede) y calcula la comisión de la nueva anualidad.
3. **Activación por Switching CNMC o Edición de Fechas/Ficha** (`switchingIngest.ts`, `contractActions.ts`): Al pasar a `ACTIVO`, ejecuta el cálculo en modo `{ onlyIfEmpty: true }`, calculando la comisión únicamente si aún no estaba informada y respetando siempre cualquier importe ya fijado o editado manualmente.
4. **Modificaciones (`M1`, `M2`)** (`contractModification.ts`): Heredan íntegramente los snapshots y comisiones de la versión precedente.

### 3.2 Fórmulas de Cálculo Inicial (Anualidad de 365 Días)
* **Modo `POWER_TIERS` (Importe Fijo €)**:
  `commissionEnergy = rule.value`
* **Modo `MARGIN_PERCENTAGE` (% sobre Margen Anual Estimado)**:
  * `Margen Energía Anual (€) = (annualConsumption_kWh / 1000) * marginFC_snapshot` *(acotado a `>= 0` para comisión inicial)*.
  * `Margen Potencia Anual (€) = sum_{i=1..6} (PiC_kW * IPi_snapshot)` *(acotado a `>= 0`)*.
  * `commissionEnergy = (Margen Energía Anual + Margen Potencia Anual) * (rule.value / 100)`.
* **Total Contrato**:
  `commissionTotal = commissionEnergy + commissionServices` y `commissionFinal = commissionTotal` (salvo override manual explícito).

### 3.3 Recálculo Manual en Lote
En `/liquidacion-comisiones`, el botón **"Recalcular"** invoca `recalculateCommissionsBatchAction`, que precarga las reglas en memoria y recalcula en paralelo controlado (concurrencia 10) los contratos base (`V0`) visibles, refrescando sus snapshots e importes en segundos sin provocar errores N+1 ni timeouts.

---

## 4. Liquidaciones Mensuales (`/liquidacion-comisiones`)

La pantalla permite auditar y exportar la liquidación de cualquier mes (`YYYY-MM`), filtrable por canal y buscador libre, operando en dos modalidades:

### 4.1 Filtro de Bajas Prematuras ("Quick Drops")
Si una cadena contractual se activa en el mes `M`, pero causa baja **en o antes de la fecha de corte del mes `M+1`** (por defecto el **día 11 de `M+1`**, o la fecha `customCutoff` indicada en la interfaz), se clasifica como **Alta Fallida (Quick Drop)**:
* **No se paga en Altas** del mes `M`.
* **No genera Decomisión** en el mes de baja (puesto que nunca llegó a liquidarse).
* **No figura en Comisiones Activas**.

### 4.2 Modalidad 1: `Upfront` (Pago 100% en el Alta + Regularización en la Baja)
1. **Tabla de Altas del Mes**:
   * Incluye todas las cadenas cuyo `V0.activationDate` cae en el mes seleccionado (en calendario `Europe/Madrid`) y que superan el filtro de Quick Drops.
   * Liquida el `100%` de `commissionFinal` de la cadena (`V0`).
2. **Tablas de Decomisiones del Mes (`2.0TD` y `Resto Tarifas`)**:
   * Incluye todas las cadenas cuyo contrato vigente finaliza (`terminationDate`) en el mes seleccionado, siempre que no fueran Quick Drop y que hayan permanecido activas **menos de 365 días** (`daysActive < 365`).

#### A) Decomisión en Tarifas `2.0TD` (Prorrateo Lineal Temporal)
* `díasNoCumplidos = 365 - daysActive`
* `Decomisión Bruta = (díasNoCumplidos / 365) * commissionOriginal`
* **Regla del Euro (Umbral Mínimo)**: Si `Decomisión Bruta < 1,00 €`, se perdona (`0,00 €`) y no se reclama. En caso contrario, impacta con signo negativo (`-Decomisión`).

#### B) Regularización ("True-Up") en Resto de Tarifas (`3.0TD`, `6.XTD`, etc.)
En tarifas industriales/pyme comisionadas por margen, la baja anticipada (`daysActive < 365`) recalcula cuánto margen **real** dejó el suministro durante su vigencia efectiva:
1. **Agregación de Facturación Real (`summarizeChainInvoicesForTrueUp`)**:
   * Reúne las facturas oficiales (`Invoice`, cuyo `totalMWh` está en kWh y se divide entre `1000`, excluyendo `PenaltyInvoice`) y, **únicamente cuando el Motor Interno está activo en producción (`isInternalBillingProductionEnabled()`, `ENABLE_INTERNAL_BILLING_PRODUCTION=true`)**, incorpora deduplicadas por número de factura las `InternalInvoice` (`EMITIDA` o `ABONO` con `hidden = false`, cuyo `totalMWh` ya está en MWh), evitando duplicar consumos mientras el motor opera en Fase de Pruebas junto a Ingebau (Reglas 171 y 276).
   * **Abonos y Rectificativas**: Detecta automáticamente facturas con estado `ABONO`, tipos `ABONO`/`RECTIFICAT`/`A`/`AR`/`S` o importes negativos, restando sus MWh y no sumando días adicionales.
   * **Fusión de Intervalos Solapados**: Une los rangos `[startDate, endDate]` de las facturas válidas para que facturas complementarias sobre un mismo periodo nunca dupliquen el denominador de días facturados (`totalInvoicedDays`).
2. **Extrapolación a los Días Activos Reales**:
   * Si existen facturas con días válidos: `realTotalMWh = (totalInvoicedMWh / totalInvoicedDays) * daysActive`.
   * Si causó baja sin llegar a facturar: `realTotalMWh = 0`.
3. **Margen Real de Energía y Potencia**:
   * `Margen Real Energía = realTotalMWh * marginFC_snapshot` *(puede ser negativo si el fee pactado era negativo)*.
   * `Margen Real Potencia`: Pondera por días cada versión (`V0`, `M1`...) activa dentro de la cadena (absorbiendo huecos de 1 día en transiciones de versión) mediante `(díasVersión / 365) * sum(PiC * IPi_snapshot)`.
4. **Comisión Real Ganada y Liquidación de Regularización**:
   * Aplicando el `% de margen` inmutable (`commissionRuleValue`) o, en contratos legacy sin regla porcentual, escalando proporcionalmente el margen real frente al margen teórico inicial, se obtiene `realEarnedCommission` (incluyendo la parte proporcional `daysActive / 365` de servicios adicionales).
   * `Impacto Neto Regularización = realEarnedCommission - commissionOriginal`:
     * Si es **negativo** (`realEarnedCommission < commissionOriginal`): Es una **Decomisión** a descontar al canal (porque consumió menos o estuvo menos tiempo que lo estimado para el año).
     * Si es **positivo** (`realEarnedCommission > commissionOriginal`): Es un **Ajuste Positivo a favor del canal** (si en menos de 365 días el cliente ya consumió más energía real que toda la estimación anual inicial).

### 4.3 Modalidad 2: `Carterizada` (Devengo Mensual `1/365` por Día Activo)
En lugar de adelantar el año entero y decomisionar bajas:
* Ninguna baja genera decomisión retroactiva (`decomisiones = []`).
* Cada cadena activa durante al menos 1 día dentro de su ventana comisionable `[altaV0, altaV0 + 365 días)` que intersecte con el mes liquidado `[inicioMes, finMes]` devenga exactamente los días activos en dicho mes:
  `Comisión Devengada Mes = commissionAnualOriginal * (díasActivosEnElMes / 365)`.
* Si el usuario edita manualmente la comisión de una fila en vista Carterizada, edita siempre la **Comisión Anual Base (`V0`)** y el ERP recalcula al instante la fracción mensual devengada.

---

## 5. Comisiones Activas / Pendientes de Devengar (`/comisiones-activas`)

Esta vista ofrece a Dirección Financiera la foto contable a **cierre del mes seleccionado** de cuánto saldo de comisiones pagadas `Upfront` sigue pendiente de amortizarse por tiempo transcurrido (riesgo vivo de clawback):
1. Agrupa los contratos en sus cadenas reales (`splitContractsIntoCommissionChains`), evitando duplicar `V0 + M1` y evitando perder cadenas cuya última versión esté activa aunque `V0` esté `FINALIZADO` por modificación.
2. Excluye **Quick Drops** y contratos aún no activados al cierre del mes consultado, así como cadenas que ya causaron baja antes o durante dicho mes o que ya superaron sus **365 días**.
3. Calcula en `Europe/Madrid`:
   * `díasConsumidos = FechaCierreMes - FechaAltaV0` (acotado a `0..365`).
   * `díasRestantes = 365 - díasConsumidos`.
   * `Comisión Pendiente de Devengar (€) = commissionFinal * (díasRestantes / 365)`.
4. Desglosa el saldo por **Tarifa**, por **Canal Comercial** y en una **Tabla Detallada de Contratos** con buscador, enlace directo a cada ficha `/contratos/[id]` y exportación a Excel cuadrada a 2 decimales.

---

## 6. Integridad en Pantalla y Exportaciones Excel

1. **Enlaces Directos**: Todos los códigos de contrato en `/liquidacion-comisiones` (las 4 tablas) y `/comisiones-activas` enlazan directamente al detalle `/contratos/[id]` del contrato vigente.
2. **Redondeo Contable Uniforme (`round2`)**: Todas las columnas monetarias en UI y Excel se exportan redondeadas a 2 decimales numéricos para garantizar que el sumatorio de celdas en Excel coincida al céntimo con las tarjetas KPI de cabecera:
   `Total Altas / Devengo + Impacto Neto Regularizaciones = Total Neto a Liquidar`.
3. **Trazabilidad Completa en Excel**: Las hojas exportadas (`Altas_Devengo`, `Decomisiones_2.0TD`, `Decomisiones_Resto` y `Comisiones_Activas`) incluyen `Fecha Alta Original (V0)`, `Fecha Baja Final`, `Días Activos`, `Consumo Estimado MWh`, `Consumo Real Extrapolado MWh`, `Comisión Inicial (€)` e `Impacto Liquidación (€)`.

---

## 7. Mapa de Ficheros Técnicos del Módulo

* `prisma/schema.prisma`: Modelo `CommissionTier` (aislado por `brandId` con `@@unique([name, brandId])`), `CommissionRule` y columnas de snapshot inmutable en `Contract` (`marginFC`, `ip1..ip6`, `productTypeSnapshot`, `commissionRuleType`, `commissionRuleValue`).
* `src/lib/services/CommissionEngine.ts`: Motor matemático centralizado (fechas civiles `Europe/Madrid`, extracción de snapshots preservando `0` y negativos, puntuación de reglas, `calculateAndSnapshotContractCommission`, `splitContractsIntoCommissionChains`, `isQuickDropChain` y `summarizeChainInvoicesForTrueUp`).
* `src/app/actions/liquidacionActions.ts` y `src/app/(app)/liquidacion-comisiones/*`: Consultas optimizadas en lote de Altas, Decomisiones (`2.0TD` y True-Up `Resto`), modo `Carterizada`, recálculo masivo (`recalculateCommissionsBatchAction`), edición anual sobre `V0` y exportación Excel cuadrada.
* `src/app/actions/comisionesActions.ts` y `src/app/(app)/comisiones-activas/*`: Cálculo de saldo vivo pendiente de amortizar a cierre de mes sobre cadenas deduplicadas sin Quick Drops, tabla auditable y exportación Excel.
* `src/app/(app)/comisiones-config/*`, `src/app/api/commission-tiers*`, `src/app/api/commission-rules*` y `src/components/Sidebar.tsx`: Configuración de niveles y reglas aislada por marca activa y restringida por RBAC a `SUPERADMIN` y `COMPANYADMIN`.
* `src/app/actions/contractActions.ts`, `src/app/actions/renovacionesActions.ts`, `src/app/actions/contractModification.ts`, `src/app/actions/switchingIngest.ts` y `src/app/api/cron/activate-renewals/route.ts`: Enganches automáticos de snapshot y cálculo de comisiones a lo largo del ciclo de vida del contrato.
* `src/app/actions/leadActions.ts` (`estimateLeadCommissionAction`), `src/app/api/products/route.ts` y `src/app/(app)/leads/NewLeadModal.tsx`: Cálculo confidencial en servidor de **«Tu Comisión Estimada (12 meses)»** durante la creación/edición de Ofertas y Altas Luz sin exponer márgenes mayoristas al cliente web.
