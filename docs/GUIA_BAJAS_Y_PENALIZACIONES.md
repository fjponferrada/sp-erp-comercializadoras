# 📉 Guía Maestra de Bajas, Retención (Winback) y Facturación de Penalizaciones

Esta guía documenta de forma integral el funcionamiento operativo (para usuarios de Backoffice, Dirección y Red Comercial) y la arquitectura técnica (para desarrolladores) de los módulos de **Bajas y Retención** (`/bajas`), **Facturas de Penalizaciones** (`/facturas-penalizaciones`) y **Generación de Bajas ATR** (`/eventos-switching/bajas`), en correspondencia con `docs/BUSINESS_RULES_UTF8.md` (**Reglas 3, 47, 55, 59, 60, 83, 104, 113, 121–124, 131, 159, 220, 224, 245, 247, 249, 251, 268 y 277**) y `docs/CRM_VENTAS_GUIDE.md`.

---

## 1. Visión General y Principios de Negocio

El ecosistema de Bajas, Retención y Penalizaciones cumple cuatro objetivos dentro del ERP:
1. **Alerta temprana pre-fuga (Paso `11` ATR)**: Identificar en tiempo real los contratos aún `ACTIVO` que han recibido notificación de salida por cambio de comercializadora (`fechaPrevistaBaja != null`), mostrando cuenta atrás en días (`en Xd`) para retener al cliente **antes** de que se ejecute el Paso `06`.
2. **Control exacto de fuga de cartera (*Churn*)**: Distinguir matemáticamente cuándo un cliente se ha marchado de la comercializadora (**Baja Confirmada**) frente a cuándo un contrato se ha cerrado internamente por una renovación, cambio de potencia/tarifa, subrogación o cambio de marca sobre la raíz física de **20 caracteres del CUPS** (**Falsa Baja**).
3. **Recuperación comercial (*Winback* CRM)**: Facilitar a Backoffice, Jefes de Canal y Comerciales el seguimiento de estado (`CONTACTADO`, `OFERTA_ENVIADA`, `EN_NEGOCIACION`, `RECUPERADO`, `DESCARTADO`), notas de gestión, emisión en 1 clic de ofertas PDF personalizadas y conversión limpia hacia `/leads` (**Crear Oferta** o **Pasar a Alta Luz** con Auto-SIPS y sin arrastrar IBAN ni facturas antiguas).
4. **Liquidación, facturación multipunto, abonos y cobro de penalizaciones**: Calcular con exactitud la indemnización por resolución anticipada de permanencia, emitir facturas individuales o agrupadas por CIF multipunto (serie `A{YY}PEN{NNN}` aislada por sociedad `companyId` con 21% de IVA), custodiarlas en **Cloudflare R2**, comunicarlas con PDF adjunto vía **Resend**, gestionar su estado de cobro (`PENDIENTE`, `PAGADA`, `IMPAGADA`) y soportar **Facturas Rectificativas / Abonos (`AB-A{YY}PEN{NNN}`)** sin contaminar la contabilidad energética ni los impuestos especiales.

### 1.1 Independencia Absoluta: Penalización al Cliente vs. Decomisión al Canal
Es fundamental no confundir ambos conceptos en la operativa diaria ni en el código (**Regla 245** y `docs/GUIA_COMISIONES.md`):

| Concepto | ¿A quién aplica? | ¿Qué campo lo gobierna? | ¿Cómo se calcula? | Módulo ERP |
| :--- | :--- | :--- | :--- | :--- |
| **Penalización por Permanencia** | **Cliente final** (factura a cobrar al titular del suministro) | `Contract.permanenceMonths` + `permanenceStartDate` | `0 €` si `permanenceMonths === 0`; 5% energía pendiente estimada en BT (RD 1435/2002) o 30 €/MWh en AT (`6.XTD`), más 21% IVA al emitir PDF | `/bajas` y `/facturas-penalizaciones` |
| **Decomisión / Regularización** | **Canal / Agente comercial** (descuento sobre liquidación de comisiones) | Horizonte fijo de **365 días** desde `activationDate` del `V0` | Prorrateo lineal en `2.0TD` (perdón `< 1 €`) o *True-Up* real sobre facturas en resto de tarifas | `/liquidacion-comisiones` (`CommissionEngine.ts`) |

---

