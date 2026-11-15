# Guía Maestra de Impuestos y Tasas (ERP Comercializadoras)

Esta guía documenta toda la lógica de negocio, arquitectura, validaciones preventivas e integraciones implementadas en el ERP para la autoliquidación del Impuesto Especial sobre la Electricidad (**Modelo 560 AEAT y Haciendas Forales**) y los tributos locales (**Tasa Municipal del 1,5%**).

Las reglas descritas a continuación son de obligado cumplimiento conforme a la **Ley 38/1992 (LIIEE)**, la **Orden HAC/172/2021**, las especificaciones técnicas de validación de la AEAT (`INST_CUMPL_560` y `Desg560V2`) y el **TRLRHL (Art. 24.1.c)**.

---

## 1. ARQUITECTURA TRANSVERSAL Y COMPONENTES IMPLICADOS

| Módulo / Archivo | Responsabilidad Principal |
| :--- | :--- |
| [`src/lib/taxUtils.ts`](../src/lib/taxUtils.ts) | Motor fiscal centralizado: husos horarios `Europe/Madrid`, resolución territorial (`resolveTaxZone`), validación de CIE (`validateCieForRegimen`), motor del Modelo 560 (`computeModelo560`) y cruce difuso municipal (`matchesMunicipality`). |
| [`src/lib/postalCode.ts`](../src/lib/postalCode.ts) y [`src/lib/prisma.ts`](../src/lib/prisma.ts) | Blindaje universal de 4 capas para Códigos Postales españoles de 5 dígitos (`01001..52999`): normalización (`normalizeSpanishPostalCode`, `getSpanishPostalPrefix`), guardián global ORM `$extends` (`attachPostalCodeGuard`) y triggers nativos PostgreSQL (`fn_normalize_spanish_cp_text`). |
| [`src/lib/permissions.ts`](../src/lib/permissions.ts) | Helper multi-marca [`getActiveBrand`](../src/lib/permissions.ts) que resuelve la marca activa desde la cookie `active-brand` verificada contra `allowedBrands` (con soporte completo para `SUPERADMIN`). |
| [`src/app/api/impuestos/electrico/route.ts`](../src/app/api/impuestos/electrico/route.ts) | API de cálculo trimestral del Modelo 560 por zonas fiscales (`España`, `Navarra`, `Álava`, `Guipúzcoa`, `Vizcaya`), modos (`oficial` / `neteado`), ajuste de céntimos y detección de tipos históricos. |
| [`src/app/api/impuestos/electrico/export/route.ts`](../src/app/api/impuestos/electrico/export/route.ts) | Generador del fichero oficial `.TXT` de 12 columnas terminadas en `;` conforme a `Desg560V2`, con soporte para filtro de tipo histórico (`?rate=`) y CIE declarante (`?cie=`). |
| [`src/app/(app)/impuestos/electrico/ElectricoClient.tsx`](../src/app/(app)/impuestos/electrico/ElectricoClient.tsx) | Interfaz del Modelo 560 con selectores de ámbito (`Marca activa` / `Toda la Comercializadora`), modo AEAT, CIE declarante por zona, panel de alertas preventivas y **Cuadro de Liquidación Casillas `(1)` a `(6)`** con copiado en 1 clic sin puntos de miles. |
| [`src/app/(app)/puntos-suministro/EditSupplyPointModal.tsx`](../src/app/(app)/puntos-suministro/EditSupplyPointModal.tsx) y [`src/app/actions/supplyPointActions.ts`](../src/app/actions/supplyPointActions.ts) | Autocompletado del `% Reducción IE` según régimen LIIEE, pistas visuales de clave de actividad del CIE y validación estricta en servidor (`validateCieForRegimen`) al guardar el Punto de Suministro. |
| [`src/app/api/impuestos/municipal/route.ts`](../src/app/api/impuestos/municipal/route.ts), [`poblaciones/route.ts`](../src/app/api/impuestos/municipal/poblaciones/route.ts) y [`src/app/(app)/impuestos/municipal/page.tsx`](../src/app/(app)/impuestos/municipal/page.tsx) | Liquidación y exportación Excel (Agrupada y Detallada con fila `TOTAL`) de la Tasa Municipal del 1,5%, desambiguación provincial (`MUNICIPIO -- PROVINCIA`), energía en MWh reales y redondeo comercial a 2 decimales. |
| [`src/lib/services/InternalBillingEngine.ts`](../src/lib/services/InternalBillingEngine.ts) y [`src/app/api/facturacion/interna/confirm/route.ts`](../src/app/api/facturacion/interna/confirm/route.ts) | Cálculo normativo del Impuesto Eléctrico por régimen (`94.x`, `98.1A–D`, `98.1E–F`, `98.2–98.3`, `SBFI`/`SBFO`) y **Promoción Fase 5** a `Invoice` (`origin: 'INTERNAL_ENGINE'`) al confirmar facturas internas. |

