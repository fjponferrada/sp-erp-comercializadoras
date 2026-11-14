# Motor de Facturación Interna y Áreas Asociadas

Esta guía documenta en detalle la arquitectura, el flujo de cálculo, la fiscalidad territorial y las reglas de negocio del **Motor de Facturación Interna** ([`src/lib/services/InternalBillingEngine.ts`](../src/lib/services/InternalBillingEngine.ts)) y su capa de mapeo y persistencia ([`src/lib/services/internalInvoiceMapper.ts`](../src/lib/services/internalInvoiceMapper.ts)), así como sus endpoints API, plantillas PDF/XML y pantallas operativas (`/facturacion/interna` y `/facturas-internas`).

---

## 1. Arquitectura General y Módulos Implicados

| Archivo / Ruta | Responsabilidad Principal |
| :--- | :--- |
| [`src/lib/services/InternalBillingEngine.ts`](../src/lib/services/InternalBillingEngine.ts) | Núcleo matemático de facturación (`InternalBillingEngine.calculate`): cruce F1/CCH, perfilado REE, peajes/cargos diarios, mercado/fijo, reactiva/capacitiva, autoconsumo y Bolsillo Solar, SVA, IEE, IVA/IGIC/IPSI e inversión de abonos (`invertBillingResult`). |
| [`src/lib/services/internalInvoiceMapper.ts`](../src/lib/services/internalInvoiceMapper.ts) | Capa unificada de tipificación CNMC (`deduceInvoiceType`), serialización de `invoiceData` (`buildInternalInvoiceJsonData`), formateo horario `Europe/Madrid` inclusivo y carga de metadatos corporativos/técnicos (`buildInvoiceTemplateData`). |
| [`src/app/api/facturacion/interna/calculate/route.ts`](../src/app/api/facturacion/interna/calculate/route.ts) | Generación inicial de borradores (`InternalInvoice`) a partir de `F1Invoice` pendientes, con control anti-duplicados y asignación de `companyId`. |
| [`src/app/api/facturacion/interna/recalculate/route.ts`](../src/app/api/facturacion/interna/recalculate/route.ts) y [`repair/route.ts`](../src/app/api/facturacion/interna/repair/route.ts) | Recálculo individual o masivo y reparación de borradores con paridad total de campos y estado (`BORRADOR` vs `REQUIERE_REPARACION`). |
| [`src/app/api/facturacion/interna/export-excel/[draftId]/route.ts`](../src/app/api/facturacion/interna/export-excel/%5BdraftId%5D/route.ts) | Exportación de auditoría cuarto-horaria (`.xlsx`) ejecutando el motor al vuelo con `forceRepair = true` y `returnHourlyDetails = true` en zona `Europe/Madrid`. |
| [`src/app/api/facturacion/interna/proforma/[draftId]/route.ts`](../src/app/api/facturacion/interna/proforma/%5BdraftId%5D/route.ts) | Renderizado en streaming del PDF Proforma/Emitido mediante `buildInvoiceTemplateData` + `InvoicePdfTemplate`. |
| [`src/app/api/facturacion/interna/confirm/route.ts`](../src/app/api/facturacion/interna/confirm/route.ts) | Emisión definitiva en transacción con numeración correlativa por sociedad (`INT-YY-XXXX` / `AB-YY-XXXX`), subida de PDF y XML a Cloudflare R2 y promoción automática (Fase 5) a `Invoice`. |
| [`src/components/pdf/InvoicePdfTemplate.tsx`](../src/components/pdf/InvoicePdfTemplate.tsx) y [`src/lib/templates/invoiceXmlTemplate.ts`](../src/lib/templates/invoiceXmlTemplate.ts) | Plantilla PDF de 2 páginas conforme a `.agents/AGENTS.md` (8 secciones reglamentarias) y generador XML estructurado con escapado de entidades y desglose completo. |
| [`src/app/(app)/facturacion/interna/*`](../src/app/(app)/facturacion/interna/page.tsx) y [`src/app/(app)/facturas-internas/*`](../src/app/(app)/facturas-internas/page.tsx) | Interfaz de cálculo, revisión por tipología CNMC (`N`, `R`, `A`, `C`, `G`), confirmación e histórico paginado con RBAC multi-marca (`getInvoiceVisibilityFilter`). |

---

## 2. Pipeline de Ejecución (`InternalBillingEngine.calculate`)

El método principal `InternalBillingEngine.calculate(f1Id: string, forceRepair = false, returnHourlyDetails = false)` ejecuta secuencialmente las siguientes etapas con **precisión comercial céntimo a céntimo (`round2`)**:

