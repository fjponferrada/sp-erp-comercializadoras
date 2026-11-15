# Guía de Gestión de Suministro y Facturación

Esta guía detalla el funcionamiento de los módulos clave del ERP encargados de la supervisión de la energía pendiente, el motor nativo de facturación interna, la gestión e histórico de facturas de clientes (CRM Ventas) y la importación masiva de datos y documentos desde Ingebau / Switching.

---

## 1. Suministro Pendiente Facturar (`/energia-pendiente`)

### Objetivo
Esta página sirve para **estimar cuánta energía ha consumido la cartera de clientes que aún no ha sido facturada** y qué valor económico (Base Imponible) representa ese retraso.

### ¿Cómo funciona el cálculo?
El algoritmo actúa contrato por contrato de la siguiente manera:
1. **Punto de partida (Última Facturación):** Busca en la base de datos la fecha de fin de la última factura emitida (`billingEnd`) para el CUPS del contrato. Si el contrato nunca ha sido facturado, toma su fecha de activación.
2. **Días Pendientes:** Calcula los días transcurridos desde esa última fecha hasta el **día de hoy**. *Nota: Si el contrato se dio de baja, calcula los días hasta su fecha final de rescisión (`terminationDate`).*
3. **Estimación de Consumo:** El sistema revisa el consumo total del último año (12 meses) de ese CUPS y extrae la **media de consumo diario**. Multiplica esta media por los Días Pendientes para obtener los MWh estimados pendientes de cobro.
4. **Estimación Económica:** Cruza esos MWh estimados con los precios horarios del mercado OMIE de los días exactos de retraso, sumando los costes regulados (peajes y cargos) para ofrecer una Base Imponible proyectada y un total con impuestos desglosado por meses (Mes actual, M-1, M-2).

### 1.1 Energía Pendiente de Liquidar frente a REE (`/gestion/energia-pendiente`)
En el mismo bloque de **Gestión**, el módulo **Energía Pendiente Liquidar (REE)** (`/gestion/energia-pendiente`) concilia la posición mayorista de la comercializadora frente al Operador del Sistema (**REE / REGANECU**) a lo largo del ciclo completo de **18 meses (`A1..C8`)**:
- Cruza hora a hora la **Demanda BC CCH Recibidas** (elevada a Barras de Central en `Europe/Madrid` con Factor `K` promedio horario y minorada por excedentes solares `SURPLUS` a `1.0x` según **P.O. 14.8**) contra el componente **`CAD` liquidado por REE** día a día (`mergeDailyReganecuRecords`), valorando los desvíos pendientes a precios horarios `DSV` (con ancla en `OMIE + CAD + PC3`).
- Calcula el **Descuadre F1–CCH** prorrateando la facturación (`Invoice` + `InternalInvoice` en calendario `Europe/Madrid`) y lo valora al precio medio mensual **`OMIE + Restricciones`**, separando en KPIs ejecutivos la provisión de **cierres vivos (`A1–C3`)** frente a **cierres maduros (`A4–C8`)** e incorporando un **Modal de Auditoría Mensual** por Distribuidora y Top 50 CUPS. Para el detalle completo, consúltese [`docs/GUIA_ENERGIA_PENDIENTE_REE.md`](./GUIA_ENERGIA_PENDIENTE_REE.md).

---

## 2. Motor de Facturación Interna (`/facturacion/interna`) e Histórico (`/facturas-internas`)

### Objetivo
Permitir a cada comercializadora calcular, auditar y emitir sus propias facturas eléctricas (`InternalInvoice`) directamente a partir de los ficheros XML `F1` de las distribuidoras y las curvas de carga cuarto-horarias (`LoadCurve`), sin depender de facturadores externos. Para el detalle matemático completo, véase [`docs/BILLING_ENGINE.md`](./BILLING_ENGINE.md).

