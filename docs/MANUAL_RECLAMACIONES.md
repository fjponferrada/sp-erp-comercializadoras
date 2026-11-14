# Manual de Reclamaciones R1 y Procesos Asociados (CNMC V3.0)

Esta guía documenta la arquitectura completa, reglas de negocio, esquemas XSD, catálogos CNMC V3.0 y flujos operativos implementados en el módulo de Reclamaciones del ERP (`/reclamaciones`, `/reclamaciones/generar` y pestaña `Reclamaciones` en `/contratos/[id]`).

---

## 1. Mapa de Archivos del Ecosistema R1

| Archivo | Responsabilidad Principal |
| :--- | :--- |
| `src/app/(app)/reclamaciones/utils/cnmc_codes.ts` | Catálogos maestros CNMC V3.0: Tablas **27** (Rechazos), **61** (Tipos Documentación), **80** (Resultados Cierre), **81** (Motivos R1), **82** (Submotivos R1 eléctricos) y **84** (Tipos Comunicación Paso 03) + normalizadores `normalizeTipoR1` / `normalizeSubtipoR1`. |
| `src/app/(app)/reclamaciones/utils/casuisticas.ts` | Matriz de campos requeridos y opcionales por submotivo (`001..081`), obligatoriedad condicional (`076 + MotivoConsulta 02`), y listas `SUBTIPOS_SIN_CUPS` / `SUBTIPOS_CLIENTE_OPCIONAL`. |
| `src/lib/switching/parser.ts` | Decodificador seguro `decodeXmlBuffer` (`ISO-8859-1` / `Windows-1252` / `UTF-8`) y bloque aislado `procesoBase === 'R1'` para parsear los pasos `01`, `02`, `03`, `04`, `05`, `08` y `09`. |
| `src/app/actions/switchingIngest.ts` | Clave única `buildSwitchingUniqueProcess` (`SINCUPS` + sufijo `#Sxx`), enlace automático a `contractId` y `supplyPointId` sin crear Tickets ni falsos warnings `CUPS_NO_ENCONTRADO`, anulación en Paso `09` y helper `ingestXmlStringInternal`. |
| `src/app/actions/claimsActions.ts` | Ensamblado en memoria de `ClaimSummary` con visibilidad multi-marca (`getSupplyPointVisibilityFilter`), estados operativos, alcance multi-clon para contratos, contadores por pestaña y exportación completa (`limit = 0`). |
| `src/app/actions/reclamacionesActions.ts` | Búsqueda consolidada por CUPS de 20 caracteres, cruce `Invoice` + `F1Invoice` en retrasos `006`, detector de reclamaciones abiertas `getOpenR1ByBaseCups`, constructor XML XSD estricto y auto-ingesta en ERP. |
| `src/app/api/cnmc/document/route.ts` | Proxy autenticado (`GET` y `POST`, Basic Auth o query `user`/`password`) que sirve a las distribuidoras los adjuntos alojados en Cloudflare R2 (`cnmc/`). |
| `src/app/(app)/reclamaciones/page.tsx` y `ReclamacionesClient.tsx` | Bandeja general (paginación por defecto `100`), pestañas de estado con contadores, modal de cronología íntegra y exportación Excel multi-paso. |
| `src/app/(app)/reclamaciones/generar/page.tsx` y `GenerarReclamacionClient.tsx` | Generador Individual (con soporte `?cups=...`), Masivo Manual (`009`) y Masivo Automático (`006`), adjuntos Tabla 61, avisos de R1 abierta y auto-registro en ERP. |
| `src/app/(app)/contratos/[id]/page.tsx` y `ContractDetailClient.tsx` | Pestaña `Reclamaciones` en ficha de contrato con historial consolidado de todos los clones `SupplyPoint` del CUPS y acceso directo `+ Nueva Reclamación R1`. |

---

## 2. Arquitectura de Datos, Ingesta y Estados (`SwitchingEvent`)