1. **Carga Contextual y Huso Horario (`Europe/Madrid`)**:
   - Carga `F1Invoice`, `Contract` (con `Product`, `AdditionalService` y `Brand -> Company`) y `SupplyPoint` (con `Client`).
   - Convierte `f1.fechaInicio` y `f1.fechaFin` al calendario local peninsular (`Europe/Madrid`) evitando cualquier desfase `-1 día` derivado de marcas UTC `22:00Z` / `23:00Z` (Regla 170), y calcula `billingDays` entero a prueba de cambios de hora DST (23h / 25h) y años bisiestos (`365` vs `366` días).
   - Detecta si se trata de una factura de **Abono** (`A`, `AR`, `S`): si existe la factura original `N`/`R` en base de datos, clona su resultado (o la recalcula con detalle horario si se solicita Excel) y le aplica una única vez [`invertBillingResult`](../src/lib/services/InternalBillingEngine.ts).
   - Detecta documentos **`<OtrasFacturas>`** (derechos de acometida, enganche, verificación, depósitos, inspección) ejecutando un flujo *pass-through* directo sin exigir curva horaria.

2. **Extracción Exhaustiva del XML F1 (`Facturacion.xsd` CNMC)**:
   - **Energía Activa y Lecturas**: Suma todos los tramos de `TerminoEnergiaActiva` (incluyendo múltiples sub-periodos en facturas Regularizadoras Tipo `G`, Regla 201), lecturas de contador y `ModeloAparato.NumeroSerie`.
   - **Potencia Facturada**: Extrae `Potencia.TerminoPotencia` convirtiendo vatios enteros CNMC a `kW` (`parseCnmcPowerKw`), además de `ExcesosPotencia`, `PenalizacionNoICP` y `RecargoInfAnio`.
   - **Reactiva, Capacitiva, Intereses y Conceptos Repercutibles**: Lee `EnergiaReactiva` (con fallback a Circular 3/2020 en tarifas `!= 2.0TD` sobre P1–P5 eximiendo P6), `EnergiaCapacitiva`, `ImporteIntereses` y el catálogo oficial de `<ConceptoRepercutible>` (Tabla 103 y Tabla 114 CNMC, separando conceptos gravados de suplidos/fianzas exentas `TipoImpositivo = '3'` e ignorando códigos informativos `51..82` y cortes E2 no repercutibles `88..91`).

3. **Cruce de Curva Cuarto-Horaria (`LoadCurve`) y Auto-Ajuste con Perfiles REE**:
   - Clasifica cada cuarto de hora en su periodo tarifario (`P1`–`P6`) mediante `getPeriodoREE`, que contempla los **9 festivos nacionales fijos no sustituibles** y los calendarios horarios específicos de **Península/Baleares**, **Canarias** y **Ceuta/Melilla** (Circular 3/2020).
   - Indexa `ReeProfile` en un `Map` `O(1)` (`p20td`, `p30td`, `pSolar`).
   - **Consumo**: Si falta curva o difiere del F1 y `forceRepair = true`, escala por periodo (`P1`–`P6`) cuando existen lecturas parciales o sintetiza/perfila con `p20td`/`p30td` los periodos ausentes (ej. ciclos con días finales pendientes de curva), dejando trazabilidad exacta en `repairData`.
   - **Excedentes**: Si no hay curva `SURPLUS`, reparte con `pSolar` respetando ceros nocturnos (Regla 173); si existe con descuadre, aplica escalado proporcional global (Regla 174).

4. **Término de Potencia y Prorrateo Diario de Costes Regulados**:
   - Resuelve `RegulatedCost` fecha a fecha para contemplar cambios regulatorios a mitad de ciclo.
   - Normaliza el precio unitario de potencia del contrato a **`€/kW/día`** (`yearlyPrice / daysInYear`), separando en cada periodo `Peajes potencia`, `Cargos potencia` y `powerMargin`.

5. **Término de Energía (Indexado vs. Precio Fijo) y Elevación a Barras de Central**:
   - **Indexado**: Eleva el consumo cuarto-horario a Barras de Central aplicando `lossFactor = 1 + (perdBase * KHorario)` sobre mercado (`OMIE + componentes COMPODEM + ROM + ROS + PC + DSV`) y sobre el `FEE` comercial, sumando `FNEE` y separando el `ATR Energía` (`Peajes energía` + `Cargos energía`).
   - **Precio Fijo**: Respeta los snapshots contractuales `p1e..p6e` (con fallback a `airtableData`, Reglas 12 y 152), descuenta el ATR de referencia a la firma (`refAtr`) y traslada las variaciones regulatorias (`diffFnee`, `diffPc`, `diffRom`, `diffRos`, Reglas 176 y 179). Calcula `energyMargin` tras consolidar el ingreso fijo y fija `feeCost = round2(energyMargin + powerMargin)`.

6. **Autoconsumo RD 244/2019 y Ciclo Completo de Bolsillo Solar**:
   - Valora los excedentes vertidos (`pexc` fijo o precio horario OMIE menos `feeExcedentes`) y aplica como descuento pre-impuestos hasta el tope legal del coste de energía activa consumida (`maxExcedentes`).
   - Si el contrato tiene **Bolsillo Solar** activo (`contract.bolsilloSolar === true`, Regla 207):
     - Repercute `cgBolsilloSolarCost` prorrateado por días (`(cgBolsilloSolar * 12 / 365) * billingDays`).
     - Acumula el excedente sobrante en `bolsilloSolarLlenado`.
     - Recupera el `bolsilloSolarSaldoInicial` de la última factura emitida del suministro (`InternalInvoice` o histórico `Invoice`).
     - Aplica `bolsilloSolarUso` como descuento comercial **post-IVA** (Consulta Vinculante AEAT V0588-21) hasta `totalSinDescuentoBolsillo`, actualizando `bolsilloSolarSaldoFinal`.

