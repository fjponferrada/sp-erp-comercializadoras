# Guía Maestra de Regulación: CNMC y MITECO (ERP Comercializadoras)

Esta guía documenta la arquitectura, reglas normativas, fórmulas de cálculo, validaciones preventivas y trazabilidad implementadas en el módulo **REGULACIÓN** (`/regulacion/cnmc` y `/regulacion/miteco`) del ERP.

Toda la implementación cumple estrictamente el **Manual de Archivos del Sistema de Cambio de Comercializador (CNMC SCC v6.0)**, el esquema XSD oficial **`SolicitudesRealizadas_v1.0.xsd`**, la **Circular `CIR/DE/007/25`** de Coberturas de Comercialización, las especificaciones XML del sistema ministerial **ESCILA (`ISO-8859-1`, `ORDEN 1..76`)** y la declaración anual de ventas de energía **DAFNE / FNEE (`GWh` y modelo `DEC_RESP_FNEE`)** ante el MITECO.

---

## 1. ARQUITECTURA TRANSVERSAL Y COMPONENTES IMPLICADOS

| Módulo / Archivo | Responsabilidad Principal |
| :--- | :--- |
| [`src/lib/regulacionServer.ts`](../src/lib/regulacionServer.ts) y [`src/lib/postalCode.ts`](../src/lib/postalCode.ts) | Núcleo transversal: autenticación y RBAC (`requireRegulatorySession`), aislamiento multi-comercializadora (`resolveActiveRegulatoryCompany`, `buildSwitchingCompanyWhere`), mapeo `R1-xxx` (`createDistributorCnmcMapper`), extracción Tabla 27 (`extractMotivoRechazoCnmc`), catálogos oficiales `ESCILA_PROVINCES` (`01..52` con prefijo estricto de 5 dígitos `getSpanishPostalPrefix`) y `ESCILA_SECTORS` (`1..76`, `mapCnaeToEscilaSector`), codificador binario `ISO-8859-1` (`encodeIso88591Xml`) y registro auditable en `SyncJob` (`logRegulatoryGeneration`, `listRegulatorySubmissions`). |
| [`src/app/api/regulacion/submissions/route.ts`](../src/app/api/regulacion/submissions/route.ts) | API de gestión regulatoria: devuelve datos de la sociedad activa (`Company`), sugerencia automática de versión correlativa (`suggestedVersions`) e histórico de entregas (`GET`), y permite registrar la presentación oficial y adjuntar el justificante PDF en Cloudflare R2 bajo `regulacion/` (`PATCH`). |
| [`src/app/api/cnmc/document/route.ts`](../src/app/api/cnmc/document/route.ts) | Proxy seguro CNMC (`GET` y `POST`): validación de credenciales en tiempo constante (`timingSafeEqual`), soporte de contraseñas con `:` en `Basic Auth` y lista blanca estricta de prefijos técnicos en R2 (`cnmc/`, `cie/`, `reclamaciones/`). |
| [`src/lib/switching/parser.ts`](../src/lib/switching/parser.ts) | Enriquecimiento en ingesta SCTD: en rechazos de actuación en campo (`Paso 04`) y rechazos de reposición (`E2 Paso 12`), asigna `fechaSolicitudDate` a `fechaAR` cuando el XML de la distribuidora no incluye `<FechaRechazo>`, asegurando su trazabilidad en `SI_CODAGE`. |
| [`src/app/api/cnmc/si-codage/route.ts`](../src/app/api/cnmc/si-codage/route.ts) | Generador mensual XML **`SI_CODAGE`** conforme al Manual SCC v6.0 y `SolicitudesRealizadas_v1.0.xsd`, con reconstrucción histórica de 14 meses, modo `?preview=true` y protección frente a meses sin actividad. |
| [`src/app/api/cnmc/tm-codage/route.ts`](../src/app/api/cnmc/tm-codage/route.ts) | Generador trimestral **`TM_CODAGE`** en `.csv` (`;`) y libro Excel `.xls` (pestaña `'Datos'`), filtrado por fecha efectiva de activación trimestral y medido desde `Contract.signatureDate`. |
| [`src/app/api/cnmc/coberturas/route.ts`](../src/app/api/cnmc/coberturas/route.ts) | Generador anual **`Coberturas_<CODAGE>_<AAAA>.csv`** conforme a la Circular `CIR/DE/007/25` (1 fila separada por comas sin cabecera, 10 enteros en `kWh` en Barras de Central). |
| [`src/app/api/miteco/escila/route.ts`](../src/app/api/miteco/escila/route.ts) | Generador anual XML **`ESCILA`** codificado en binario **`ISO-8859-1`**, con catálogo oficial `ORDEN 1..76`, provincias INE `01..52` y consolidación deduplicada `Invoice` + `InternalInvoice`. |
| [`src/app/api/miteco/dafne/route.ts`](../src/app/api/miteco/dafne/route.ts) | Motor de auditoría anual **`DAFNE / FNEE`** en **`GWh`** (triple cruce: Facturado vs CTE `LoadCurve` de contratos vigentes vs `REGANECU` BC) y generador del borrador oficial PDF **`DEC_RESP_FNEE`** (`pdf-lib`). |
| [`src/app/(app)/regulacion/cnmc/CnmcClient.tsx`](../src/app/(app)/regulacion/cnmc/CnmcClient.tsx) y [`src/app/(app)/regulacion/miteco/MitecoClient.tsx`](../src/app/(app)/regulacion/miteco/MitecoClient.tsx) | Interfaces operativas con indicador de sociedad activa (`CIF`, `R2-xxx`, `REE`), periodos inteligentes por defecto, modal de pre-validación (`?preview=true`), controles de `Coberturas` y `DAFNE`, e histórico de entregas con subida de acuse PDF. |