## 2. Mapa de Arquitectura de Archivos (Para Desarrolladores)

| Ruta del Archivo | Responsabilidad Técnica |
| :--- | :--- |
| `src/lib/bajasServer.ts` | Motor servidor compartido de `/bajas`: RBAC (`getBajasSessionContext`, `requirePenaltyAdminAccess`), normalización CUPS de 20 caracteres, fusión de intervalos de 30 días, bandeja Paso 11, motor matemático de penalizaciones y preaviso de 30 días, KPIs reactivos en `Europe/Madrid` y emisión atómica individual/multipunto de `PenaltyInvoice`. |
| `src/lib/penaltyInvoicesServer.ts` | Motor servidor compartido de `/facturas-penalizaciones`: filtrado server-side multi-marca, paginación y cálculo de KPIs financieros netos (invirtiendo signo en `ABONO`). |
| `src/app/(app)/bajas/page.tsx` | Server Component (`force-dynamic`) de `/bajas`. Verifica sesión/rol y carga datos iniciales, productos, canales y catálogos dinámicos (`bajaProcess` y `tariff`) acotados por `visibilityFilter`. |
| `src/app/(app)/bajas/BajasClient.tsx` | Interfaz cliente de `/bajas`: pestañas **Bajas Confirmadas** vs **En Riesgo · Preaviso Paso 11**, KPIs reactivos (ocultos para `COMERCIAL`/`CANAL`), selección en bloque (`Shift + Click`), facturación/descarte masivo y exportación `.xlsx`. |
| `src/app/actions/bajasActions.tsx` | Server Actions de `/bajas` y switching saliente: `getPaginatedBajasAction`, `getBajasStatsAction`, `savePenaltyAction`, `bulkDiscardPenaltiesAction`, `bulkIssuePenaltiesAction`, `saveWinbackTrackingAction`, `fetchBajaContext` y `generateBajaXml` (`B1_01`). |
| `src/app/api/bajas/export/route.ts` | Exportación `.xlsx` de `/bajas` (Confirmadas o Preavisos Paso 11), omitiendo columnas de penalización para `COMERCIAL`/`CANAL`. |
| `src/components/bajas/WinbackOfferModal.tsx` | Modal CRM de Recuperación: edición de estado/notas Winback, saltos 1-clic a `/leads` (`action=offer` y `action=contract`), edición de email destino y mapeo completo de precios de energía (`p1e..p6e`), potencia (`p1p..p6p`), indexados y autoconsumo. |
| `src/app/api/pdf/offer/route.tsx` | Generador PDF y envío de oferta comercial vía **Resend** con resolución dinámica del remitente y dominio corporativo de la marca activa (`Brand`). |
| `src/components/pdf/PenaltyInvoicePDF.tsx` | Plantilla vectorial `@react-pdf/renderer` para facturas individuales, facturas multipunto (`lines[]`) y facturas rectificativas negativas (`isAbono = true`, `FACTURA RECTIFICATIVA / ABONO`). |
| `src/app/(app)/facturas-penalizaciones/page.tsx` | Server Component (`force-dynamic`) restringido a `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`. |
| `src/app/(app)/facturas-penalizaciones/FacturasPenalizacionesClient.tsx` | Interfaz contable de penalizaciones: 4 KPIs financieros, filtros por comunicación/cobro/tipo/fechas, selector en vivo de estado de cobro, descarga masiva `.zip`, exportación `.xlsx` y paginación server-side (`100` por página). |
| `src/app/actions/penaltyInvoiceActions.ts` | Server Actions protegidas con RBAC: paginación, envío por email con PDF adjunto desde R2 (priorizando `invoiceEmail || contactEmail`, **Regla 224**), marcado manual y actualización de estado de cobro (`PENDIENTE`, `PAGADA`, `IMPAGADA`). |
| `src/app/actions/deletePenaltyAction.ts` y `src/components/DeletePenaltyButton.tsx` | Anulación contable segura: emisión de **Factura Rectificativa / Abono (`AB-...`)** para facturas comunicadas, o borrado físico (incluyendo limpieza del objeto en Cloudflare R2 cuando no está compartido en multipunto) para borradores no comunicados. |
| `src/app/api/facturas-penalizaciones/export/route.ts` | Exportación contable `.xlsx` con desglose de Base, IVA 21%, Total (negativos en `ABONO`), estado de comunicación y estado/fecha de cobro. |
| `src/app/api/facturas-penalizaciones/download-zip/route.ts` | Descarga masiva en `.zip` de PDFs de R2 con concurrencia controlada (`10` simultáneos) y deduplicación de PDFs multipunto. |
| `src/components/clientes/ClientTabs.tsx` y `src/components/clientes/PenalizationModal.tsx` | Modal real de gestión de penalizaciones (`savePenaltyAction`) integrado en la pestaña Contratos de `/clientes/[id]`, restringido exclusivamente a `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`. |
| `src/app/(app)/eventos-switching/bajas/GenerarBajaClient.tsx` | Generador asistido de XML saliente `B1_01` con previsualización en vivo del contrato activo (`BajaContractPreview`), autogeneración opcional de `<CodigoDeSolicitud>` de 12 dígitos y auto-registro en `SwitchingEvent`. |