7. **Bono Social Diario, SVA Híbrido, Impuesto Eléctrico e Impuestos Territoriales**:
   - **Bono Social**: Prorratea día a día contra `RegulatedDailyCost` (`concept = 'Bono_Social'`), combinando tramos si el ciclo cruza dos Órdenes Ministeriales (ej. `TED/1487/2024` y `TED/634/2026`) y generando `bonoSocialLabel`.
   - **SVA Híbrido (Regla 175)**: Unifica sin duplicar `contract.additionalServicesSnapshot` y la relación `contract.AdditionalService` (con fallback a `svaPrice`/`svaDuration`), prorrateando cada servicio por los días exactos de solapamiento con su vigencia.
   - **Impuesto Especial sobre la Electricidad (LIIEE Arts. 91.1, 94, 98 y 99)**:
     - Base `baseIEE = TPA + TEA + TER + Excesos + Penalizaciones - Excedentes compensados` (aplicable también en Canarias, Ceuta y Melilla).
     - `SBFI` / `SBFO`: `5,11269632%` con suelo mínimo legal (`0,50 €/MWh` industrial / `1,00 €/MWh` otros usos).
     - `98.1A`–`98.1D`: Reducción `85%` **sin** cuota mínima legal.
     - `98.1E`–`98.1F`: Reducción `85%` **con** suelo de cuota mínima.
     - `98.2`–`98.3`: Reducción `100%` tributando exclusivamente por cuota mínima (`0,50 €/MWh`).
     - `94.1`–`94.10`: Exención plena (`0,00 €`).
   - **Impuestos Indirectos Territoriales (`taxBreakdown`)**:
     - **Península y Baleares (`IVA`)**: `21%` sobre `totalBase`.
     - **Canarias (`IGIC`)**: `0%` en energía para personas físicas con `2.0TD` y potencia `<= 10 kW` (`3%` en resto de suministros) y `7%` sobre servicios/alquileres.
     - **Ceuta y Melilla (`IPSI`)**: `1%` sobre electricidad y `4%` sobre servicios/alquileres.

---

## 3. Desglose Visual PDF y Estructuración XML

- **Paridad 100% Proforma ↔ Confirmación**: Tanto `/api/facturacion/interna/proforma/[draftId]` como `/api/facturacion/interna/confirm` construyen sus datos mediante `buildInvoiceTemplateData(invoice)`, inyectando razón social, CIF, dirección y canales de atención reales de `Company`/`Brand`, distribuidora y teléfono gratuito de averías desde `Distributor`, `CNAE`, `NumeroSerie` del contador, referencia de contrato ATR del F1 e IBAN enmascarado.
- **Fechas de Periodo Inclusivas**: Respetando que en base de datos `fechaFin` se almacena desplazada `+1 día` a las `00:00 Europe/Madrid` (Regla 170), las vistas UI, el PDF, el XML y el Excel muestran el último día natural incluido en el ciclo (`fechaFin - 12h` en zona `Europe/Madrid`).
- **Cumplimiento de `.agents/AGENTS.md` en `InvoicePdfTemplate.tsx`**: Cabecera **`Concepto | Cantidad | Días | Precio Ud | Total €`** y separación rigurosa en 8 secciones (Potencia en `€/kW/día` con subtexto de peajes/cargos, ATR Energía, Energía Activa, Excesos de Potencia, Excedentes RD 244/2019, Impuestos y Regulados/SVA/Repercutibles, Totales con `IVA`/`IGIC`/`IPSI` y tabla condicional **Tu Bolsillo Solar en esta Factura**).

---

## 4. Numeración Secuencial Multi-Sociedad y Promoción Fase 5

Al confirmar borradores en `/api/facturacion/interna/confirm`:
1. Dentro de una transacción atómica en base de datos, el motor resuelve el `companyId` de cada borrador y calcula el máximo numérico real existente para esa sociedad bajo los prefijos `INT-YY-` (facturas positivas) y `AB-YY-` (abonos / importes negativos), asignando numeración correlativa sin colisiones entre distintas comercializadoras del SaaS ni errores de ordenación al superar `9999`.
2. Genera y sube el XML y el PDF a Cloudflare R2 bajo `facturas/internas/<CIF_Sociedad>/20YY/<NumeroFactura>.{pdf,xml}`.
3. **Promoción Fase 5**: Sincroniza automáticamente el recibo confirmado en la tabla maestra `Invoice` (`origin: 'INTERNAL_ENGINE'`, `totalMWh` convertido a `kWh` conforme a la Regla 81 y metadatos fiscales completos en `invoiceData`), quedando inmediatamente disponible en `/facturas`, en el **Modelo 560** (`/impuestos/electrico`) y en la **Tasa Municipal del 1,5%** (`/impuestos/municipal`).
