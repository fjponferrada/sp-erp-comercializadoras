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
     - **Recalcular** (individual o masivo sobre seleccionados): re-ejecuta `InternalBillingEngine.calculate` con los costes regulados, precios COMPODEM/OMIE y servicios vigentes del contrato.
     - **Desglose Horario Excel (`Table`):** descarga las 24h/96qh del ciclo con todos los componentes mayoristas, pérdidas, ATR, `Ph` y excedentes (incluso en borradores `AUTO-AJUSTADO`).
     - **PDF Proforma (`FileText`):** previsualiza el recibo de 2 páginas con idéntico formato y datos corporativos que tendrá la factura definitiva.
     - **Visibles / Ocultos y Borrar:** permite apartar borradores en revisión o eliminarlos para devolver el F1 a `Pendientes de Cálculo`.
     - **Confirmar Facturas:** asigna numeración correlativa oficial aislada por sociedad (`INT-YY-XXXX` para facturas positivas y `AB-YY-XXXX` para abonos) y sube el PDF y el XML a Cloudflare R2 (`facturas/internas/<CIF>/20YY/`). **Mientras el motor opera en Fase de Pruebas (`ENABLE_INTERNAL_BILLING_PRODUCTION` desactivado por defecto)**, las facturas confirmadas quedan **100% confinadas en `InternalInvoice` (`/facturas-internas`)** sin mezclarse con las facturas reales importadas de **Ingebau** (`Invoice`); el día en que se active `ENABLE_INTERNAL_BILLING_PRODUCTION=true`, se promocionarán también automáticamente a `Invoice` (`origin: 'INTERNAL_ENGINE'`).

### Consulta en `/facturas-internas` (Histórico Facturas Internas)
- Muestra de forma paginada todas las facturas internas confirmadas (tanto `EMITIDA` como `ABONO`) respetando el ámbito multi-marca del usuario.
- Permite filtrar por búsqueda libre (`Nº Factura INT-26-... / AB-26-...`, Razón Social, CIF o CUPS), tipo de factura y rango de fechas de emisión, visualizar el consumo en `kWh`, abrir el PDF o el desglose horario Excel y exportar el listado filtrado a `.xlsx`.

---

## 3. Histórico y Ficha de Facturas - CRM Ventas (`/facturas` y `/facturas/[id]`)

### Objetivo
Es el panel central para el control, búsqueda, auditoría, exportación y envío de todos los recibos definitivos emitidos a los clientes finales (modelo `Invoice` en la base de datos, tanto importados desde Ingebau como emitidos nativamente por `INTERNAL_ENGINE`).

### Funciones Principales
- **Listado y Filtros Avanzados:**
  - **Buscador inteligente:** Por Nº de Factura, Nombre/Razón Social, Apellidos, CIF/NIF, Código de Contrato o CUPS (con recorte automático a 20 caracteres si se pegan los 22 dígitos).
  - **Filtro de Fechas (`Europe/Madrid`):** Filtra por fecha de emisión respetando los límites horarios locales españoles (`00:00:00` a `23:59:59`).
  - **Filtro dinámico por Tipo:** Ordenado alfabéticamente con todos los tipos presentes en base de datos (`Abono`, `Complementaria`, `Normal`, `Penalización`, `Rectificativa`, `Regularizadora`) además del filtro especial **Bolsillo Solar**.
  - **Filtro de Comunicación y Estado de PDF:** Permite aislar facturas `Comunicadas` vs `Pte. Envío`, así como recibos `Con PDF en nube` (R2) frente a `Sin PDF / Caducado` (enlaces históricos expirados de Airtable o pendientes de subida).
- **Regla de Signos en Abonos:** Tanto en el listado general, en la ficha detallada (`/facturas/[id]`), en las métricas acumuladas de la ficha del cliente (`/clientes/[id]`) como en la exportación Excel, las facturas de tipo **Abono** invierten automáticamente a negativo sus importes económicos y consumos físicos (`kWh` / `MWh`).
- **Ficha Detallada (`/facturas/[id]`):**
  - Muestra el desglose completo de términos físicos y económicos (Potencia P1–P6, Energía Activa y ATR, Excedentes RD 244/2019, Bolsillo Solar con Saldo Inicial / Llenado / Uso / Saldo Final, Bono Social, SVA, bases y cuotas de IVA/IGIC/IPSI por tramo y rentabilidad interna para administración).
  - Resuelve automáticamente los códigos oficiales **CNMC V3.0** (`Tabla 44` Procedencia, `Tabla 101` Motivo de Facturación, `Tabla 102` Tipo de Factura y `Tabla 113` Autoconsumo) e incluye enlaces directos clicables entre la factura origen y sus rectificativas/abonos asociados.