---

## 2. MODELO 560 (IMPUESTO ESPECIAL SOBRE LA ELECTRICIDAD)

Toda la lógica de cálculo de casillas y generación de ficheros `.TXT` está centralizada en [`src/lib/taxUtils.ts`](../src/lib/taxUtils.ts), garantizando **identidad matemática del 100%** entre la pantalla (`/impuestos/electrico`), las Casillas `(1)` a `(6)` de la carátula web AEAT y el fichero `.TXT` exportado (`/api/impuestos/electrico/export`).

### 2.1 Ámbito Territorial y Exclusión de Zonas Forales (Art. 91.1 LIIEE)
- **Territorio Común (AEAT Estatal — Zona `España`):** Incluye toda la Península, Baleares, **Canarias (`CP 35`, `38`), Ceuta (`CP 51`) y Melilla (`CP 52`)**. Conforme a los artículos 91.1 y 97 LIIEE, Canarias, Ceuta y Melilla **sí están sujetos** al Impuesto Eléctrico y se autoliquidan ante la AEAT Estatal tomando como base la base teórica de IVA peninsular excluido el propio IE (con independencia de que en factura repercutan IGIC o IPSI).
- **Exclusión Estricta de Territorios Forales:** El bloque `España` excluye matemáticamente los suministros radicados en **Navarra (`CP 31`)** y **País Vasco (`CP 01` Álava, `20` Guipúzcoa y `48` Vizcaya)**, separándolos en 4 bloques forales independientes para su liquidación ante cada Hacienda Foral con su CIE foral correspondiente.
- **Detección multicapa y blindaje de Códigos Postales de 5 dígitos (`01001..52999`):** Se comprueba el Código Postal y provincia de `SupplyPoint` con *fallback* automático a `invoiceData['CP PS']` y `invoiceData['PROVINCIA PS']`, pasando siempre por `normalizeSpanishPostalCode` / `getSpanishPostalPrefix` ([`src/lib/postalCode.ts`](../src/lib/postalCode.ts)), reforzado por triggers PostgreSQL (`fn_normalize_spanish_cp_text`) y guardián Prisma `$extends`. Esto impide que códigos postales de 4 dígitos procedentes de Excel/Airtable sin cero inicial (`"1001"` Álava, `"5230"` Ávila, `"3510"` Alicante) escapen de la Hacienda Foral de Álava (`01`) o se clasifiquen erróneamente como Melilla (`52`), Ceuta (`51`) o Canarias (`35`/`38`).
- **Selector de Ámbito (`scope=brand|company`):** Respeta por defecto la marca activa (`active-brand`) y permite conmutar en la cabecera a **Toda la Comercializadora (`companyId`)**, dado que el sujeto pasivo ante la AEAT y Haciendas Forales es el NIF/CIE único de la sociedad mercantil (`Company`).