---

## 3. Modelo de Datos en Prisma (`schema.prisma`)

### 3.1 Campos de Baja, Penalización y Winback en `Contract`
* **`status`**: Estado canónico `'FINALIZADO'` (o `'BAJA'` heredado de Airtable) para bajas consumadas; `'ACTIVO'` con `fechaPrevistaBaja != null` para preavisos de Paso `11`.
* **`terminationDate`** (`DateTime?`): Fecha efectiva de baja confirmada por distribuidora.
* **`fechaPrevistaBaja`** (`DateTime?`): Fecha prevista comunicada por distribuidora en Paso `11` (sin sobrescribir `expectedEndDate`).
* **`bajaProcess`** (`String?`): Proceso CNMC (`C1`, `C2`, `B1`, `B2`, `T1`, `E2`).
* **`permanenceMonths`** (`Int?`): Meses de permanencia contractual (`0` = explícitamente Sin Permanencia).
* **`calculatedPenalty`** / **`penalization`** (`Float?`): Importes expresados siempre en **Base Imponible (€)**.
* **`penaltyStatus`** (`String?`): `'PENDIENTE'` | `'FACTURADA'` | `'DESCARTADA'`.
* **`winbackStatus`** (`String?`): `'CONTACTADO'` | `'OFERTA_ENVIADA'` | `'EN_NEGOCIACION'` | `'RECUPERADO'` | `'DESCARTADO'`.
* **`winbackNotes`** (`String?`), **`winbackLastContactAt`** (`DateTime?`), **`winbackProductOffered`** (`String?`): Trazabilidad comercial de recuperación.

### 3.2 Modelo Independiente `PenaltyInvoice`
Aislado por completo de `Invoice` y de `InternalInvoice` (exento de Modelo 560, Tasa Municipal 1,5%, CNMC/MITECO y *True-Up* de comisiones). Por criterio fiscal estandarizado del ERP, todas las facturas y abonos de penalización aplican un **tipo fijo del 21% de IVA** sobre `baseAmount` (sin desglose territorial IGIC/IPSI ni selector de exención):

```prisma
model PenaltyInvoice {
  id                 String           @id @default(cuid())
  invoiceNumber      String           // Serie A{YY}PEN{NNN}, multipunto A{YY}PEN{NNN}-1 o Abono AB-A{YY}PEN{NNN}
  invoiceType        String           @default("PENALIZACION") // "PENALIZACION" | "ABONO"
  baseAmount         Float?           // Base Imponible (€, negativa en ABONO)
  taxAmount          Float?           // IVA 21% (€, negativo en ABONO)
  amount             Float            // Total Factura con 21% IVA incluido
  issueDate          DateTime         @default(now())
  pdfUrl             String?          // URL pública en Cloudflare R2
  companyId          String?          // Sociedad mercantil emisora (aísla numeración por CIF)
  contractId         String
  clientId           String
  supplyPointId      String
  status             String           @default("EMITIDA")    // "EMITIDA" | "COMUNICADA"
  communicatedAt     DateTime?
  paymentStatus      String           @default("PENDIENTE")  // "PENDIENTE" | "PAGADA" | "IMPAGADA" | "ANULADA"
  paymentDate        DateTime?
  rectifiedPenaltyId String?

  @@unique([invoiceNumber, companyId])
  @@index([companyId, issueDate])
  @@index([contractId])
}
```

---