---

## 2. SEGURIDAD, AISLAMIENTO MULTI-SOCIEDAD Y TRAZABILIDAD (`SyncJob`)

1. **Autenticación y Roles (`requireRegulatorySession`):** Todas las rutas bajo `/api/cnmc/*`, `/api/miteco/*` y `/api/regulacion/*` exigen sesión activa (`await auth()`) y rol autorizado (`SUPERADMIN`, `ADMIN`, `OPERATOR`, `GESTOR` o `AUDITOR`).
2. **Aislamiento Estricto por Sociedad Mercantil (`Company`):**
   - Los sujetos obligados ante la CNMC y el MITECO son las sociedades comercializadoras (`Company`), identificadas por su `cif`, `codigoCnmc` (`R2-xxx`) y `codigoRee` (`4 dígitos`).
   - `resolveActiveRegulatoryCompany` resuelve la sociedad activa a partir de la marca seleccionada (`active-brand`) verificada contra los permisos del usuario, aislando todos los eventos de switching (`buildSwitchingCompanyWhere`), contratos, curvas y facturas.
3. **Pre-Validador Sin Efectos Secundarios (`?preview=true`):** Todos los generadores admiten `?preview=true`, devolviendo un resumen JSON estructurado con totales, desglose, advertencias preventivas y muestra de datos antes de emitir el fichero definitivo.
4. **Registro Auditable de Entregas (`SyncJob` `type: 'REGULATORY_SUBMISSION'`):**
   - Cada generación oficial queda registrada automáticamente con el código de reporte (`SI_CODAGE`, `TM_CODAGE`, `COBERTURAS`, `ESCILA`, `DAFNE`), sociedad, periodo, versión correlativa, nombre de archivo, usuario emisor y métricas.
   - En `SI_CODAGE`, el sistema sugiere automáticamente la siguiente versión disponible (`01` para la entrega inicial; `02`, `03`... si ya consta una entrega presentada para ese periodo).
   - El operador puede marcar cualquier entrega como **Presentado (`SUBMITTED`)** y adjuntar el **justificante oficial PDF** devuelto por la sede electrónica, que queda custodiado en Cloudflare R2 (`regulacion/<companyId>/<reportCode>/<period>/...`).