### 2.2 Extracción Real Factura a Factura y Separación de Tipos Impositivos
- **Prohibido aplicar porcentajes a bulto:** La cuota agregada **NUNCA** se calcula multiplicando la suma bruta de bases por un porcentaje fijo. Se extrae factura a factura (`Importe Impuesto CORR` / `Importe Impuesto` o `taxAmount`), deduplicando por `invoiceNumber`, invirtiendo signos en facturas de `Abono`, excluyendo facturas de penalización sin suministro y aplicando corte horario estricto en zona `Europe/Madrid` (`getQuarterMadridBounds`).
- **Prohibición AEAT de mezclar tipos impositivos (`INST_CUMPL_560` pág. 1):** Los hechos imponibles gravados a tipos históricos reducidos (`0,5%`, `2,5%`, `3,8%` de refacturaciones o abonos de periodos anticrisis) **no pueden mezclarse** en una autoliquidación al `5,11269632%`. El motor separa automáticamente cualquier factura/abono a tipo histórico, muestra un banner de advertencia en UI y habilita botones específicos de descarga `.TXT` por tipo (`?rate=0.5`, `?rate=2.5`, `?rate=3.8`).

### 2.3 Regímenes Legales, Detección de Cuota Mínima y Validación Preventiva de CIE (Arts. 94, 98 y 99 LIIEE)
- **Comportamiento exacto por régimen fiscal (`REGIMEN_560_META` e `InternalBillingEngine`):**
  - `SBFI` (Usos industriales, mínimo `0,50 €/MWh`) y `SBFO` (Otros usos, mínimo `1,00 €/MWh`): Tributan al `5,11269632%` sobre el 100% de la base salvo cuando la cuota mínima supera a la porcentual.
  - `98.1A`, `98.1B`, `98.1C`, `98.1D`: Reducción del **85%** (base liquidable = `15%`) **SIN cuota mínima legal** (Art. 99.2 excluye expresamente las letras a, b, c y d del Art. 98.1).
  - `98.1E` (Riegos agrícolas) y `98.1F`: Reducción del **85%** (base liquidable = `15%`) **CON suelo de cuota mínima** (`0,50 €/MWh` o `1,00 €/MWh`).
  - `98.2` (Embarcaciones con suministro eléctrico desde tierra) y `98.3` (Transporte ferroviario): Reducción del **100%** sobre la base imponible, liquidándose **siempre por cuota mínima de `0,50 €/MWh`** (Casillas 4 y 5 / Columna 12).
  - `94.1` a `94.10` (Exenciones): Cuota `0,00 €` (excluidos de las Casillas 1 a 6 del Cuadro de Liquidación, pero declarados obligatoriamente en kWh/MWh dentro del `.TXT` de desglose).
- **Detección exacta de `isMinApplied`:** Prioriza el indicador explícito `Minimo Importe IE Superado` (`false`/`0`). En su ausencia, compara la cuota real repercutida contra la cuota porcentual teórica calculada sobre la **base liquidable reducida**, evitando falsos positivos en riegos agrícolas (`98.1E`).
- **Agregación y Validación Preventiva del CIE (`13 caracteres ES000XXYYZZZW`):**
  - `94.1–94.4` y `94.10`: Se agregan en **1 línea por régimen y signo**, dejando vacíos NIF y CIE del destinatario.
  - `94.5–94.9`, `98.1A–F`, `98.2` y `98.3`: Se agrupan en **1 línea por `(régimen, NIF destinatario, CIE destinatario, tensión, concepto, signo, modalidad %/mínimo)`**.
  - **Doble barrera de validación de CIE:** Tanto al editar un Punto de Suministro (`EditSupplyPointModal` + `updateSupplyPointAction`) como antes de exportar el `.TXT` del Modelo 560, `validateCieForRegimen` verifica longitud exacta de 13 caracteres y correspondencia de los **caracteres 8–9 (clave de actividad)** con el régimen declarado: `L3` comercializadora declarante, `LA` (`98.1E` riegos), `LV` (`98.1F`), `LQ`/`LM`/`LE`/`LI` (`98.1A–D`), `L0`/`LO` (`94.5`), `LP` (`94.6`), `L1`/`L7` (`94.7`).

