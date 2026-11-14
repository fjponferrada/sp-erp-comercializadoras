# Guía del Módulo: CRM VENTAS (ERP Comercializadora)

Esta guía detalla la arquitectura, el flujo de negocio y las decisiones de diseño del módulo **CRM Ventas** dentro de nuestro ERP propietario. Está diseñado específicamente para las necesidades de una Comercializadora Eléctrica, permitiendo que Canales y Comerciales operen de manera autónoma con visibilidad filtrada.

---

## 1. Arquitectura de Contratos y Trazabilidad

A diferencia de CRMs genéricos, este sistema utiliza un modelo de **Trazabilidad por Versiones** para mantener el historial de los acuerdos comerciales. Es importante destacar que el versionado pertenece a la "rama" del contrato, no al CUPS en sí.

*   **Versionado (`version`)**: Todo contrato nuevo e independiente nace en su versión base (0 o 1). Si un cliente se va y vuelve años después a la misma casa (mismo CUPS), firmará un contrato totalmente nuevo que volverá a nacer en su versión base. Cualquier modificación posterior sobre un contrato vivo (Cambio de titular, cambio de tarifa) genera un nuevo registro de contrato con `version + 1`.
*   **Encadenamiento (`previousContractId`)**: El nuevo borrador se enlaza al contrato anterior. Esto permite saber de dónde viene un contrato y trazar su árbol genealógico. Dos contratos sin parentesco para el mismo CUPS nunca se cruzarán en sus versiones.
*   **Tipos de Modificación (M1)**: 
    *   **Administrativa (Cambio de Titular)**: Hereda las fechas contractuales (`expectedEndDate`, `permanenceStartDate`) pero cambia el `client` asociado. **Importante:** Debido a la regla de integridad del ERP, un cambio de CIF requiere la creación de un nuevo `SupplyPoint` que apunte al mismo CUPS pero con el nuevo cliente, manteniendo así el histórico de facturación de cada propietario separado.
    *   **Técnica (Cambio de Tarifa/Potencia)**: Modifica los parámetros técnicos (P1-P6) pero mantiene al mismo cliente.

*   **Identidad Unívoca de Suministros**: A nivel de base de datos, los Puntos de Suministro son únicos por la combinación de **CUPS + CIF**. Además, todas las búsquedas y cruces de información (importadores, cálculos de energía) leen **únicamente los primeros 20 caracteres** del CUPS para evitar fallos de vinculación por culpa de los dígitos de control.
*   **Normalización Estricta de NIFs**: En todos los importadores y lógicas de matching, el CIF/NIF debe procesarse siempre con `.trim().toUpperCase()` antes de buscarse en la base de datos. Un espacio invisible accidental en un Excel (ej. `"B12345678 "`) generaría un cliente nuevo fantasma y duplicaría los Puntos de Suministro al no coincidir exactamente.
*   **Exclusión de «Falsas Bajas» y Deduplicación**: En los listados y métricas de **Contratos** (`/contratos`), si un contrato figura en estado `BAJA` o `FINALIZADO` pero existe un contrato hermano para el mismo CUPS (20 primeros caracteres) activado dentro del periodo de gracia de 30 días (renovación, cambio de tarifa o titular), el contrato antiguo se omite automáticamente como «falsa baja» para no inflar la tasa de bajas ni duplicar filas históricas.
*   **Consulta de Cartera Histórica («Activos a fecha»)**: En la barra de filtros de `CRM Ventas > Contratos` se incluye el selector **Activos a fecha**. Al elegir cualquier día (`YYYY-MM-DD`):
    *   La tabla filtra todos los contratos que estaban vigentes en esa fecha exacta (`activationDate <= fecha 23:59:59`, `signDate === null` o `<= fecha 23:59:59`, y `terminationDate === null` o `> fecha 23:59:59`), incluyendo tanto contratos con comisión activa > 0 € como contratos con comisión 0 €.
    *   **Exclusión de renovaciones firmadas en fecha posterior y Deduplicación por CUPS (20 caracteres)**: Si existe una renovación (`tipo = 'R'`) firmada con posterioridad a la fecha consultada pero que heredó el `activationDate` del contrato anterior, queda automáticamente excluida de la foto histórica para no duplicar el suministro junto al contrato que estaba realmente en vigor ese día. Además, tanto las filas de la tabla como la exportación Excel y las tarjetas superiores (**Contratos Activos** y **MWh Totales**) se deduplican por los primeros 20 caracteres del CUPS, priorizando el contrato vigente firmado en o antes de la fecha consultada.
    *   No se descartan por «falsa baja» contratos que estuvieran activos en la fecha consultada aunque meses después hayan sido renovados.
    *   El botón **Exportar XLSX** descarga el detalle completo de dichos contratos (`Exportacion_Contratos_Activos_YYYY-MM-DD.xlsx`), priorizando siempre la tarifa propia del contrato (`contract.tariff || supplyPoint.tariff || product.tariff`, preservando tarifas especiales como `3.0TDVE`), omitiendo `FECHA_BAJA_ESTIMADA`, dejando vacío `CG BOLSILLO SOLAR` cuando `bolsilloSolar` es `false`/`null` y mostrando el nombre legal de la Distribuidora junto a `codigo_ree_distri`.