### Flujo Operativo en `/facturacion/interna`
1. **Pestaña `Pendientes de Cálculo`:**
   - Lista los ficheros `F1Invoice` vinculados a un contrato válido que aún no tienen `InternalInvoice` asociada, filtrados automáticamente por los permisos multi-marca/multi-sociedad del usuario (`getInvoiceVisibilityFilter`).
   - Permite buscar por CUPS, Nº Factura F1, NIF o nombre del titular, consultar si existe factura externa del proveedor para contraste visual y lanzar **Generar Cálculos** en bloque (redirigiendo automáticamente a la pestaña `Borradores`).
2. **Pestaña `Borradores`:**
   - Agrupa los borradores según la tipología oficial CNMC (`TipoFactura` Tabla 102): **Normales (`N`)**, **Rectificadoras (`R`)** (emparejadas visualmente con su abono automático `↳ AR`/`S`), **Anuladoras (`A`)** (emparejadas con su nueva `↳ N` o bloqueando ciclos `N` duplicados huérfanos), **Complementarias (`C`)** y **Regularizadoras (`G`)**.
   - Muestra el periodo inclusivo en hora local `Europe/Madrid`, el estado de cuadre (`Sin descuadre`, `AUTO-AJUSTADO` mediante perfilado/escalado REE o `ERROR CRÍTICO` en `REQUIERE_REPARACION`), volúmenes `F1 (kWh)` vs `CCH (kWh)`, márgenes separados de potencia (`M. Potencia €`) y energía (`M. Energía €`), y comparativa directa frente al `Total Proveedor (€)`.
   - **Herramientas de Auditoría y Acciones:**
     - **Recalcular** (individual o masivo sobre seleccionados, con selección de rango mediante `Mayús + Clic`): re-ejecuta `InternalBillingEngine.calculate` con los costes regulados, precios COMPODEM/OMIE y servicios vigentes del contrato.
     - **Ver Ficha Detallada de 8 Bloques (`ExternalLink` → `/facturas-internas/[id]`):** permite inspeccionar cualquier borrador o factura interna con la misma vista estructurada de 8 tarjetas que `/facturas/[id]`, incluyendo navegación directa hacia facturas históricas de Ingebau cuando un abono rectifica un ciclo previo.
     - **Desglose Horario Excel (`Table`):** descarga las 24h/96qh del ciclo con todos los componentes mayoristas, pérdidas, ATR, `Ph` y excedentes (incluso en borradores `AUTO-AJUSTADO`).
     - **PDF Proforma (`FileText`):** previsualiza el recibo oficial con idéntico formato, datos registrales (`Company.registroMercantil`), etiqueta energética anual CNMC (`Company.etiquetaCnmc`), gráfico de 14 meses (RD 88/2026), nota rectificativa Art. 15 RD 1619/2012 y código QR oficial del Comparador CNMC (`BOE-A-2022-16989`) que tendrá la factura definitiva.
     - **Visibles / Ocultos y Borrar:** permite apartar borradores en revisión o eliminarlos para devolver el F1 a `Pendientes de Cálculo`.
     - **Confirmar Facturas:** asigna numeración correlativa oficial aislada por sociedad (`INT-YY-XXXX` para facturas positivas y `AB-YY-XXXX` para abonos), genera el diccionario canónico completo de **~235 claves estructuradas idénticas al CSV de Ingebau** (`buildIngebauCanonicalFieldsSync`) y sube el PDF y el XML a Cloudflare R2 (`facturas/internas/<CIF>/20YY/`). **Mientras el motor opera en Fase de Pruebas (`ENABLE_INTERNAL_BILLING_PRODUCTION` desactivado por defecto)**, las facturas confirmadas quedan **100% confinadas en `InternalInvoice` (`/facturas-internas`)** sin mezclarse con las facturas reales importadas de **Ingebau** (`Invoice`); el día en que se active `ENABLE_INTERNAL_BILLING_PRODUCTION=true`, se promocionarán también automáticamente a `Invoice` (`origin: 'INTERNAL_ENGINE'`) mediante `buildOfficialInvoicePayloadFromInternal`.