### 2.1. Aislamiento Estricto del Proceso R1 (Reglas 114, 125 y 237)
* **Separación B2B vs B2C:** Las reclamaciones a distribuidora viven exclusivamente en `SwitchingEvent` (`procesoBase = 'R1'`). Jamás crean registros en `Ticket` (`/incidencias`).
* **Aislamiento de semántica de pasos:** En `parser.ts` y `switchingIngest.ts`, los pasos de `R1` están encapsulados bajo `procesoBase === 'R1'` (enviados por comercializadora: `01, 04, 08`; recibidos de distribuidora: `02, 03, 05, 09`) para no interferir con `C1, C2, M1, M2, A3, B1, B2, D1, E1, E2`.
* **Vinculación automática a Contrato y Punto de Suministro:** Al ingerir un XML R1 con CUPS, el sistema busca todos los `SupplyPoint` que comparten la raíz de 20 caracteres del CUPS y enlaza `supplyPointId` y `contractId` priorizando el contrato `ACTIVO` vigente (y en su defecto el más reciente). En acometidas sin CUPS (`018, 019, 030, 031, 076`) o CUPS ajenos (`007`), se ingiere limpiamente sin levantar falsos errores `CUPS_NO_ENCONTRADO`.
* **Soporte de Secuencial (`SecuencialDeSolicitud`):** `buildSwitchingUniqueProcess` mantiene intacto el formato histórico para secuencial `01` e incorpora sufijo `#Sxx` cuando `secuencialSolicitud !== '01'` en pasos iterativos (`03, 04, 08, 09`), preservando cada intercambio de información adicional.
* **Decodificación Automática `ISO-8859-1` / `Windows-1252` / `UTF-8`:** `decodeXmlBuffer` evita cualquier carácter corrupto (`\uFFFD`) cuando la distribuidora envía acentos en `latin1`. *(Los **1.212 eventos históricos R1** existentes en producción fueron retroalimentados y saneados al 100% con esta lógica).*

### 2.2. Ciclo de Vida y Estados Integrados (`ClaimSummary`)

| Paso | Dirección | Datos Extraídos y Regla de Estado en ERP |
| :--- | :--- | :--- |
| **01** | Comercializadora → Distribuidora | Apertura (`<Comentarios>`, `Tipo` 2 dígitos, `Subtipo` 3 dígitos, `FechaLimite`). Estado inicial: **`En Proceso`**. |
| **02** | Distribuidora → Comercializadora | Si es aceptación (`CodigoReclamacionDistribuidora`) → **`Aceptada`**. Si contiene `<Rechazos><Rechazo>` → **`Rechazada`** (traducido con Tabla 27 CNMC). |
| **03** | Distribuidora → Comercializadora | `TipoComunicacion` (Tabla 84 `COM_01..04`), `FechaLimiteEnvio`, `<Retipificacion>` (actualiza `Tipo`/`Subtipo` del expediente) y `SolicitudesInformacionAdicional`. Si el último Paso `03` es `01` (*Solicitud de información adicional*) y no existe Paso `04` posterior ni cierre `05` → **`Pte. Info (Paso 03)`**. |
| **04** | Comercializadora → Distribuidora | Envío de información adicional (`estadoAR = 'INFO_ENVIADA'`). Devuelve el expediente a seguimiento activo hasta recibir nuevo `03` o `05`. |
| **05** | Distribuidora → Comercializadora | Cierre definitivo (`DatosCierre`: `ResultadoReclamacion` Tabla 80 `01..05`, `DetalleResultado` Tabla 73, `IndemnizacionAbonada`, `Observaciones + Comentarios`) → **`Cerrada`**. |
| **08 / 09** | C → D / D → C | Solicitud y respuesta de anulación. Si Paso `09` es `ACEPTADO`, marca `isAnnulled = true` → **`Anulada`**. |

* **Cálculo de `diasAbierta`:** Solo se calcula para expedientes vivos (`En Proceso`, `Aceptada`, `Pte. Info (Paso 03)`). Para expedientes finalizados (`Cerrada`, `Rechazada`, `Anulada`) devuelve `null` (`-`).
* **Filtrado Post-Agrupación (Regla 197):** `getClaimsAction` ensambla primero el mapa completo de expedientes para no perder pasos hermanos y aplica después el buscador, el filtro por pestaña de estado y la paginación (por defecto **100 filas**).

---

## 3. Generación del XML (Estándar CNMC V3.0 — Reglas 189–193 y 238–239)

### 3.1. Selección del Titular Legítimo y Casuísticas Especiales
1. **Heurística de Contrato Activo y `<CUPS>` de 22 caracteres:** Se buscan todos los clones `SupplyPoint` de los primeros 20 caracteres del CUPS, eligiendo el que tenga contrato `ACTIVO` (o `terminationDate` más reciente), e inyectando siempre en `<CUPS>` los **22 caracteres completos** exigidos por `TipoCUPS` en XSD.
2. **Submotivos sin `<CUPS>` (`018`, `019`, `030`, `031` y `076` con `MotivoConsulta = 02`):** Se omite por completo la etiqueta `<CUPS>` de `<CabeceraReclamacion>` y se utiliza el código REE de la distribuidora seleccionada manualmente en pantalla.
3. **Submotivos con `<Cliente>` opcional o CUPS ajeno (`007`):** Permite informar un CUPS externo no registrado en el ERP y omite el bloque `<Cliente>` cuando no se dispone de datos del titular, evitando etiquetas vacías prohibidas por `minLength="1"`.
4. **Mapeos y obligatoriedades dinámicas:** Excluidos los submotivos exclusivos de Gas (`033, 050, 054, 068`); corregidos `070 -> '01'` y `078/080/081 -> '03'`; `NumExpedienteAcometida` exigido dinámicamente en `076` cuando `MotivoConsulta === '02'`; `CodigoSolicitud` opcional en `079`.