*   **Aislamiento de Snapshot en Contrato y Sincronización Atómica al pasar a `ACTIVO`**:
    *   **Snapshot Inmutable**: Cada registro `Contract` conserva la foto fija histórica de las condiciones firmadas (`p1c`–`p6c`, `p1e`–`p6e`, `p1p`–`p6p`, `fee`, `tariff`, `iban`). Editar un contrato desde `EditContractModal` (`updateContractFull`) nunca sobrescribe arbitrariamente la ficha maestra de `Client` ni de `SupplyPoint`.
    *   **Sincronización Atómica en Activación**: Exclusivamente cuando el contrato transiciona al estado `ACTIVO` (`existing.status !== 'ACTIVO' && status === 'ACTIVO'`), el backend sincroniza atómicamente `tariff`, `iban` y las potencias contratadas `p1c`–`p6c` hacia la entidad maestra `SupplyPoint`.
    *   **Mapeo Automático de Códigos ATR (`tipo` y `tipoC2`)**: Se calculan automáticamente a partir de `tramitationType` mediante `getTramitationCodes(tramitationType)`, preservando `'R'` (Renovación) y `'E1'` (Desistimiento) cuando el tipo de tramitación no ha cambiado.
*   **Ficha Detalle de Contrato (`/contratos/[id]`) e Historial del Contador Físico**:
    *   **Agregación Multi-Clon por Raíz CUPS (20 caracteres)**: En `/contratos/[id]`, el **Resumen Histórico (MWh / €)**, las **Facturas F1** y los **Eventos de Switching XML** se consultan agrupando todos los `SupplyPoint` de la marca que comparten los primeros 20 caracteres del CUPS (`cups.substring(0, 20)`), manteniendo visible toda la vida física del contador incluso tras cambios de titularidad (subrogaciones o traspasos).
    *   **Jerarquía de Lectura e Interactividad**: Las potencias contratadas (`P1C`–`P6C`) priorizan las columnas nativas de `Contract` sobre `airtableData`; el Consumo Anual Estimado sigue la jerarquía `lead.estimatedMWh ?? contract.annualConsumption ?? supplyPoint.annualConsumption`; el nombre del producto abre el modal interactivo `<ProductModal>` con el desglose P1–P6; y el Razón Social/NIF y el CUPS enlazan directamente a `/clientes/[id]` y `/puntos-suministro/[id]`.

---

## 2. Gestión de Fechas (El núcleo del ciclo de vida)

Para que el sistema de facturación, renovaciones y switching funcione sin colisiones, las fechas se tratan de manera totalmente independiente:

*   `activationDate` (Fecha Activación): La fecha real en la que la distribuidora activó el suministro.
*   `fechaPrevistaActivacion`: Fecha estimada que marca el usuario o el sistema antes de que la distribuidora confirme la activación.
*   `expectedEndDate` (Fin Previsto): Fecha de caducidad legal del contrato. **Vital para el motor de renovaciones**. Se hereda íntegramente en las modificaciones (M1) para no perder de vista cuándo caduca realmente el acuerdo.
*   `terminationDate` (Fecha Baja): La fecha real en la que el cliente dejó de estar activo con nosotros (Paso 06 del Switching).
*   `fechaPrevistaBaja`: Exclusiva del **Paso 11 del Switching**. Es un aviso temprano de la distribuidora. **No sobreescribe** la `expectedEndDate`, garantizando que a nivel legal el contrato mantiene sus plazos, pero activando alarmas visuales para retención.

---

## 3. Renovaciones y Fidelización

El módulo de **Renovaciones** es el motor proactivo del CRM:

*   **Ventana de 90 días**: Solo se muestran en la tabla de renovables los contratos `ACTIVOS` o `TRAMITANDO` cuya `expectedEndDate` esté a 90 días o menos de caducar.
*   **Bloqueo por trámites pendientes**: Si un contrato tiene un "hijo" (`previousContractId` apuntando a él) que no esté `RECHAZADO` ni `CANCELADO`, el sistema asume que ya hay un trámite en marcha (ej. un cambio de titular pendiente de activar) y bloquea el contrato antiguo poniéndole la etiqueta **✅ Renovado**.
*   Una vez que el "hijo" se activa, el padre pasa a `FINALIZADO` (desapareciendo de la tabla), y el hijo ocupa su lugar, siendo renovable de nuevo cuando se acerque su fecha de fin.

---

## 4. Bajas, Winback y Emisión de Ofertas

El panel de **Bajas** se alimenta directamente de los eventos del motor de Switching (importadores F1 e Ingesta XML):

*   **Alerta Temprana (Paso 11)**: Cuando otra comercializadora solicita el CUPS, recibimos un Paso 11. El ERP pone el contrato en la sección de Bajas, permitiendo actuar al departamento de retención.
*   **Ofertas Automáticas (Resend)**: Los comerciales pueden enviar contraofertas en 1 clic. El ERP genera un PDF y un Email que distinguen inteligentemente entre:
    *   **Tarifas Fijas**: Muestran la tabla de precios (P1 a P6).
    *   **Tarifas Indexadas**: Ocultan la tabla a 0€ y muestran el texto legal: *"facturado a precio de mercado (Indexado) más un margen de comercialización (Fee)"*.
*   **Navegación Fluida**: El CUPS es clicable para auditar el contrato en detalle, y el botón de volver (`router.back()`) recuerda el estado del buscador y los filtros de la tabla de bajas.
*   **Seguridad de Datos (RBAC)**: Para proteger la información confidencial de la empresa, los KPIs superiores (Bajas del mes, MWh perdidos, Vida media) y la columna de **Penalización** económica están ocultos de forma segura para los usuarios con rol `COMERCIAL` y `CANAL`. Solo los perfiles de `BACKOFFICE` y `SUPERADMIN` tienen acceso a estas métricas sensibles.

---

## 5. Penalizaciones, Preavisos y Cálculo Energético

El sistema cuenta con un motor de cálculo de penalizaciones por incumplimiento de permanencia, adaptado estrictamente a la normativa legal y validado para su facturación directa.

*   **Alerta de Preaviso y Cálculo Unificado**: Los clientes no residenciales (empresas, CIFs y personas físicas con CNAE 9820/9821) tienen cláusula de preaviso de 1 mes antes del vencimiento. Si causan baja dentro de esa ventana de preaviso (ej. en los últimos 30 días antes de `expectedEndDate`), el ERP detecta el incumplimiento y muestra un icono de alerta visual (⚠️) en la tabla de Bajas; no obstante, el **cálculo automático de la penalización económica se unifica para todos los clientes** (residenciales y no residenciales) computando exclusivamente los días reales pendientes hasta el fin de la permanencia original (1 año desde `permanenceStartDate` o `activationDate`), sin encadenar prórrogas automáticas de 12 meses en el importe sugerido.
*   **Cálculo Legal de la Penalización**:
    *   **Tarifas de Baja Tensión (2.0TD, 3.0TD)**: La ley (RD 1435/2002) permite penalizar con un máximo del **5% sobre el precio del contrato por la energía estimada pendiente**.
    *   **Tarifas de Alta Tensión (6.XTD)**: Por cláusula contractual, se aplica un precio fijo de **30 €/MWh (0,03 €/kWh)** sobre la energía estimada pendiente.
*   **Media Ponderada de Precios**: Para que la estimación sea lo más fiel a la realidad de consumo del cliente, no se usa el precio del periodo P1, sino que el ERP extrae una media ponderada de todos los precios (ej. en 2.0TD, 50% P3 + 25% P1 + 25% P2) a la que multiplica por la energía diaria estimada (Consumo Anual / 365 * Días Restantes).
*   **Trazabilidad Financiera**: El cálculo base del sistema es **siempre la Base Imponible**. El 21% de IVA se inyecta de forma dinámica exclusivamente en el momento de generar y pintar el documento PDF final de la factura de penalización, evitando descuadres y cruces de "peras con manzanas" en los listados del CRM.
*   **Integridad y Seguridad en Facturas de Penalización (`/facturas-penalizaciones`)**: Una vez que una penalización se marca como "Ya Facturada", el input numérico se bloquea y se emite la factura (deduplicando sufijos si un mismo PDF engloba a múltiples CUPS o contratos). En el histórico de **Facturas de Penalizaciones**, los usuarios con rol `COMERCIAL` o `CANAL` tienen acceso de **solo lectura y descarga de PDF**: los selectores múltiples (checkboxes), los botones de **Marcar Comunicadas**, **Comunicar** por email y **Eliminar** factura están restringidos exclusivamente a `SUPERADMIN`, `COMPANYADMIN` y `BACKOFFICE`.