### Consulta en `/facturas-internas` y Ficha Detallada `/facturas-internas/[id]`
- Muestra de forma paginada todas las facturas internas confirmadas (tanto `EMITIDA` como `ABONO`) respetando el ámbito multi-marca del usuario.
- Permite filtrar por búsqueda libre (`Nº Factura INT-26-... / AB-26-...`, Razón Social, CIF o CUPS), tipo de factura (`Normal`, `Rectificativa`, `Abono`, `Complementaria`, `Regularizadora`) y rango de fechas de emisión.
- **Ficha Detallada (`/facturas-internas/[id]`):** reutiliza íntegramente `InvoiceDetailClient` mostrando los mismos **8 bloques estructurados** que `/facturas/[id]`, con enlaces cruzados hacia facturas históricas de Ingebau (`/facturas/[id]`) o internas (`/facturas-internas/[id]`).
- **Exportación Oficial de 65 Columnas (`/api/facturas-internas/export`):** utiliza el mismo generador compartido ([`src/lib/services/invoiceExportHelper.ts`](../src/lib/services/invoiceExportHelper.ts)) que `/api/facturas/export`, exportando exactamente las mismas **65 columnas oficiales** que Ingebau (con inversión automática de signo en Abonos desde la columna `Dias` según Regla 113).

### Garantías de Precisión Matemática, Normativa CNMC y Paridad 100% con Ingebau
- **Ventana Independiente de Energía Activa vs. Potencia y Cargos Diarios:** El motor lee y perfila la curva `LoadCurve` en el rango efectivo de los subbloques `<TerminoEnergiaActiva>` con consumo positivo (`energyStartDate..energyEndDate`), conservando simultáneamente `billingDays` de `<DatosFacturaATR><Periodo>` para Potencia, Bono Social, SVA y Alquiler en facturas **Regularizadoras (`G`)** y **Complementarias (`C`)** multi-bloque (y omitiendo potencia y cargos fijos diarios en **Complementarias (`C`)** sin `<Potencia>` en el XML F1).
- **Saneado de Curvas CCH, Realineación `FTP_*` Legacy y Perfilado REE Anti-Picos:** Detecta y corrige automáticamente desfases horarios (`+2h` CEST / `+1h` CET) en curvas históricas `FTP_*` sin prefijo CNMC, descarta curvas `LOCAL_SCAN` corruptas colapsadas en `00:00–01:59` cuando el F1 acredita consumo diurno, escala proporcionalmente cuando la cobertura `>= 80%` (alineando micro-descuadres `< 1 kWh` sin falsa alerta) y, ante déficits `< 80%`, preserva las horas medidas sin amplificar picos aislados y perfila únicamente el déficit `(f1Vol - cchVol)` con pesos REE sobre los días no medidos.
- **Salvaguarda Potencia BOE (`2022–2026+`), Prioridad `FEE_P`/`DSV` y SVA de Pago Único:** Incluye la serie histórica BOE `2022–2023` completa (`RegulatedCost`), garantiza `M. Potencia = 0,00 €` en contratos indexados puros `*BOE*`, prioriza `FEE_P` y `DSV` pactados frente a fees genéricos de catálogo migrados (registrando `feeApplied` en `invoiceData`) y fuerza duración de `1` mes único en cargos SVA de contratación (`Alta Nueva`, `€/alta`, `Derechos de alta`).
- **Pass-Through Estricto de Energía Reactiva sobre F1 CNMC (Reglas 177 y 274):** Cuando el documento de entrada es un XML oficial `Facturacion.xsd` de distribuidora o tiene lecturas estimadas (`40`, `60`, `70`), queda prohibido inventar cargos de reactiva mediante *Fallback Circular 3/2020* si la distribuidora no incluyó `<EnergiaReactiva>` en el F1.
- **Resolución en Cascada de Abonos `AR` / `A` / `S` (Regla 273):** En rectificaciones que anulan ciclos previos al corte con Ingebau, el motor busca la factura original primero en `InternalInvoice` y después en el histórico `Invoice` (recorriendo cadenas `N -> R1 no facturada -> R2` si procede), clonando e invirtiendo al céntimo todos sus términos e impuestos históricos (`5%` / `10%` / `21%`) sin depender de curvas CCH.
- **Configuración Anual por Comercializadora del Etiquetado CNMC y Registro Mercantil (`/comercializadoras`, Regla 275):** Cada sociedad configura desde `/comercializadoras` su texto registral (`Company.registroMercantil`) y su **Etiqueta Anual de la Electricidad CNMC (Circular 2/2021)** (`Company.etiquetaCnmc`: año publicado, bandera `100% Renovable GdO` sincronizada con `verde=1/0` del QR CNMC, mix de 7 tecnologías con donut vectorial multisegmento y escalas `A–G` en `g/kWh` y **`µg/kWh`**).