---

## 3. REPORTES REGULATORIOS CNMC (`/regulacion/cnmc`)

### 3.1 `SI_CODAGE` — Solicitudes e Incidencias Mensuales (Manual SCC v6.0)
- **Nomenclatura oficial:** `SI_<CODAGE>_E_<AAAAMM>_<VV>.xml` (ej. `SI_R2-950_E_202606_01.xml`), donde `<VV>` identifica la versión correlativa de la entrega (`01` inicial; `02`, `03`... rectificaciones).
- **Exclusión normativa de `T1`:** Solo se procesan `C1`, `C2` (`TipoCambio = C3`), `A3` (`C4`), `M1`, `B1` (`C5`) y `E1` (`C6`). Los traspasos regulatorios a COR (`T1` / `T1_01`) se excluyen expresamente porque `SolicitudesRealizadas_v1.0.xsd` no contempla `T1`.
- **Resolución real de distribuidora (`R1-xxx`):** Se cruza `distributorReeCode` contra `Distributor.registroCnmc` en base de datos, respaldado por un diccionario verificado de distribuidoras eléctricas españolas (`0021 -> R1-001`, `0031 -> R1-299`, `0022 -> R1-002`, `0026 -> R1-003`, `0024 -> R1-005`, `0027 -> R1-008`, etc.). Si una distribuidora local carece de código `R1-xxx` en el maestro, el pre-validador emite alerta explícita.
- **Doble cómputo en Ejemplo 4 CNMC (`Paso 02` aceptado + `Paso 04` rechazado en campo):**
  - Las aceptaciones se miden en `Paso 02` (`!esRechazoPaso02`).
  - Si un expediente fue aceptado en `Paso 02` y posteriormente rechazado durante la actuación en campo en `Paso 04`, el Manual SCC v6.0 (Ejemplo 4) exige contabilizarlo **tanto en `<Aceptadas>` como en `<Rechazadas>`** (con su `<DetalleRechazos>` Tabla 27).
  - En `parser.ts`, cuando un `Paso 04` (o `E2 Paso 12`) carece de `<FechaRechazo>`, `fechaAR` toma `fechaSolicitudDate` para garantizar su asignación al mes correspondiente.
- **`<TMActivacion>` reglamentario:** Se calcula en días naturales desde la **fecha prevista de activación** (`fechaPrevActivacion` del Paso `02` o fecha de subsanación de incidencia ATR en Paso `03`, con respaldo a la fecha de aceptación) hasta `fechaActivacion`, descartando valores negativos cuando la activación se adelanta a petición del cliente.
- **Reconstrucción histórica inter-mensual (14 meses, `< endYmd`) y tramos pendientes:**
  - Carga una ventana de 14 meses hacia atrás filtrando estrictamente eventos ocurridos antes del cierre del mes declarado (`< endYmd`), haciendo que la regeneración de meses pasados sea 100% determinista e inmune a eventos posteriores.
  - Calcula y emite `<PendientesRespuesta>` + `<DetallePendientesRespuesta>` (`0-5`, `6-10`, `11-15`, `>15` días) y `<PdteActivacion>` + `<DetallePdteActivacion>` (`0-15`, `16-30`, `>30` días).
- **Reposiciones ejecutadas (`<Reposiciones>`):** Suma las reposiciones `E2` efectivamente activadas/ejecutadas en el mes (`pasos 05/06`, `fechaActivacion` en el mes) dentro de la agrupación `C3` correspondiente.
- **Orden XSD estricto y meses sin actividad:** Respeta el orden exacto de `xs:sequence` en `SolicitudesRealizadas_v1.0.xsd`. Si un mes carece por completo de actividad y saldos pendientes, devuelve aviso `422` indicando que según el apartado 2.1.1 del Manual SCC v6.0 debe notificarse por correo a `cambiodecomercializador@cnmc.es` en lugar de subir un XML vacío (ofreciendo `?allowEmpty=true` con `<Cabecera>` XSD válida solo si el operador lo fuerza expresamente).