---

## 6. Gestión de Facturas de Clientes (`/facturas`, `/facturas/[id]`) e Importación Ingebau (`/importar-facturas`)

El módulo de **Facturas** dentro de CRM Ventas centraliza todos los recibos minoristas emitidos a clientes finales (tanto los importados desde **Ingebau / Switching** como los confirmados desde el **Motor de Facturación Interna** con `origin: 'INTERNAL_ENGINE'`).

*   **Listado de Alto Rendimiento y Filtros Avanzados (`/facturas`)**:
    *   La consulta paginada proyecta únicamente las columnas escalares necesarias (omitiendo la carga del objeto JSONB `invoiceData` completo en el listado) para responder de forma instantánea sobre decenas de miles de recibos.
    *   **Búsqueda integral**: Filtra por Nº de Factura, Razón Social, Primer y Segundo Apellido (`lastName`, `lastName2`), CIF/NIF, Código de Contrato (`contractCode`) y CUPS (recortando automáticamente a los primeros 20 caracteres).
    *   **Filtros dinámicos**: Rango de fechas ajustado al huso horario `Europe/Madrid`, selector `Tipo` generado dinámicamente y ordenado alfabéticamente (`Abono`, `Complementaria`, `Normal`, `Penalización`, `Rectificativa`, `Regularizadora`, además de `Bolsillo Solar`), estado de comunicación (`Comunicadas` / `Pte. Envío`) y estado documental en la nube (`Con PDF en nube` en R2 vs `Sin PDF / Caducado` para URLs heredadas expiradas de Airtable).
*   **Coherencia Integral de Signo en Abonos**:
    *   Toda factura de tipo **`Abono`** (incluyendo tipos `'ABONO'` y códigos sintéticos de rectificativa/abono `'A'`, `'AR'`, `'S'`) se representa y computa con signo negativo (`-Math.abs(...)` / `-ABS(...)`) sin doble negación de forma uniforme en: (1) la tabla `/facturas`, (2) la ficha detallada `/facturas/[id]`, (3) los KPIs acumulados en la ficha del cliente (`/clientes/[id]` — `Facturación Histórica` y `Energía Consumida MWh`), (4) la exportación Excel (`/api/facturas/export`, negando todos los campos numéricos desde `Dias` en adelante, tanto al exportar toda la vista filtrada como al exportar una selección manual de checkboxes), (5) el **Resumen Histórico** en la ficha de contrato (`/contratos/[id]`, `HistoricalChart.tsx`), y (6) el **Cuadro de Mando Analítico** (`analysisActions.ts` — `getMonthlyMarginsAction` y `getTariffBreakdownAction`).
*   **Ficha Detallada (`/facturas/[id]`) y Diccionario CNMC V3.0**:
    *   Separa estrictamente la **Cuota Total de IVA** (`Importe IVA`) del **Impuesto Eléctrico** (`taxAmount`, descartando banderas internas como `IE Odoo = "0x10"`), muestra la **Compensación de Excedentes realmente aplicada** (`Importe Excedentes Autoconsumo Aplicado`) diferenciándola del tope normativo RD 244/2019, y lee los **Días Facturados** reales (`Dias`) en lugar de la duración anual del contrato.
    *   Presenta las **5 tarjetas del Bolsillo Solar** (`Descuento Aplicado`, `Saldo Inicial`, `Llenado`, `Uso en Factura`, `Saldo Final`), traduce los códigos oficiales **CNMC V3.0** (`Tabla 44` Procedencia, `Tabla 101` Motivo de Facturación, `Tabla 102` Tipo de Factura y `Tabla 113` Autoconsumo) y ofrece enlaces directos entre la factura rectificada origen y sus rectificativas/abonos.
*   **Comunicaciones Email y Activos en Cloudflare R2**:
    *   Los envíos individuales/masivos y recordatorios de pago usan el remitente oficial de la marca (`supportEmail` / dominio corporativo), priorizan `invoiceEmail` frente a `contactEmail` y exigen un PDF válido alojado en Cloudflare R2 (bloqueando enlaces locales o caducados).
    *   Permite descarga individual de PDF y XML y descarga masiva en ZIP (`/api/facturas/download-zip`) con concurrencia controlada.