---

## 3. Histórico y Ficha de Facturas - CRM Ventas (`/facturas` y `/facturas/[id]`)

### Objetivo
Es el panel central para el control, búsqueda, auditoría, exportación y envío de todos los recibos definitivos emitidos a los clientes finales (modelo `Invoice` en la base de datos, tanto importados desde Ingebau como emitidos nativamente por `INTERNAL_ENGINE`).

### Funciones Principales
- **Listado y Filtros Avanzados:**
  - **Buscador inteligente:** Por Nº de Factura, Nombre/Razón Social, Apellidos, CIF/NIF, Código de Contrato o CUPS (con recorte automático a 20 caracteres si se pegan los 22 dígitos).
  - **Filtro de Fechas (`Europe/Madrid`):** Filtra por fecha de emisión respetando los límites horarios locales españoles (`00:00:00` a `23:59:59`).
  - **Filtro dinámico por Tipo:** Ordenado alfabéticamente con todos los tipos presentes en base de datos (`Abono`, `Complementaria`, `Normal`, `Penalización`, `Rectificativa`, `Regularizadora`) además del filtro especial **Bolsillo Solar** (compatible tanto con facturas de Ingebau como del Motor Interno gracias a `BOLSILLO SOLAR = 'SI'/'NO'` y normalización `Rectificadora → Rectificativa`).
  - **Filtro de Comunicación y Estado de PDF:** Permite aislar facturas `Comunicadas` vs `Pte. Envío`, así como recibos `Con PDF en nube` (R2) frente a `Sin PDF / Caducado` (enlaces históricos expirados de Airtable o pendientes de subida).
- **Convivencia Transparente sin Conflictos Mixtos (Ingebau + Motor Interno, Regla 276):**
  - Las facturas promocionadas por el Motor Interno anclan `issueDate`, `paymentDate`, `billingStart` y `billingEnd` **inclusivo** a `12:00:00.000Z` UTC (idéntico a `importInvoicesAction`, sin desfase de `+1 día` en `Hasta`), enlazan automáticamente `rectifiedInvoiceId` contra facturas previas de Ingebau o internas y exponen en pantalla, filtros y exportaciones la procedencia CNMC real (`Telegestión`, `Telemedida`, `Estimada`) en lugar del centinela interno `'INTERNAL_ENGINE'`.