### 2.4 Cumplimiento Estricto del Validador Web AEAT y Controles Operativos en UI
- ✅ **ESTADO: 100% IMPLEMENTADO Y OPERATIVO (`src/lib/taxUtils.ts` + `ElectricoClient.tsx`)**
- **Formato exacto de 12 campos terminados en `;` (`Desg560V2` y `ANEXO: TABLA`):**
  1. Todas las líneas terminan con `;` tras el campo 12 (con campo opcional de **CIE Declarante** personalizable por zona fiscal en pantalla antes de descargar el `.TXT`).
  2. Las casillas marcadas como `NO` en el Anexo de la AEAT (como *Reducción* Col. 4 en `SBFO`/`SBFI`/`94.x`, o la columna de cuota no aplicable) se exportan **estrictamente vacías** (`;;`), nunca con `0.00`.
  3. **Desdoble automático Art. 99.1 (%) vs. Art. 99.2 (Mínimos):** `SBFI`, `SBFO` y `98.1E–F` nunca mezclan Columna 11 y Columna 12 en la misma fila. En suministros en mínimo (`Art. 99.2`), se emite línea independiente con `Base Liquidable = 0.00`, Columna 11 vacía y Columna 12 rellena.
- **Cuadro de Liquidación Interactivo Casillas `(1)` a `(6)` (Prevención Error `39621`):**
  - La interfaz muestra las 6 casillas oficiales de la carátula AEAT formateadas **sin puntos de miles y con coma decimal** (ej. `630991,32`) con botón de copiado directo al portapapeles en 1 clic.
- **Red de Seguridad de Céntimos (Prevención Errores `39641` / `39652`) y Modo Contingencia:**
  - Con el check **"Ajuste auto céntimos AEAT"** activo (por defecto), si la suma de cuotas individuales redondeadas factura a factura difiere en algún céntimo de `trunc/round(Casilla 2 × 5,11269632%)`, el motor ajusta automáticamente los céntimos indispensables en la Base Imponible/Liquidable del bloque general (`SBFO`/`SBFI`) y muestra en pantalla el ajuste exacto aplicado (`Δ base`) para archivar en el papel de trabajo contable.
  - Incluye selector de **Modo Contingencia AEAT (`neteado`)** para trimestres excepcionales en los que abonos de cuota mínima dejen la `Casilla (5)` en negativo y la Sede Electrónica rechace el envío.

---

## 3. TASA MUNICIPAL (1,5% POR UTILIZACIÓN PRIVATIVA — ART. 24.1.c TRLRHL)

### 3.1 Seguridad, Ámbito Multi-Marca y Zona Horaria
- Tanto `/api/impuestos/municipal` como `/api/impuestos/municipal/poblaciones` validan sesión activa con `auth()`, aplican `getActiveBrand(session.user)` con soporte de ámbito `Marca activa` o `Toda la Comercializadora` (`scope=brand|company`), y acotan las fechas `dateFrom` / `dateTo` en huso horario estricto `Europe/Madrid` (`getDateRangeMadridBounds`).

### 3.2 Algoritmo Híbrido de Cruce de Municipios sin Pérdida de Datos
- **Desambiguación de homónimos provinciales:** El selector de poblaciones devuelve valores compuestos `MUNICIPIO -- PROVINCIA`, impidiendo mezclar ayuntamientos homónimos de distintas provincias.
- **Pre-filtrado híbrido sin pérdida de histórico y CP normalizado:** La consulta en base de datos incluye los `SupplyPoint` cuyo municipio coincide **más** aquellos suministros con `city` vacía/nula o facturas con `supplyPointId = null`, evaluando después en memoria `supplyPoint.city || invoiceData['POBLACION PS']` (ignorando siempre `POBLACION SOC`, dado que el punto de conexión es el lugar de suministro) y normalizando `CP PS` a 5 dígitos españoles mediante `normalizeSpanishPostalCodeOrNull`.
- **Prevención de falsos positivos en topónimos cortos (`matchesMunicipality`):** Exige coincidencia de palabra completa o distancia de Levenshtein graduada por longitud de token y validación de nombres bilingües oficiales separados por `/`, impidiendo que `"MORA"` coincida con `"ZAMORA"` o `"VERA"` con `"TALAVERA"`, pero manteniendo coincidencias compuestas y con erratas como `"LOSPITALET DE LINFANT"` ↔ `"VANDELLÒS I L'HOSPITALET DE L'INFANT"`.