## 4. Reglas Exactas de Negocio en `/bajas`

### 4.1 Dos Bandejas Operativas
1. **📉 Bajas Confirmadas (`CONFIRMADAS`)**: Agrupa todos los contratos (`ACTIVO`, `BAJA`, `FINALIZADO`) por la **raíz física de 20 caracteres del CUPS** (`cups.substring(0, 20).toUpperCase()`, **Reglas 104 y 124**) y fusiona tramos continuos separados `<= 30 días` (**Regla 47**). Calcula además la **Vida Media Cliente** sobre la duración continua real del CUPS de 20 caracteres.
2. **🚨 En Riesgo · Preaviso Paso 11 (`PREAVISO_PASO_11`)**: Lista los contratos actualmente **`ACTIVO`** con `fechaPrevistaBaja != null` y `terminationDate == null`, ordenados por inminencia de salida y mostrando etiqueta de cuenta atrás (`en Xd`) para priorizar llamadas de retención antes de que se consuma el cambio en Paso `06`.

### 4.2 Cálculo Matemático de Penalización (`calculatePenaltyDetailed`)
1. **Respeto estricto a contratos Sin Permanencia**: Si `permanenceMonths === 0` (en contrato o producto), la penalización es **`0,00 €`** (jamás cae a `12` por coerción booleana).
2. **Fin de permanencia cumplido**: Si la fecha de baja `>= pStart + permanenceMonths`, devuelve **`0,00 €`**.
3. **Desistimiento legal residencial**: Si es suministro residencial (`NIF` comunidad `H` o persona física con `CNAE` hogar `9820`/`9821`) y causa baja en los primeros **`<= 14 días`** desde `pStart`, devuelve **`0,00 €`**.
4. **Valoración económica**:
   * **Alta Tensión (`6.XTD`)**: $\text{Energía Pendiente (kWh)} \times 0,03\text{ €/kWh}$ (`30 €/MWh`).
   * **Baja Tensión (`2.0TD`, `3.0TD`, `3.0TDVE`)**: $\text{Energía Pendiente (kWh)} \times \text{Precio Medio Ponderado} \times 0,05$ (**5% máx. RD 1435/2002**), ponderando `p1e..p6e` del contrato/producto ($25/25/50\%$ en `2.0TD` y $10/10/10/10/10/50\%$ en `3.0TD*`, con respaldo `0,16` / `0,15` / `0,14 €/kWh` en indexados).
5. **Sumatorio de cabecera `(Total: X €)`**: Suma `resolveEffectivePenalty` sobre todos los registros filtrados: toma `0 €` si está `DESCARTADA`, el importe manual `penalization` si existe, o el cálculo automático exacto con `p1e..p6e`.

### 4.3 Alerta de Incumplimiento de Preaviso de 30 Días (`⚠️`)
El indicador `⚠️` junto a la fecha de baja se activa **exclusivamente** en contratos **no residenciales con permanencia `> 0`** cuya fecha de baja cae dentro de la ventana de **los últimos 30 días previos al vencimiento** (`expectedEndDate` o aniversario del ciclo anual `0 < díasHastaVencimiento <= 30`).

### 4.4 Facturación Individual, en Bloque y Multipunto por CIF
Desde `/bajas` (pestaña Confirmadas), Backoffice/Admin puede:
* Gestionar una fila individual desde su píldora (**Guardar Pendiente**, **Descartar 0 €**, **Facturada Externa** o **Confirmar y Emitir PDF**).
* Seleccionar múltiples filas (`Shift + Click`) y ejecutar:
  * **Descartar en bloque**: Marca todas las pendientes seleccionadas como `DESCARTADA` (`0,00 €`).
  * **Facturar Individuales**: Emite un PDF y una factura correlativa `A{YY}PEN{NNN}` por cada contrato con penalización `> 0 €`.
  * **Facturar Agrupando Multipunto (CIF)**: Agrupa los suministros seleccionados del mismo cliente (`clientId`) y sociedad (`companyId`) en **un único PDF desglosado por CUPS** (`A{YY}PEN{NNN}.pdf`), generando los registros hermanos `A{YY}PEN{NNN}-1`, `A{YY}PEN{NNN}-2`, etc.

---

## 5. Gestión Contable en `/facturas-penalizaciones`