### 3.2. Ordenación XSD Estricta en `<VariableDetalleReclamacion>` (`XSD_ORDER`)
El esquema `ReclamacionPeticion.xsd` exige exactamente la siguiente secuencia (`xs:sequence`):
1. `NumExpedienteAcometida`
2. `NumExpedienteFraude`
3. `FechaIncidente`
4. `NumFacturaATR`
5. `TipoConceptoFacturado` (Tabla 77)
6. `FechaLectura`
7. `TipoDHEdM` (Tabla 35)
8. `CAU`
9. `LecturasAportadas` (`CodigoPeriodoDH`: mantenido en `91..96` según Regla 189)
10. `DisconformidadAutoconsumo` (Tabla 139)
11. `CodigoIncidencia` (Tabla 86)
12. `CodigoSolicitud`
13. `ParametroContratacion` (Tabla 79)
14. `ConceptoDisconformidad`
15. `TipoDeAtencionIncorrecta` (Tabla 87)
16. `MotivoConsulta` (Tabla 140)
17. `IBAN`
18. `Contacto`
19. `CodigoSolicitudReclamacion`
20. `FechaDesde`
21. `FechaHasta`
22. `ImporteReclamado`
23. `UbicacionIncidencia` (`DesUbicacionIncidencia`, `Provincia`, `Municipio`, `CodPostal` a 5 dígitos)

### 3.3. Huso Horario, Identificadores, Adjuntos Tabla 61 y Auto-Registro ERP
* **Zona Horaria Peninsular (`Europe/Madrid`):** `<FechaSolicitud>` y `<FechaLimite>` se formatean con `Intl.DateTimeFormat` en `Europe/Madrid`.
* **Código de Solicitud único de 12 dígitos:** Combinación sin colisiones de marca temporal y contador incremental en lotes masivos.
* **NIF/NIE vs CIF (`TipoPersona`):** Solo se marcan como Persona Jurídica (`J`) los CIF societarios (`/^[ABCDEFGHJNPQRSUVW]/i`), tratando NIF y NIE (`X, Y, Z`) como Persona Física (`F`).
* **Adjuntos CNMC (`<RegistrosDocumento>`):** Subida real vía `POST /api/upload` (`folder: 'cnmc'`), selector oficial de `TipoDocAportado` (**Tabla 61 CNMC**) y URL autenticada `/api/cnmc/document` (`<= 255` caracteres, escapando `&amp;`, compatible tanto con `GET` como con `POST`).
* **Auto-registro en ERP:** Opción activa por defecto (`registerInErp = true`) que ingiere en lotes controlados cada XML Paso `01` generado en `SwitchingEvent` y Cloudflare R2 sin esperar al ciclo FTP.

---

## 4. Experiencia de Usuario y Operativa Diaria

### 4.1. Modos de Generación (`/reclamaciones/generar`)
1. **Individual (1 a 1):** Soporta precarga automática desde contrato (`?cups=...`), selector de facturas F1 deduplicado por CUPS de 20 dígitos, plantillas legales automáticas de comentarios (ej. `05` / `039`, Regla 196), subida de adjuntos Tabla 61 y alerta si el CUPS ya tiene una reclamación R1 abierta.
2. **Masivo Manual (`009` — Lecturas Estimadas):** Validación por lote de CUPS pegados con indicador visual de reclamación abierta previa para evitar duplicidades.
3. **Masivo Automático (`006` — Retraso de Facturación):** Cruza tanto `Invoice.billingEnd` (facturas ERP) como `F1Invoice.fechaFin` (peajes recibidos de distribuidora) sobre todos los clones `SupplyPoint` de cada CUPS activo (`> 45 días` sin facturación), mostrando igualmente si ya existe expediente R1 abierto.

### 4.2. Bandeja General (`/reclamaciones`) y Ficha de Contrato (`/contratos/[id]`)
* **Pestañas Operativas con Contadores:** `Todas`, `Pte. Info (Paso 03)`, `En Proceso`, `Aceptadas`, `Cerradas` y `Rechazadas`.
* **Modal de Expediente y Cronología Completa:** Al hacer clic en cualquier fila se visualizan todos los metadatos del expediente, enlace al Contrato, resultado CNMC Tabla 80, indemnización abonada, alertas de fecha límite de Paso `03` y el historial cronológico íntegro sin truncar de todos los pasos (`01, 02, 03, 04, 05`) con descarga directa de cada XML.
* **Exportación Excel Íntegra:** El botón `Descargar Excel` consulta con `limit = 0` la totalidad de expedientes que cumplen el filtro/búsqueda activos e incluye todas las columnas de pantalla más los textos exactos de los pasos `01`, `02`, `03`, `04` y `05`, resultado de cierre e indemnización.

---
*Documento actualizado conforme a las Reglas de Negocio 114, 125, 189–193, 196–198 y 237–240.*