- **Regla de Signos en Abonos y Preservación de `Invoice.margin` (`Reglas 113 y 280`):** Tanto en el listado general, en la ficha detallada (`/facturas/[id]`), en las métricas acumuladas de la ficha del cliente (`/clientes/[id]`) como en la exportación Excel de **65 columnas** (`/api/facturas/export` y `/api/facturas-internas/export`), las facturas de tipo **Abono** (`Abono`, `A`, `AR`, `S`) invierten automáticamente a negativo sus importes económicos (`Base Imponible IVA`, `Total`) y consumos físicos (`kWh` / `MWh`). **Excepción crítica sobre `Invoice.margin`:** tanto el importador de Ingebau (`src/app/actions/invoiceActions.ts`, `margenFacturaCorr = (tipoFactura === 'Abono' ? -1 : 1) * margenFactura`) como el Motor Interno (`invertBillingResult`) persisten ya en base de datos la columna `Invoice.margin` con su signo económico definitivo (incluyendo legítimamente márgenes positivos en abonos que anulan facturas originales emitidas a pérdidas). Por ello, toda agregación analítica en SQL (`getEconomicAnalysis()` en Dashboard `/`) suma `SUM(COALESCE(i."margin", 0))` **sin volver a invertir su signo ni aplicar `-ABS(margin)`**.
- **Ficha Detallada (`/facturas/[id]`):**
  - Muestra los **8 bloques** de términos físicos y económicos (Potencia P1–P6, Energía Activa y ATR, Excedentes RD 244/2019, Bolsillo Solar con Saldo Inicial / Llenado / Uso / Saldo Final, Bono Social, SVA, bases y cuotas de `IVA` / `IGIC` / `IPSI` por tramo y rentabilidad interna para administración).
  - Resuelve automáticamente los códigos oficiales **CNMC V3.0** (`Tabla 44` Procedencia, `Tabla 101` Motivo de Facturación, `Tabla 102` Tipo de Factura y `Tabla 113` Autoconsumo) e incluye enlaces directos clicables entre la factura origen y sus rectificativas/abonos asociados.
- **Comunicación y Descargas:**
  - Envío masivo o individual de facturas y avisos de pago/vencimiento mediante Resend utilizando el remitente oficial de cada comercializadora (`supportEmail` / dominio de marca) y priorizando `invoiceEmail` sobre `contactEmail`, exigiendo siempre un PDF válido en la nube (R2).
  - Descarga masiva en **ZIP** (PDFs y XMLs en la nube) y **Exportación a Excel de 65 columnas** (de toda la búsqueda filtrada o únicamente de las filas marcadas con checkbox).

> ⚠️ **Aclaración Importante (Convivencia Ingebau, Motor Interno en Pruebas y Penalizaciones):** Las facturas de `/facturas` (`Invoice`) son los recibos fiscales oficiales emitidos a clientes finales (importados desde **Ingebau**). **No deben confundirse** con las facturas mayoristas de peajes (`F1Invoice`) enviadas por la distribuidora (`Distribuidoras > Listado F1`), ni con las facturas del motor interno en pruebas (`/facturacion/interna` y `/facturas-internas` sobre `InternalInvoice`), ni con las facturas indemnizatorias por incumplimiento de permanencia (`/facturas-penalizaciones` sobre el modelo independiente `PenaltyInvoice`, serie `A{YY}PEN{NNN}` / `AB-A{YY}PEN{NNN}`, documentado en [`docs/GUIA_BAJAS_Y_PENALIZACIONES.md`](./GUIA_BAJAS_Y_PENALIZACIONES.md)). Por defecto (`ENABLE_INTERNAL_BILLING_PRODUCTION=false`), confirmar en `/facturacion/interna` **NO altera `Invoice`**, ni el Modelo 560, ni Tasa Municipal, ni Comisiones, ni Energía Pendiente; dicha promoción automática a `Invoice` solo se activará cuando se habilite explícitamente `ENABLE_INTERNAL_BILLING_PRODUCTION=true`.

---

## 4. Importador de Facturas (`/importar-facturas`)

### Objetivo
Alimentar la base de datos del ERP con las remesas generadas en el software externo de facturación / Switching (**Ingebau**) y enlazar sus documentos oficiales en Cloudflare R2.

### Proceso de Importación (Dos Pasos)