### 3.3 Base Imponible Depurada, Unidades (MWh) y Exportación Excel con Fila TOTAL
- **Fórmula depurada:** `Base Tasa = Base Imponible IVA - Bono Social - Impuesto Eléctrico - Base F1 (ATR + Alquiler) - SVA separables`, excluyendo facturas de penalización por baja anticipada, invirtiendo signos en `Abono` y deduplicando por `invoiceNumber`.
- **Redondeo comercial estricto:** La base y la tasa (`1,5%`) se redondean comercialmente a 2 decimales (`round2`) tanto por factura individual como en los subtotales por ayuntamiento y en el gran total.
- **Columnas y exportación:** Muestra `Base Imponible IVA`, `NIF Cliente`, `Distribuidora` y `Energía Consumida (MWh)` (dividiendo `Invoice.totalMWh` entre `1.000` conforme a la Regla 81), e incorpora fila final **TOTAL** tanto en las tablas en pantalla como en los libros Excel Agrupado y Detallado.

---

## 4. INTEGRACIÓN CON EL MOTOR DE FACTURACIÓN INTERNA (FASE 5)

Para evitar que las facturas generadas nativamente en el ERP queden aisladas de las liquidaciones tributarias:
1. [`InternalBillingEngine.ts`](../src/lib/services/InternalBillingEngine.ts) calcula el Impuesto Eléctrico respetando estrictamente `supplyPoint.ieRegimen`, `supplyPoint.ieDiscount`, el suelo mínimo legal por régimen (`0,50` / `1,00 €/MWh` solo cuando procede legalmente) y la territorialidad de impuestos indirectos (`IVA 21%` en Península/Baleares, `IGIC` en Canarias, `IPSI` en Ceuta/Melilla, manteniendo Canarias/Ceuta/Melilla sujetos a IE).
2. **Aislamiento en Fase de Pruebas (`ENABLE_INTERNAL_BILLING_PRODUCTION=false` por defecto) y Paridad Canónica 100% con Ingebau (Regla 276):** Mientras la facturación oficial continúe emitiéndose e importándose desde **Ingebau**, confirmar borradores en [`/api/facturacion/interna/confirm`](../src/app/api/facturacion/interna/confirm/route.ts) mantiene los registros estrictamente aislados en `InternalInvoice` (`/facturas-internas`) para no duplicar bases ni cuotas en Modelo 560 o Tasa Municipal. Tanto en `InternalInvoice` como cuando se active `ENABLE_INTERNAL_BILLING_PRODUCTION=true` y se promocionen mediante `buildOfficialInvoicePayloadFromInternal` / `buildIngebauCanonicalFieldsSync` ([`src/lib/services/internalInvoiceMapper.ts`](../src/lib/services/internalInvoiceMapper.ts)) a `Invoice` (`origin: 'INTERNAL_ENGINE'`), cada recibo incorpora las **~235 claves estructuradas exactas del CSV de Ingebau** (`Subtotal 1`, `Base 560`, `Importe Impuesto`, `Impuesto (%)`, `Minimo Importe IE Superado = '1'/'0'`, `Regimen Fiscal IE`, `CIE`, `Subtotal 2`, `Subtotal Otros Concepto`, `BaseImponibleF1`, `Importe Bono Social`, `Total SVA`, `Tasa Municipal`, `Base Imponible Tasa Municipal`, `CP PS`, `POBLACION PS`, `PROVINCIA PS`), `totalMWh` en `kWh` (Regla 81) y fechas ancladas a `12:00:00.000Z` UTC, garantizando convivencia sin conflictos en trimestres mixtos Ingebau + Motor Interno.