*   **Importación Defensiva desde Ingebau (`/importar-facturas`)**:
    *   **CSV / Excel**: Auto-detecta codificación `UTF-8` frente a `Windows-1252` (ANSI) para preservar tildes, parsea importes en formato español (`1.948,56`), indexa suministros por `${clientId}_${cups20}` conservando el CUPS completo de 22 caracteres, crea clientes nuevos distinguiendo `Persona física` vs `Empresa` (sin contaminar `contactEmail` con el `Email Emisora` ni `contactPhone` con teléfonos `900` de averías), prioriza el cruce por código explícito `CONTRATO` (eligiendo la versión vigente en `billingStart` antes del fallback por potencias/fechas), rellena las columnas nativas (`origin`, `paymentDate`, `xmlUrl`) y auto-vincula la `F1Invoice` correspondiente.
    *   **Subida Paralela PDF / XML**: Sube en lotes concurrentes a Cloudflare R2 (`.pdf`/`.PDF`, `.xml`/`.XML`), actualiza tanto `Invoice.xmlUrl` como `invoiceData.xmlUrl`, sustituye automáticamente URLs caducadas de Airtable e incorpora opción explícita de sobrescritura.

---

## 7. Rendimiento y Base de Datos (Prisma Postgres / Vercel)

Al alojar la base de datos en **Prisma Postgres (`db.prisma.io`)** y la web en **Vercel (Serverless)**, la gestión de conexiones es crítica:

*   **El problema del Serverless**: Vercel levanta múltiples instancias simultáneas. Si cada instancia pide 5 conexiones a la vez, se supera el límite del plan Hobby rápidamente (`Too many database connections opened`).
*   **Connection Pool Limiting**: En `src/lib/prisma.ts`, la variable `max` del `Pool` de `pg` está configurada a **1 o 2 conexiones máximo por instancia**. Esto fuerza un "cuello de botella" ordenado en la RAM de Vercel (encolando las peticiones) en lugar de tumbar la base de datos PostgreSQL por exceso de aforo.
*   **Fast Refresh Local**: En desarrollo (`npm run dev`), guardar archivos repetidamente puede dejar conexiones fantasma abiertas. La solución local es detener el proceso (`Ctrl+C`) y volver a arrancar el servidor.

---

## 8. Permisos y Visibilidad (Row Level Security en App)

El CRM Ventas asegura que la información esté encapsulada mediante filtros en las "Actions" y Route Handlers (ej. `getDashboardMetricsAction`, `getInvoiceVisibilityFilter`):

*   **COMERCIAL**: Solo ve los contratos, leads y facturas donde su `userId` coincida. En **Facturas** (`/facturas`, `/facturas/[id]`) y en la pestaña de facturación de `/clientes/[id]`, opera estrictamente en **solo lectura** (sin permisos de edición de estado de pago, envío de correos, subida de PDFs ni visualización de rentabilidad interna).
*   **CANAL**: Ve lo suyo y todo lo de los comerciales que cuelgan de su `channelId`, igualmente en modo **solo lectura** sobre facturación y penalizaciones.
*   **BACKOFFICE / COMPANYADMIN / SUPERADMIN**: Visibilidad total de la comercializadora activa (respetando la marca seleccionada en el selector multi-marca `active-brand`) y permisos de escritura, comunicación e importación (`assertWritePermission`). Acciones críticas de mantenimiento masivo (como `/api/clear-invoice`) están restringidas exclusivamente a `SUPERADMIN` mediante confirmación explícita.
*   **Blindaje Transversal de Endpoints de Facturación**: El filtro `getInvoiceVisibilityFilter()` se aplica de forma obligatoria tanto en el listado `/facturas` como en el acceso directo por URL a `/facturas/[id]`, la exportación `/api/facturas/export` y la descarga masiva `/api/facturas/download-zip`.
*   **Gráfica de Evolución de Cartera y KPIs Analíticos en Dashboard**: En el panel principal y de análisis, la gráfica **Evolución de Cartera (MWh y Contratos)** muestra en el eje vertical izquierdo el número de **Contratos Activos** y en el eje vertical derecho los **MWh** (`Total Activos MWh`, `Altas MWh` y `Bajas MWh`), reflejando ambos indicadores en el tooltip interactivo de cada mes. Asimismo, el KPI **Margen Medio / MWh** en `AnalysisDashboard.tsx` se sincroniza con el último mes con facturación real emitida (`lastInvoicedMonth`), evitando mostrar `0,00 €/MWh` cuando existen meses posteriores con curvas de carga aún pendientes de facturar.
*   Esta arquitectura convierte al sistema en un **CRM propietario multi-tenant**, ahorrando costes de licencias externas (Salesforce, HubSpot) y manteniendo toda la lógica adaptada nativamente al sector eléctrico español.