### 3.2 `TM_CODAGE` — Tiempos Medios de Activación Trimestrales
- **Formatos y nomenclatura oficial (sin sufijo `_01`):**
  - CSV separado por `;`: `TM_<CODAGE>_E_<AAAAT>.csv` con cabecera exacta `CANAL;ACTUACION_CAMPO;IND_ACTIVACION;NUM_ACTIVADAS;TIEMPO_MEDIO` y decimales con coma.
  - Libro Excel `.xls` (`?format=xls`): `TM_<CODAGE>_E_<AAAAT>.xls` con pestaña llamada exactamente **`Datos`** y celdas numéricas reales.
- **Criterio temporal y medición desde consentimiento:**
  - Filtra procesos `C1`, `C2` y `A3` cuya **activación efectiva (`fechaActivacionAlta`)** pertenezca al trimestre declarado (incluyendo solicitudes enviadas en el trimestre anterior que se activan en el actual).
  - Calcula `TIEMPO_MEDIO` en días naturales desde la **fecha de consentimiento del cliente (`Contract.signatureDate`)** hasta `fechaActivacionAlta` (con respaldo a `fechaSolicitudDate` de `Paso 01` si el contrato histórico carece de `signatureDate`).
  - Excluye cualquier evento de rechazo mediante `includes('RECHAZ')` y garantiza códigos válidos de `CANAL` (`P` Presencial, `D` Domiciliario, `T` Telefónico, `O` Otros/Online).

### 3.3 `Coberturas` (`CIR/DE/007/25`) e `IVC_CODAGE`
- **Circular `CIR/DE/007/25` (`/api/cnmc/coberturas`):**
  - Genera `Coberturas_<CODAGE>_<AAAA>.csv` para el año `N+1` (presentación anual entre el 1 y el 15 de diciembre): **1 única fila de 10 campos separados por comas (`,`), sin fila de cabecera y expresados en enteros `kWh` en Barras de Central (`BC`)**.
  - Cruza automáticamente los contratos `PpaContract` activos para `N+1` (volumen físico vs financiero y plazo `<= 1 año` vs `> 1 año`), la demanda anual `CAD` del último cierre `REGANECU` y la proporción de cartera a precio fijo vs indexado, permitiendo editar/verificar los campos `c2..c10` desde `CnmcClient.tsx` antes de exportar.
- **`IVC_CODAGE`:** Informa con transparencia en la interfaz de que este reporte anual de ofertas y comercializadores vinculados debe cumplimentarse sobre la plantilla Excel oficial publicada cada ejercicio en la Sede Electrónica de la CNMC.

### 3.4 Cumplimiento Regulatorio CNMC en Factura Eléctrica al Consumidor Final (Circular 2/2021, `BOE-A-2022-16989` y RD 88/2026)
Además de los ficheros periódicos remitidos a la CNMC, el motor nativo de facturación cumple íntegramente las obligaciones regulatorias de información en factura supervisadas por la CNMC (Regla 275):
- **Etiquetado Anual de la Electricidad por Comercializadora (`Company.etiquetaCnmc` — Circular 2/2021 de la CNMC):**
  - Cada mes de abril, cuando la CNMC publica el informe anual de origen de la electricidad e impacto ambiental de cada comercializadora, el administrador actualiza los valores oficiales desde **`Configuración → Comercializadoras` (`/comercializadoras`)** (validados por [`src/lib/cnmcLabelConfig.ts`](../src/lib/cnmcLabelConfig.ts)): año del etiquetado, acreditación `100% Renovable GdO`, letra media nacional (`A–G`), desglose porcentual de las **7 tecnologías** (Comercializadora vs Mix Nacional con validación estricta de suma `100%`) e intensidades y letras `A–G` de emisiones de $\text{CO}_2$ (`g/kWh`) y residuos radiactivos de alta actividad en **`µg/kWh`** (nunca `mg/kWh`).
  - [`InvoicePdfTemplate.tsx`](../src/components/pdf/InvoicePdfTemplate.tsx) dibuja de forma vectorial (`<Svg>`) el gráfico circular multisegmento y las escalas ambientales `A–G` específicos de la sociedad emisora, además de rotar en el margen izquierdo su inscripción registral (`Company.registroMercantil`) y código CNMC (`Company.ordenCnmc`).