1. **Importador Automático de Facturas (CSV / Excel):**
   - Detecta automáticamente codificación **UTF-8** y **ANSI (Windows-1252)** para preservar tildes y caracteres especiales españoles (`Energía`, `Número`, `Gestión`), así como formatos numéricos con separador de miles y coma decimal (`1.948,56`).
   - Procesa en lotes de 50 filas detectando duplicados por `[invoiceNumber, companyId]`, rellenando las columnas nativas (`origin`, `paymentDate`, `taxAmount`, `margin`, etc.) y conservando el desglose íntegro en `invoiceData` (JSONB).
   - **Vinculación Inteligente de Contrato y F1:** Prioriza el código explícito `CONTRATO` del CSV; si no existe, cruza potencias contratadas (`P1C–P6C`) y vigencia temporal, y finalmente auto-enlaza cada recibo con su factura `F1Invoice` de distribuidora.
   - **Alta limpia de Clientes y Suministros:** Si el CIF no existe aún, infiere `Persona física` vs `Empresa`, concatena Nombre + Apellidos en `businessName` sin contaminar el email ni el teléfono del cliente con los datos de la comercializadora emisora o teléfonos `900` de averías, y normaliza automáticamente todos los códigos postales (`CP` / `CP PS`) a 5 dígitos españoles (`01001..52999`).

2. **Adjuntar PDFs y XMLs en Nube (R2):**
   - Subida paralela controlada (lotes de 5 archivos simultáneos) insensible a mayúsculas (`.pdf`/`.PDF`, `.xml`/`.XML`).
   - Enlaza cada archivo con su factura por nombre (`<NumeroFactura>.pdf` o `<NumeroFactura>.xml`), actualizando tanto `pdfUrl`/`xmlUrl` como `invoiceData.xmlUrl`.
   - Reemplaza automáticamente enlaces antiguos caducados de Airtable o rutas locales heredadas, e incluye una casilla opcional para **sobrescribir** documentos ya existentes en R2 cuando sea necesario.

---

## 5. Auditoría Mayorista de Ficheros F1 (`/ficheros-f1`) y Fianzas (`/ficheros-f1/fianzas-clientes`)

### Objetivo
Centralizar la supervisión económica, física y documental de todas las facturas mayoristas ATR (`FacturaATR`) y conceptos repercutibles/depósitos (`OtrasFacturas`) recibidos de las distribuidoras eléctricas mediante ficheros XML del proceso CNMC `F1`, cruzando su estado de refacturación al cliente final.

### Funciones Principales (`Regla 278`)
- **Seguridad y Aislamiento Multi-Marca:** Acceso exclusivo para `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE` (`hasAdminOrBackofficeRole`), acotado automáticamente a las marcas autorizadas y la selección activa de `<BrandSelector>` mediante `getSupplyPointVisibilityFilter()`.
- **Extracción Canónica `Facturacion.xsd` y Cuadre de Signos (`src/lib/f1Utils.ts`):**
  - Extrae con precisión `totalPeajes` (`Potencia` + `EnergiaActiva` + `ExcesoPotencia` + `EnergiaReactiva` + `EnergiaCapacitiva`), `totalCargos` (`Cargos.TotalImporteCargos`), `baseImponible` (`IVA` / `IVAReducido` / `IVAIGIC`, con respaldo a `ConceptoRepercutible` en fianzas exentas) e `ImporteTotalFactura` (mostrando además el `SaldoFactura` neto como subtexto diferencial en rectificadoras `R`).
  - Normaliza automáticamente a negativo los desgloses de abonos y anuladoras (`A`, `AR`, `S`) cuando la distribuidora envía `ImporteTotalFactura < 0` con `BaseImponible` o términos internos positivos, garantizando cuadre contable `Base + IVA = Total` en las **5.599+ facturas históricas** y en el descuento `f1BaseVal` de la Tasa Municipal 1,5%.