1. **KPIs Financieros Sincronizados**:
   * **Facturación Neta (c/IVA)** y **Base Imponible Neta** (restando automáticamente los `ABONO`).
   * **Sin Comunicar** (documentos pendientes de envío).
   * **Importe Cobrado** (`PAGADA`) vs **Pendiente / Impagado** (`PENDIENTE` + `IMPAGADA`).
2. **Comunicación por Email (`Comunicar`)**:
   * Prioriza estrictamente **`client.invoiceEmail || client.contactEmail`** (**Regla 224**).
   * Descarga el PDF desde Cloudflare R2 y lo adjunta como fichero `.pdf` real en el correo de **Resend**, además del enlace corporativo multi-marca, registrando `status = 'COMUNICADA'` y `communicatedAt`.
3. **Anulación Contable Segura (`DeletePenaltyButton`)**:
   * **Factura ya comunicada al cliente**: Emite una **Factura Rectificativa / Abono (`AB-A{YY}PEN{NNN}`)** con Base, IVA 21% y Total negativos, sube su PDF rectificativo a R2, marca la factura original como `ANULADA` y devuelve el contrato a `PENDIENTE` en `/bajas`.
   * **Factura no comunicada (borrador)**: Permite eliminarla físicamente, borrando también su archivo PDF en Cloudflare R2 (verificando antes que ningún otro registro multipunto `-1`/`-2` comparta ese `pdfUrl`) y revirtiendo el contrato a `PENDIENTE`.
4. **Exportaciones Contables**:
   * **Exportar Excel (`.xlsx`)**: Descarga todas las facturas filtradas (o seleccionadas) con importes negativos en abonos, fechas en `Europe/Madrid` y trazabilidad de comunicación y cobro.
   * **Descargar ZIP (`.zip`)**: Empaqueta en servidor con concurrencia controlada (`10` simultáneos) los PDFs seleccionados desde R2.

---

## 6. Matriz de Permisos por Rol (RBAC)

| Funcionalidad / Elemento | `SUPERADMIN` / `COMPANYADMIN` | `BACKOFFICE` | `CANAL` (Jefe de Canal) | `COMERCIAL` | `CLIENT` (Portal) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Acceso a `/bajas` (Confirmadas y Preaviso Paso 11) | Sí (Marca/Sociedad activa) | Sí (Marca activa) | Sí (Solo su canal) | Sí (Solo su cartera) | No (Redirige a `/`) |
| Ver los 4 KPIs superiores en `/bajas` | Sí (Reactivos a filtros) | Sí (Reactivos a filtros) | **No (Oculto)** | **No (Oculto)** | No |
| Llamar, WhatsApp, Email, **Recuperar (Winback CRM)** y **Pasar a Alta Luz** | Sí | Sí | **Sí (Sobre su cartera)** | **Sí (Sobre su cartera)** | No |
| Ver columna **Penalización**, facturar o descartar (individual / bloque / ficha cliente) | Sí | Sí | **No (Bloqueado en UI y Server Action)** | **No (Bloqueado en UI y Server Action)** | No |
| Exportar Excel en `/bajas` | Sí (Con penalizaciones) | Sí (Con penalizaciones) | Sí (Sin columnas de penalización) | Sí (Sin columnas de penalización) | No |
| Acceso a `/facturas-penalizaciones` y sus APIs | Sí | Sí | **No (Redirige a `/` y `403` en API/Actions)** | **No (Redirige a `/` y `403` en API/Actions)** | No |
| Generar XML saliente `B1_01` (`/eventos-switching/bajas`) | Sí | Sí | **No** | **No** | No |

---

## 7. Generación de Bajas y Suspensiones Salientes ATR (`B1_01` — `/eventos-switching/bajas`)

Cuando es la propia comercializadora quien inicia ante la distribuidora la baja definitiva o la suspensión temporal del suministro (`Distribuidoras → Generar Baja`, implementado en `GenerarBajaClient.tsx` y `bajasActions.tsx`):