- **Código QR Oficial del Comparador de Ofertas CNMC (`Resolución CNMC 29/09/2022`, `BOE-A-2022-16989` Anexo I):**
  - En todos los suministros `2.0TD` con potencia contratada `<= 15 kW`, se inserta un código QR vectorial de tamaño `>= 3 x 3 cm` (`88 x 88 pt`) acompañado del enlace clicable `https://comparador.cnmc.gob.es`, apuntando a `https://comparador.cnmc.gob.es/comparador/QRE?...` con `verde=1/0` sincronizado automáticamente con `Company.etiquetaCnmc.is100RenewableGdo`, parámetros condicionales según `tf` (`N` vs `R`/`A`) y omisión de `finPen` cuando la permanencia inicial ya ha vencido.
- **Histórico de 14 Meses, Consumo Medio CP y Pérdidas de Transformación (`RD 88/2026` y `Art. 15 RD 1619/2012`):**
  - Incluye gráfico vectorial de evolución de los últimos 14 meses, consumo medio del código postal (`ValorEnergiaMediaCP` de `<InformacionAlConsumidor>`), potencias máximas demandadas del último año, desglose de pérdidas de transformación cuando `ConsumoCalculado != TerminoEnergiaActiva` y nota fiscal completa de rectificación `(1)` sobre la factura sustituida.

---

## 4. REPORTES REGULATORIOS MITECO (`/regulacion/miteco`)

### 4.1 `ESCILA` — Estadística Anual de Comercialización Eléctrica
- **Codificación binaria `ISO-8859-1` real:** El endpoint `/api/miteco/escila` construye el prólogo `<?xml version="1.0" encoding="ISO-8859-1"?>`, aplica `escapeXml` a todos los campos de texto y codifica la respuesta en bytes `Latin1` reales (`encodeIso88591Xml`) con `Content-Type: application/xml; charset=ISO-8859-1`.
- **Catálogo oficial `ORDEN 1..76` y provincias INE `01..52`:**
  - Mapea automáticamente el código `CNAE-2009` de cada suministro/contrato/cliente a los 76 sectores oficiales de actividad económica del formulario ministerial (`ESCILA_SECTORS`, donde `75` corresponde a usos domésticos/residenciales y `76` a comercio y servicios no clasificados).
  - Clasifica el territorio por código INE provincial (`01..52`) extrayendo el prefijo de 2 dígitos únicamente tras normalizar a 5 dígitos españoles válidos (`getSpanishPostalPrefix` en [`src/lib/postalCode.ts`](../src/lib/postalCode.ts), evitando que CPs de 4 cifras sin `'0'` como `"5230"` Ávila se imputen a `52` Melilla), con respaldo por nombre de provincia (`ESCILA_PROVINCES`).