- **Tarjetas KPI y `Energía Pendiente Facturar` (`Regla 201`):**
  - Muestra en tiempo real sobre el filtro activo: **Total Facturas F1** (desglosadas en facturadas vs. pendientes), **Energía Pendiente Facturar (MWh)** (sumando todos los bloques y periodos JSONB tanto cuando `TerminoEnergiaActiva`/`Periodo` vienen como objeto único como cuando vienen como array en regularizadoras `G`), **Base Imponible + Peajes + Cargos** y **Total Facturas F1 (IVA incl.)**.
- **Buscador Global y Filtros Dinámicos (`Regla 208`):**
  - Búsqueda instantánea por **Nº Factura / Código Fiscal** (con o sin prefijo `CF `), **CUPS**, **Código de Contrato**, **NIF/CIF** o **Razón Social / Nombre del Titular**.
  - Filtros combinables por rango de **Fecha de Emisión**, **Estado de Facturación** (`Pendientes`, `Facturados al cliente` en `Invoice`, `En borrador` o `Emitidos` en `InternalInvoice`), **Tipo de Factura CNMC** (`N`, `R`, `AR`, `S`, `A`, `G`, `C`, `OtrasFacturas`) y **Distribuidora** dinámica.
- **Tabla Full-Width, Enlaces Directos (`Regla 75`), Fechas Inclusivas (`Regla 170`) y Herramientas:**
  - Paginación estándar de **100 registros por página** (`Regla 3`) sin recortes horizontales.
  - Fechas inclusivas exactas del ciclo (`FechaDesdeFactura - FechaHastaFactura` + días de ciclo) sin el desplazamiento técnico `+1 día` de base de datos, y enlaces clicables directos a `/puntos-suministro/[id]`, `/clientes/[id]`, `/contratos/[id]`, `/facturas/[id]` y `/facturacion/interna`.
  - **Modal de Desglose XML (`F1DetailModal.tsx`):** Inspección en 3 pestañas (*Resumen Económico y Vínculos*, *Periodos de Potencia kW / Energía kWh / Cargos* y *Estructura XML/JSON bruta*) + descarga directa del XML en R2.
  - **Subida Manual / Drag & Drop (`.xml` y `.zip`)** conectada a `ingestF1XmlAction` y **Exportación a Excel (`.xlsx`)** del 100% de los registros filtrados (tanto en `/ficheros-f1` como en `/ficheros-f1/fianzas-clientes`).

---

## 6. Reglas Críticas de Integridad en Base de Datos (CUPS + CIF + Código Postal 5 Dígitos)

1. **Unicidad Compuesta por `[CUPS (20 caracteres) + Cliente (CIF)]`:** Un Punto de Suministro solo puede coexistir duplicado si pertenece a distinto titular (cambio de titularidad histórico). Tanto el helper global como el mapa en memoria del importador indexan por `${clientId}_${cups20}`.
2. **Conservación de los 22 Caracteres y Comparación a 20:** Las comparaciones y búsquedas cruzan siempre por los primeros **20 caracteres** del CUPS, pero al dar de alta o enriquecer el suministro se conserva el código completo de **22 caracteres** (incluyendo dígitos de control).
3. **Blindaje Universal de 4 Capas para Códigos Postales Españoles (`01001..52999`):** Para impedir que códigos postales de las provincias `01`..`09` (`Álava`..`Burgos`) procedentes de Excel, Airtable o CSV pierdan su cero inicial (`"5230"` → `"05230"` Ávila) y provoquen errores fiscales (`IGIC`/`IPSI` o zona foral), se aplican 4 barreras simultáneas: (a) triggers nativos PostgreSQL `BEFORE INSERT OR UPDATE` (`fn_normalize_spanish_cp_text` en `SupplyPoint`, `Client` y `SolarQuote`), (b) guardián global ORM `$extends` en [`src/lib/prisma.ts`](../src/lib/prisma.ts) (`attachPostalCodeGuard`), (c) normalización en todos los importadores/acciones de alta y (d) validación estricta de 5 dígitos mediante `getSpanishPostalPrefix` ([`src/lib/postalCode.ts`](../src/lib/postalCode.ts)).
