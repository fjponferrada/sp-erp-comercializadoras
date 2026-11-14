# Manual de Reclamaciones R1 y Procesos Asociados (CNMC V3.0)

Esta guía documenta la arquitectura, reglas de negocio y soluciones técnicas implementadas en el módulo de Reclamaciones del ERP, centradas específicamente en el proceso de comunicación **R1** con la distribuidora mediante el estándar XML de la CNMC (V3.0 — Electricidad).

---

## 1. Arquitectura de Datos, Ingesta y Visualización

### 1.1. Aislamiento Estricto del Proceso R1 (`SwitchingEvent`)
* **Sin creación de Tickets internos:** A diferencia de incidencias internas, todas las comunicaciones del proceso `R1` se registran exclusivamente como filas en `SwitchingEvent` (`procesoBase = 'R1'`).
* **Aislamiento de semántica de pasos:** En `src/lib/switching/parser.ts` y `src/app/actions/switchingIngest.ts`, toda la interpretación de los pasos `01`, `02`, `03`, `04`, `05`, `08` y `09` está encapsulada bajo `procesoBase === 'R1'` para no alterar jamás los flujos de contratación/modificación (`C1`, `C2`, `M1`, `M2`, `A3`, `B1`, `B2`, `D1`, `E1`, `E2`).
* **Vinculación automática a Contrato y Punto de Suministro:** Al ingerir cualquier paso R1 con CUPS, el sistema resuelve la raíz de 20 caracteres del CUPS y enlaza tanto `supplyPointId` como `contractId` priorizando el contrato `ACTIVO` vigente (y en su defecto el más reciente), sin levantar falsos errores `CUPS_NO_ENCONTRADO` cuando el submotivo carece de CUPS (acometidas `018/019/030/031/076`) o corresponde a un CUPS ajeno (`007`).
* **Soporte de Secuencial (`SecuencialDeSolicitud`):** La clave de deduplicación `uniqueProcess` preserva compatibilidad con secuencial `01` e incorpora sufijo `#Sxx` para secuenciales `02+` en pasos iterativos (`03`, `04`, `08`, `09`), evitando que una segunda petición de información machaque la primera.
* **Decodificación Automática `ISO-8859-1` / `Windows-1252` / `UTF-8`:** `decodeXmlBuffer` detecta la cabecera `encoding=...` y bytes `latin1` antes de parsear el XML para preservar intactos los acentos y `ñ` enviados por las distribuidoras sin caracteres corruptos (`\uFFFD`).

### 1.2. Agrupación de Eventos y Estados del Expediente (`ClaimSummary`)
`getClaimsAction` (`src/app/actions/claimsActions.ts`) respeta el filtro multi-marca (`getSupplyPointVisibilityFilter`) y consolida en tiempo real todos los eventos que comparten `codigoSolicitud`:

| Paso | Dirección | Significado en R1 y Tratamiento en ERP |
| :--- | :--- | :--- |
| **01** | Comercializadora → Distribuidora | Apertura de reclamación (`<Comentarios>`, `Tipo`, `Subtipo`, `FechaLimite`). |
| **02** | Distribuidora → Comercializadora | Aceptación (`CodigoReclamacionDistribuidora`) o Rechazo (`<Rechazos><Rechazo>` traducido con Tabla 27 CNMC). |
| **03** | Distribuidora → Comercializadora | Información intermedia / Petición de información adicional (`TipoComunicacion` Tabla 84 `COM_01..04`, `FechaLimiteEnvio`, `Retipificacion`, `SolicitudesInformacionAdicional`). Si `TipoComunicacion = 01` y aún no hay Paso `04` posterior ni cierre `05`, el expediente pasa a **`Pte. Info (Paso 03)`**. |
| **04** | Comercializadora → Distribuidora | Envío de información adicional (`INFO_ENVIADA`, nunca rechazo). |
| **05** | Distribuidora → Comercializadora | Cierre / Resolución (`DatosCierre`: `ResultadoReclamacion` Tabla 80 `01..05`, `DetalleResultado`, `IndemnizacionAbonada`, `Observaciones` + `Comentarios`). |
| **08 / 09** | C → D / D → C | Solicitud de anulación y respuesta. Si Paso `09` es `ACEPTADO`, marca `isAnnulled = true` (**`Anulada`**). |

* **Cálculo de `diasAbierta`:** Solo se calcula para expedientes vivos (`En Proceso`, `Aceptada`, `Pte. Info (Paso 03)`). Para expedientes finalizados (`Cerrada`, `Rechazada`, `Anulada`) devuelve `null` (`-`).
* **Paginación y Filtrado Post-Agrupación:** La paginación por defecto es de **100 registros por página**. El filtrado por texto y por pestaña de estado se aplica en memoria tras ensamblar los expedientes completos para no excluir pasos hermanos; en la ficha de Contrato (`/contratos/[id]`), el sistema recupera todos los `codigoSolicitud` asociados a cualquier clon `SupplyPoint` del CUPS y carga todos sus pasos completos.