1. **Control de Acceso y Contexto Automático (`fetchBajaContext`)**:
   * Protegido en servidor mediante `requirePenaltyAdminAccess()` (exclusivo `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`).
   * Resuelve automáticamente `<CodigoREEEmpresaEmisora>` desde `Company.codigoRee` de la sociedad mercantil activa.
   * Al introducir el CUPS (búsqueda por raíz de 20 caracteres acotada a `activeCompanyId`), rellena `<CodigoREEEmpresaDestino>` (`supplyPoint.distributorReeCode` o dígitos `2..6` del CUPS) y renderiza la tarjeta de verificación **`BajaContractPreview`** (Titular, NIF/CIF, CUPS completo de 22 caracteres, Tarifa ATR, Estado y enlace directo a `/contratos/[id]`), mostrando alerta ámbar si no existe contrato `ACTIVO` o `TRAMITANDO`.
2. **Cumplimiento Estricto XSD CNMC V3.0 (`TipoMensajeB101.xsd`)**:
   * **Motivos oficiales (Tabla 10 CNMC)**:
     * `01` — Cese de actividad *(Baja definitiva)*.
     * `02` — Fin de contrato de energía *(Baja definitiva)*.
     * `03` — Suspensión de suministro por impago *(Corte temporal — **no** extingue el contrato, `Contract.suspendido = true` al recibir `B1_05`)*.
     * `04` — Baja de punto de suministro por impago *(Baja definitiva)*.
   * **Código de Solicitud (`<CodigoDeSolicitud>`)**: Acepta un código numérico manual de 12 dígitos o lo **autogenera automáticamente** (`buildB1SolicitudCode`) si se deja vacío.
   * **Identificación y Nombre del Titular (Tabla 6 CNMC)**: Clasifica `NI` (NIF/CIF nacional), `NE` (NIE) o `PS` (Pasaporte/extranjero; nunca `PA`), exige `NombreDePila` + `PrimerApellido` (+ `SegundoApellido` opcional) en personas físicas o `RazonSocial` en personas jurídicas (bloqueando la emisión si faltan), formatea `<Telefono>` con `<PrefijoPais>0034</PrefijoPais>` cuando consta teléfono válido de 9 dígitos y conmuta `<IndActivacion>` entre `'A'` (inmediata) y `'F'` (con `<FechaPrevistaAccion>`).
3. **Auto-Registro en el ERP (`registerInErp`)**:
   * Activado por defecto: al generar y descargar `${codigoSolicitud}_01_${cupsFinal}_SP_B1_01.xml`, invoca internamente `ingestXmlStringInternal(xml, filename)` para dejar registrada la solicitud `B1_01` en `SwitchingEvent`. Esto garantiza trazabilidad completa y permite al motor de ingesta distinguir automáticamente un corte temporal por impago (`Motivo = '03'`) de una baja definitiva (`01`, `02`, `04`) cuando la distribuidora responde con el `B1_05`.

---

## 8. Gestión desde Ficha de Cliente (`/clientes/[id]`) y Checklist de Mantenimiento

* **Integración en Ficha de Cliente (`ClientTabs.tsx` + `PenalizationModal.tsx`)**: En la pestaña **Contratos** de `/clientes/[id]`, los contratos en estado `BAJA` o `FINALIZADO` muestran el botón **`Penalizar`** exclusivamente para `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`. Dicho modal invoca directamente `savePenaltyAction` (permitiendo guardar pendiente, descartar a `0 €`, marcar facturada externa o confirmar y emitir el PDF `PenaltyInvoice` en R2).
* **Checklist Técnico para Futuras Modificaciones**:
  1. **Nunca usar coerción booleana sobre `permanenceMonths`**: Usar siempre comprobación explícita `typeof val === 'number' && !Number.isNaN(val)` para que `0` se respete como **Sin Permanencia (`0,00 €`)**.
  2. **Raíz de 20 caracteres en CUPS**: Todo cruce de continuidad o deduplicación de falsas bajas debe operar sobre `cups.trim().toUpperCase().substring(0, 20)`.
  3. **Separación fiscal estricta**: Nunca insertar registros de penalización por permanencia en `InternalInvoice` ni incluir `PenaltyInvoice` en consultas del Modelo 560, Tasa Municipal 1,5%, CNMC/MITECO o *True-Up* de comisiones.
  4. **Borrado en Cloudflare R2**: Antes de invocar `deleteFileFromR2(pdfUrl)` al eliminar un borrador no comunicado, verificar siempre `prisma.penaltyInvoice.count({ where: { pdfUrl } }) === 0` para no romper el PDF compartido de una factura multipunto (`-1`, `-2`, ...).