- **Consolidación contable, aislamiento de pruebas y suministros activos a 31 de diciembre:**
  - Consolida las facturas oficiales `Invoice` emitidas por la sociedad activa en el ejercicio (sumando `InternalInvoice` deduplicada **únicamente** cuando `isInternalBillingProductionEnabled()` sea `true`, es decir, `ENABLE_INTERNAL_BILLING_PRODUCTION=true`, para no contaminar declaraciones con borradores/recibos de prueba mientras Ingebau sea el facturador oficial), restando energía e importe neto en facturas rectificativas/abonos.
  - Expresa `<ENERGIA>` en **`MWh` con punto decimal y 3 decimales** e `<INGRESOS>` (base neta excluido IVA e Impuesto Eléctrico) en **miles de euros con punto decimal y 2 decimales**.
  - Computa `<NUM_CUPS>` y `<NUM_EMPRESAS>` (NIFs distintos no domésticos) con contrato vigente a **31 de diciembre** del año declarado, omitiendo la etiqueta `<NUM_EMPRESAS>` cuando su valor es `0` (como ocurre en el sector doméstico `ORDEN 75`).

### 4.2 `DAFNE / FNEE` — Declaración Anual de Ventas al Fondo Nacional de Eficiencia Energética
- **Magnitud oficial (`GWh`):** Antes del 30 de junio de cada año, cada comercializadora declara sus ventas de energía eléctrica a consumidores finales del año `N-1` expresadas en **Gigavatios-hora (`GWh = kWh / 1.000.000`) con coma decimal y hasta 6 decimales**.
- **Triple Auditoría Cruzada en Tiempo Real (`/api/miteco/dafne`):**
  1. **Facturación Consolidada (Criterio Principal):** Suma neta de `kWh` facturados a cliente final (`Invoice`, incorporando `InternalInvoice` deduplicada solo cuando `isInternalBillingProductionEnabled()` está activo en producción, netas de abonos) dividida entre `1.000.000`.
  2. **Telemedida `LoadCurve` de Contratos Vigentes:** Consulta SQL optimizada con CTE (`WITH active_contracts AS (...), matched_curves AS (...)`) que desagrega `unnest(readings)` **exclusivamente** en las fechas en que el CUPS tuvo un contrato `ACTIVO`, `BAJA` o `FINALIZADO` con la sociedad declarante (`startDate <= curve.date <= endDate`), impidiendo inflar la cifra con curvas SIPS históricas previas al alta con la comercializadora.
  3. **Liquidación Mayorista `REGANECU` (`BC`):** Energía adquirida en Barras de Central (`kWhCompraBC`) como referencia técnica superior (incluye pérdidas de red).
- **Borrador Oficial PDF `DEC_RESP_FNEE` (`?format=pdf`):** Genera un documento PDF de 2 páginas (`pdf-lib`) con el formato de Declaración Responsable de Ventas de Energía para el FNEE, incluyendo datos societarios, cifra oficial en `GWh` (copiable en 1 clic desde la UI) y cuadro anexo de conciliación de las 3 fuentes para archivo de auditoría interna.

---

## 5. REGLAS DE ORO DE MANTENIMIENTO (RESUMEN DE INMUTABILIDAD)

1. **Nunca volver a incluir `T1` en `SI_CODAGE`** ni omitir los nodos `<DetallePendientesRespuesta>` / `<DetallePdteActivacion>` cuando existan expedientes abiertos a fin de mes.
2. **Nunca medir `TM_CODAGE` filtrando por fecha de solicitud (`Paso 01`) ni añadir `_01` al nombre del archivo**: el trimestre se filtra siempre por `fechaActivacionAlta` y el tiempo medio parte de `Contract.signatureDate`.
3. **Nunca emitir `Coberturas` con fila de cabecera, decimales o separadores de miles**: la Circular `CIR/DE/007/25` exige 1 sola línea CSV de 10 enteros en `kWh BC`.
4. **Nunca devolver `ESCILA` en `UTF-8` si el encabezado declara `ISO-8859-1`**: mantener siempre `encodeIso88591Xml`.
5. **Nunca sumar `LoadCurve` en `DAFNE` sin cruzar contra la vigencia `[startDate, endDate]` de los contratos de la sociedad declarante**.