---

## 2. Generación del XML (Estándar CNMC V3.0)

### 2.1. Selección del Titular Legítimo y CUPS de 22 Caracteres
Un mismo CUPS puede tener múltiples registros `SupplyPoint` históricos en el ERP. El generador (`src/app/actions/reclamacionesActions.ts`):
1. Agrupa y busca todos los `SupplyPoint` que comparten los primeros 20 caracteres del CUPS.
2. Prioriza el que posea un contrato `ACTIVO` (y extrae su `Client`), o en su defecto el de `terminationDate` / creación más reciente.
3. Emite siempre el `<CUPS>` completo de **22 caracteres** (`sp.cups`) exigido por `TipoCUPS` en el XSD de la CNMC.
4. En submotivos sin CUPS (`018`, `019`, `030`, `031`, o `076` con `MotivoConsulta = 02`), omite la etiqueta `<CUPS>` de `<CabeceraReclamacion>` y utiliza el código REE de la distribuidora seleccionada manualmente. En submotivo `007` (CUPS ajeno) o cuando el cliente es opcional, omite `<Cliente>` si no se dispone de datos del titular.

### 2.2. Ordenación XSD Estricta en `<VariableDetalleReclamacion>`
El esquema `ReclamacionPeticion.xsd` exige un orden secuencial estricto (`xs:sequence`) garantizado mediante `XSD_ORDER`:
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
23. `UbicacionIncidencia` (`DesUbicacionIncidencia` / `Provincia` / `Municipio` / `CodPostal`)

### 2.3. Reglas XSD Adicionales, Zona Horaria y Documentos Adjuntos
* **Zona Horaria Peninsular (`Europe/Madrid`):** `<FechaSolicitud>` y `<FechaLimite>` se formatean explícitamente en `Europe/Madrid` para evitar desfases UTC en ejecuciones serverless (Vercel).
* **Código de Solicitud único de 12 dígitos:** Generado combinando timestamp y secuencia incremental sin colisiones en lotes masivos.
* **Escapado y Normalización:** Escapado XML completo (`&lt;`, `&gt;`, `&amp;`, `&apos;`, `&quot;`), `CodPostal` con `.padStart(5, '0')` y distinción estricta NIF/NIE (`F`) vs CIF societario (`J`).
* **Adjuntos CNMC (`<RegistrosDocumento>`):** Subida real a almacenamiento R2 (`cnmc/`), selector oficial de `TipoDocAportado` (Tabla 61 CNMC) y generación de `<DireccionUrl>` servida por `/api/cnmc/document` (compatible tanto con `GET` como con `POST` autenticado de las distribuidoras, longitud ≤ 255 caracteres).
* **Auto-registro en ERP:** Al generar el ZIP de XMLs R1 Paso `01`, la opción *"Registrar automáticamente en el ERP"* (activa por defecto) ingiere cada XML en `SwitchingEvent` y R2 para iniciar el seguimiento inmediato sin esperar a la sincronización FTP.

---

## 3. Modos de Generación y Experiencia de Usuario

### 3.1. Modos de Generación (`/reclamaciones/generar`)
1. **Individual (1 a 1):** Preselección automática por URL (`?cups=...` desde la ficha de Contrato), selector de facturas F1 deduplicado por CUPS de 20 dígitos, aviso visual si el CUPS ya tiene una reclamación R1 abierta, adjuntos Tabla 61 y plantillas automáticas de comentarios (ej. `05` / `039`).
2. **Masivo Manual (`009` — Lecturas Estimadas):** Búsqueda por listado de CUPS pegados con detección de reclamación abierta previa para evitar duplicados.
3. **Masivo Automático (`006` — Retraso de Facturación):** Cruza tanto las facturas emitidas en el ERP (`Invoice.billingEnd`) como los ficheros `F1Invoice.fechaFin` recibidos de distribuidora sobre el conjunto consolidado de clones `SupplyPoint` de cada CUPS activo (> 45 días sin facturación), alertando igualmente si ya existe una R1 abierta.

### 3.2. Bandeja General (`/reclamaciones`) y Pestaña en Contrato (`/contratos/[id]`)
* **Pestañas de Estado con Contadores:** `Todas`, `Pte. Info (Paso 03)`, `En Proceso`, `Aceptadas`, `Cerradas` y `Rechazadas`.
* **Modal de Detalle y Cronología Completa:** Al pulsar sobre cualquier fila se abre el expediente completo con enlaces al Contrato, datos de cierre (Resultado CNMC Tabla 80, Detalle e Indemnización), alertas de fecha límite de Paso 03 y el texto íntegro sin truncar de cada paso (`01`, `02`, `03`, `04`, `05`) junto a sus descargas XML individuales.
* **Exportación Excel Completa:** Descarga todas las reclamaciones que cumplen el filtro activo (sin recortar a la página visible), incluyendo los mensajes íntegros de los pasos `01`, `02`, `03`, `04` y `05`, resultado CNMC e indemnización abonada.