- **Comunicación y Descargas:**
  - Envío masivo o individual de facturas y avisos de pago/vencimiento mediante Resend utilizando el remitente oficial de cada comercializadora (`supportEmail` / dominio de marca) y priorizando `invoiceEmail` sobre `contactEmail`, exigiendo siempre un PDF válido en la nube (R2).
  - Descarga masiva en **ZIP** (PDFs y XMLs en la nube) y **Exportación a Excel** (de toda la búsqueda filtrada o únicamente de las filas marcadas con checkbox).

> ⚠️ **Aclaración Importante (Convivencia Ingebau vs. Motor Interno en Pruebas):** Las facturas de `/facturas` (`Invoice`) son los recibos fiscales oficiales emitidos a clientes finales (importados desde **Ingebau**). **No deben confundirse** con las facturas mayoristas de peajes (`F1Invoice`) enviadas por la distribuidora (`Distribuidoras > Listado F1`), ni con las facturas del motor interno en pruebas (`/facturacion/interna` y `/facturas-internas` sobre `InternalInvoice`). Por defecto (`ENABLE_INTERNAL_BILLING_PRODUCTION=false`), confirmar en `/facturacion/interna` **NO altera `Invoice`**, ni el Modelo 560, ni Tasa Municipal, ni Comisiones, ni Energía Pendiente; dicha promoción automática a `Invoice` solo se activará cuando se habilite explícitamente `ENABLE_INTERNAL_BILLING_PRODUCTION=true`.

---

## 4. Importador de Facturas (`/importar-facturas`)

### Objetivo
Alimentar la base de datos del ERP con las remesas generadas en el software externo de facturación / Switching (**Ingebau**) y enlazar sus documentos oficiales en Cloudflare R2.

### Proceso de Importación (Dos Pasos)

1. **Importador Automático de Facturas (CSV / Excel):**
   - Detecta automáticamente codificación **UTF-8** y **ANSI (Windows-1252)** para preservar tildes y caracteres especiales españoles (`Energía`, `Número`, `Gestión`), así como formatos numéricos con separador de miles y coma decimal (`1.948,56`).
   - Procesa en lotes de 50 filas detectando duplicados por `[invoiceNumber, companyId]`, rellenando las columnas nativas (`origin`, `paymentDate`, `taxAmount`, `margin`, etc.) y conservando el desglose íntegro en `invoiceData` (JSONB).
   - **Vinculación Inteligente de Contrato y F1:** Prioriza el código explícito `CONTRATO` del CSV; si no existe, cruza potencias contratadas (`P1C–P6C`) y vigencia temporal, y finalmente auto-enlaza cada recibo con su factura `F1Invoice` de distribuidora.
   - **Alta limpia de Clientes nuevos:** Si el CIF no existe aún, infiere `Persona física` vs `Empresa`, concatena Nombre + Apellidos en `businessName` sin contaminar el email ni el teléfono del cliente con los datos de la comercializadora emisora o teléfonos `900` de averías.

2. **Adjuntar PDFs y XMLs en Nube (R2):**
   - Subida paralela controlada (lotes de 5 archivos simultáneos) insensible a mayúsculas (`.pdf`/`.PDF`, `.xml`/`.XML`).
   - Enlaza cada archivo con su factura por nombre (`<NumeroFactura>.pdf` o `<NumeroFactura>.xml`), actualizando tanto `pdfUrl`/`xmlUrl` como `invoiceData.xmlUrl`.
   - Reemplaza automáticamente enlaces antiguos caducados de Airtable o rutas locales heredadas, e incluye una casilla opcional para **sobrescribir** documentos ya existentes en R2 cuando sea necesario.

---

## 5. Reglas Críticas de Integridad en Base de Datos (CUPS + CIF)

1. **Unicidad Compuesta por `[CUPS (20 caracteres) + Cliente (CIF)]`:** Un Punto de Suministro solo puede coexistir duplicado si pertenece a distinto titular (cambio de titularidad histórico). Tanto el helper global como el mapa en memoria del importador indexan por `${clientId}_${cups20}`.
2. **Conservación de los 22 Caracteres y Comparación a 20:** Las comparaciones y búsquedas cruzan siempre por los primeros **20 caracteres** del CUPS, pero al dar de alta o enriquecer el suministro se conserva el código completo de **22 caracteres** (incluyendo dígitos de control).
