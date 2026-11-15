# Guía de Referencia de Ficheros Switching de la CNMC (Sector Eléctrico — V3.0)

Esta guía detalla la documentación clave sobre los procedimientos de Switching regulados por la CNMC (versión `V3.0 2024.05.16`), incluyendo rutas, esquemas XSD, tablas maestras y notas técnicas de implementación en los parsers y generadores del ERP.

---

## 1. Documentación de Procesos (PDF)
Estos documentos definen los flujogramas, plazos, actores (Entrante, Saliente, Distribuidor, COR) y reglas de negocio para cada tipo de proceso de switching.

**Ruta base:** `Z:\AED\Switching\CNMC - E - V3.0 2024.05.16\CNMC - E - Formatos Ficheros 2024.05.16\`

*   **CNMC - E - Formato Fichero A3 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Alta de un punto de suministro**. Abarca desde la solicitud (01) hasta la activación (05) y las posibles anulaciones.
*   **CNMC - E - Formato Fichero B1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Baja o Suspensión del suministro**. Incluye bajas por cese de actividad (motivo 01), fin de contrato (02) y suspensión/baja por impago (03/04). Explica las concurrencias y plazos de cortes de suministro.
*   **CNMC - E - Formato Fichero B2 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Baja Unidireccional** del contrato de acceso.
*   **CNMC - E - Formato Fichero C1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Cambio de Comercializador sin modificaciones**. El proceso más común de adquisición de clientes. Muestra concurrencias y envío del Paso 11 (aviso a la saliente) y Paso 06 (activación de la baja en la saliente).
*   **CNMC - E - Formato Fichero C2 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Cambio de Comercializador con modificaciones** (ej. cambio de titular, o aumento de potencia junto con el cambio).
*   **CNMC - E - Formato Fichero D1 2024.05.16.pdf**
    *   **Resumen:** **Notificación de cambios**. Envío de notificaciones iniciadas desde Distribuidora (ej. altas o modificaciones de autoconsumo). 
    *   **Flujo:** Paso 01 (Notificación desde distribuidor) -> Paso 02 (Rechazo del comercializador en máx. 10 días por disconformidad del cliente) o Aceptación tácita -> M2 (Confirmación de activación). También incluye el Paso 10 para anulación por parte del distribuidor. Es clave para autoconsumos colectivos con o sin representante.
*   **CNMC - E - Formato Fichero E1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Desistimiento**. Para cancelar operaciones de cambio antes o después de la activación, en los 14 días legales.
*   **CNMC - E - Formato Fichero E2 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Reposición del servicio**. Restauración del servicio a la comercializadora original en caso de errores ("cruces de CUPS") o fraude sin consentimiento del cliente (vigencia máxima 1 año).
*   **CNMC - E - Formato Fichero F1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Facturación ATR**. Detalla el envío del XML Paso 01 (`Facturacion.xsd`: nodos `<FacturaATR>` y `<OtrasFacturas>`) desde Distribuidor a Comercializador. En el ERP se procesa mediante `src/lib/f1Utils.ts` (`extractF1Financials`, `invertF1JsonForSyntheticAbono`), `src/app/actions/f1Ingest.ts` y `src/app/actions/f1Actions.ts` (bandejas `/ficheros-f1` y `/ficheros-f1/fianzas-clientes`, Regla 278), extrayendo al céntimo peajes (`Potencia`, `EnergiaActiva`, `ExcesoPotencia`, `EnergiaReactiva`, `EnergiaCapacitiva`), `Cargos.TotalImporteCargos`, tramos `IVA`/`IVAReducido`/`IVAIGIC`, `<ConceptoRepercutible>` y normalizando signos en abonos/anuladoras (`A`, `AR`, `S`).
*   **Proceso `J1` (Expedientes de Anomalía, Fraude e Inspección desde Distribuidora)**
    *   **Resumen:** Comunicaciones de apertura, liquidación o cierre de expedientes de inspección/fraude remitidas por las distribuidoras (ej. `J1_01`, `J1_52`, `J1_05`), cuyo CUPS viaja frecuentemente en `<Cabecera><Codigo>ES...</Codigo></Cabecera>`. Se evalúa en `switchingIngest.ts` con precedencia sobre los pasos genéricos `02/04/05`, generando aviso `J1_EXPEDIENTE_<paso>` en `01`/`52` y registrando en `observaciones` comunicaciones informativas como `J1_05` sin caer en `CONTRATO_NO_TRAMITANDO`.
*   **CNMC - E - Formato Fichero M1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Modificación de contrato de acceso** (ej. cambio de potencia, cambio de titular sin cambio de comercializador, alta de autoconsumo en comercializadora en vigor).
*   **CNMC - E - Formato Fichero M2 2024.05.16.pdf**
    *   **Resumen:** **Notificación de modificación de contrato** originada de manera unilateral o por ajustes.
*   **CNMC - E - Formato Fichero P0 2024.05.16.pdf**
    *   **Resumen:** **Solicitud de información (SIPS)**. Consultas síncronas de CUPS para contratación.
*   **CNMC - E - Formato Fichero Q1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Saldos y Lecturas**.
*   **CNMC - E - Formato Fichero R1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Reclamaciones / Peticiones** entre Comercializadora y Distribuidora.
    *   **Flujo completo soportado en el ERP (`procesoBase === 'R1'`):**
        *   **Paso 01 (`TipoMensajeR101.xsd` / `ReclamacionPeticion.xsd`):** Apertura desde Comercializadora (`CabeceraReclamacion`, `DatosSolicitud`, `VariablesDetalleReclamacion`, `Cliente`, `Comentarios`, `RegistrosDocumento`).
        *   **Paso 02 (`AceptacionReclamacion.xsd` / `RechazoReclamacion.xsd`):** Respuesta de Distribuidora aceptando (`CodigoReclamacionDistribuidora`) o rechazando (`<Rechazos><Rechazo>` con `CodigoMotivo` Tabla 27).
        *   **Paso 03 (`PeticionInformacionAdicionalReclamacion.xsd`):** Comunicación intermedia de Distribuidora (`TipoComunicacion` Tabla 84: `01` Solicitud info adicional con `FechaLimiteEnvio`, `02` Estado intermedio, `03` Retipificación de `Tipo`/`Subtipo`, `04` Desestimación info).
        *   **Paso 04 (`EnvioInformacionReclamacion.xsd`):** Respuesta de Comercializadora aportando información o documentos adicionales (`INFO_ENVIADA`).
        *   **Paso 05 (`CierreReclamacion.xsd`):** Cierre definitivo de Distribuidora (`DatosCierre`: `ResultadoReclamacion` Tabla 80 `01..05`, `DetalleResultado` Tabla 73, `IndemnizacionAbonada`, `Observaciones` y `Comentarios`).
        *   **Pasos 08 y 09 (`AnulacionSolicitudReclamacion.xsd` / `AceptacionAnulacion.xsd` / `RechazoReclamacion.xsd`):** Solicitud de anulación desde Comercializadora y respuesta de Distribuidora (`isAnnulled = true` si Paso 09 es aceptado).
*   **CNMC - E - Formato Fichero T1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Traspaso a la COR** (Comercializadora de Referencia). Casos de impago prolongado, o extinciones de contrato.
*   **CNMC - E - Formato Fichero W1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Aportación de Autolecturas**. Envío de lectura del cliente a Distribución.

---

## 2. Esquemas XSD y Definición de Nodos XML (Excel y `.xsd`)
Estos ficheros definen campo por campo la estructura del XML (XSD) para cada paso del flujograma: nombre del tag, orden secuencial (`xs:sequence`), formato (`X(2)`, `X(22)`, `AAAA-MM-DD`, etc.), si es obligatorio, y a qué Tabla Maestra está referenciado.

*   **Ruta Excel por Proceso:** `Z:\AED\Switching\CNMC - E - V3.0 2024.05.16\CNMC - E - Anexos 2024.05.16\CNMC - E - Procesos 2024.05.16\`
    *   **CNMC - E - Proceso [A3, B1, B2, C1, C2, D1, E1, E2, F1, M1, M2, P0, Q1, R1, T1, W1] 2024.05.16.xlsx**
    *   **Uso práctico en parsers y generadores:** Permite verificar si el nodo de cabecera es `Cabecera` o `CabeceraReclamacion` (donde `<CUPS>` es opcional en submotivos de acometida sin suministro), el orden exacto de hijos en `TiposComplejos.xsd` y las obligatoriedades condicionales por subtipo.
*   **Ruta Esquemas XSD Oficiales:** `Z:\AED\Switching\CNMC - E - V3.0 2024.05.16\CNMC - E - Anexos 2024.05.16\CNMC - E - XSD 2024.05.16\`
    *   Contiene `TiposSencillos.xsd`, `TiposComplejos.xsd` y los esquemas raíz de cada mensaje (autoridad final para facetas `minLength`, `maxLength` y enumeraciones).
*   **Archivos `.docx` (CNMC - E - A5D, B5D, F5D, P5D)**
    *   **Resumen:** Documentos que detallan la estructura plana (o CSV/XML) de las Curvas de Carga Horaria (`CCH_FACT`, `CCH_VAL`, etc.).

---

## 3. Tablas Maestras de Códigos (Documento Maestro y Catálogos ERP)
Es el "Diccionario de Datos" de todo el switching, volcado en `docs/cnmc_dictionary.json` y tipado específicamente para R1 en `src/app/(app)/reclamaciones/utils/cnmc_codes.ts`.

**Ruta base:** `Z:\AED\Switching\CNMC - E - V3.0 2024.05.16\CNMC - E - Anexos 2024.05.16\CNMC - E - Tablas de Codigos  2024.05.16\CNMC - E - Tablas de códigos 2024.05.16.docx`

*   **Tablas Generales de Contratación y Medida:**
    *   **Tabla 2:** Código de Proceso (`C1`, `C2`, `M1`, `B1`, `R1`, etc.).
    *   **Tabla 3:** Código de Paso (`01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `14`, `15`).
    *   **Tabla 6:** Tipo de Identificador Fiscal (`NI` NIF, `NE` NIE, `NV` NIF-IVA, `OT` Otro/CIF, `PS` Pasaporte — nunca códigos de 3 letras como `NIF`/`NIE`/`CIF` ni `PA`).
    *   **Tabla 10:** Motivo de Baja en `B1` (`01` Cese de actividad, `02` Fin de contrato, `03` Corte/Suspensión temporal por impago, `04` Baja definitiva por impago).
    *   **Tabla 17:** Tarifas ATR (`018` -> `2.0TD`, `019` -> `3.0TD`, `020` -> `6.1TD`, `021` -> `6.2TD`, `022` -> `6.3TD`, `023` -> `6.4TD`, `024` -> `3.0TDVE`, `025` -> `6.1TDVE`, `026` -> `6.2TDVE`).
    *   **Tabla 27:** Motivos de Rechazo (`MOTIVOS_RECHAZO_CNMC`: más de 100 códigos compartidos entre contratación, `D1_02` restringido a `E1/F1/I1`, y Pasos `02`/`09` de `R1`).
    *   **Tabla 28:** Motivos de Incidencia en Actuaciones en Campo (`MensajeIncidenciasATRDistribuidor` en Paso `03` de `A3`, `C2` y `M1`).
    *   **Tabla 35:** Discriminación Horaria del equipo de medida (`TipoDHEdM`).
    *   **Tabla 61:** Tipos de Documentación Aportada (`TIPOS_DOCUMENTACION_CNMC`: `01` CIE consumo, `02` Acta puesta en marcha, `04` NIF/NIE/CIF, `07` Otra documentación del cliente / titularidad, `08` Otros, `10` CIE generación/autoconsumo, usada en `<RegistrosDocumento>`).
    *   **Tabla 113:** Tipo de Autoconsumo.
    *   **Tabla 135:** Tipo de Reposición en `E2` (`01` Corte indebido / Error, `02` Baja por impago errónea, `03` Fraude / Contratación sin consentimiento).
*   **Tablas Específicas del Proceso R1 (Reclamaciones / Peticiones):**
    *   **Tabla 73:** Detalle del Resultado de Cierre (`DetalleResultado` en Paso `05`).
    *   **Tabla 77:** Tipo de Concepto Facturado (`TipoConceptoFacturado`).
    *   **Tabla 79:** Parámetro de Contratación reclamado (`ParametroContratacion`).
    *   **Tabla 80:** Resultado de la Reclamación en Paso `05` (`RESULTADOS_R1`: `01` Procedente/Favorable, `02` Improcedente/Desfavorable, `03` Duplicada, `04` No gestionable, `05` Otros).
    *   **Tabla 81:** Tipos / Motivos de Reclamación Electricidad (`MOTIVOS_R1`: `01` Atención personal, `02` Facturación y medida, `03` Contratación, `04` Gestión de acometidas, `05` Calidad de suministro, `06` Situación de instalaciones, `07` Atención reglamentaria).
    *   **Tabla 82:** Subtipos / Submotivos de Reclamación Electricidad (`SUBMOTIVOS_R1`: catálogo eléctrico depurado excluyendo códigos exclusivos de Gas `033, 050, 054, 068`).
    *   **Tabla 84:** Tipo de Comunicación Intermedia en Paso `03` (`TIPOS_COMUNICACION_R1`: `01` Solicitud info adicional, `02` Comunicación estado intermedio, `03` Retipificación, `04` Desestimación info enviada).
    *   **Tabla 86:** Código de Incidencia (`CodigoIncidencia`).
    *   **Tabla 87:** Tipo de Atención Incorrecta (`TipoDeAtencionIncorrecta`).
    *   **Tabla 139:** Disconformidad en Autoconsumo (`DisconformidadAutoconsumo`).
    *   **Tabla 140:** Motivo de Consulta (`MotivoConsulta`, clave para obligatoriedad dinámica en submotivo `076`).

> [!TIP]
> Cuando haya errores en el parser del sistema o un XML retorne valores numéricos que no entiendas, busca el número en el documento de *Tablas Maestras* bajo la tabla correspondiente. Cuando busques cómo extraer un dato concreto de un archivo XML para añadir a la base de datos, revisa la hoja de Excel (`CNMC - E - Procesos 2024.05.16`) y el `.xsd` correspondiente a ese Proceso y Paso para conocer el nombre y secuencia exactos de cada etiqueta.

---

## 4. Notas de Implementación en el ERP
- **Prohibición Absoluta de Fallbacks a `new Date()` (`Regla 249`):** Ni `parser.ts` ni `switchingIngest.ts` ni `contractModification.ts` asignan jamás `new Date()` si falta una fecha reglamentaria en un XML (`<FechaActivacion>`, `<FechaRechazo>`, `<FechaAceptacion>`, etc.); en su lugar abortan la transición de fecha y registran un **Warning** obligatorio para revisión manual en `/switching-warnings`.
- **Conversión de Magnitudes CNMC (`Watts <-> kW` y Tabla 17):** En recepción (`parser.ts`), `extractPotenciasKw` lee `@_Periodo="1..6"` y divide vatios enteros entre `1000` (igual que `<PotInstaladaGen>`), mientras `CNMC_TARIFA_TO_ERP` convierte `018..026` al formato del ERP (`2.0TD`, `3.0TD`, `6.1TD..6.4TD`, `3.0TDVE..6.2TDVE`). En emisión (`switchingGenerarActions.ts`), el proceso inverso multiplica `kW × 1000` preservando periodos con valor `0`.
- **Motor de Estados Aislado y Matriz Direccional (`Reglas 125 y 250`):** `parser.ts` y `switchingIngest.ts` evalúan siempre `procesoBase` + `paso` conjuntamente (con precedencia de `R1` y `J1` antes de los pasos genéricos `02`/`04`/`05`, soporte de `E2_01`/`02`/`04` sobre suministros en `FINALIZADO` y *fallback* histórico de `contractId` cuando existe `SupplyPoint`) y determinan `isEnviado` comparando `<CodigoREEEmpresaEmisora>` / `<CodigoREEEmpresaDestino>` contra `Company.codigoRee` (`determineIsEnviado`). Además, `extractCnmcRechazos` extrae `<Rechazos><Rechazo><CodigoMotivo>` (Tabla 27), distingue `MensajeAceptacionAnulacion` (`B1_04`, `E1_04`, `A3_07`, `M1_07`, `C1_09`, `C2_09`, `E2_09` → `ANULADO`) frente a `MensajeRechazo`, captura incidencias de campo `MensajeIncidenciasATRDistribuidor` en Paso `03` (`INCIDENCIA_ATR_CAMPO`), y reserva estrictamente `warning` para alertas pendientes frente a `observaciones` para mensajes informativos de éxito (`T1_06`, `E2_05`, `M1_02`).
- **Auto-Registro ERP, Huso `Europe/Madrid` y Bloqueo SSR RBAC en Generadores Salientes (`Reglas 251 y 252`):** Las pantallas `/eventos-switching/anulaciones`, `/eventos-switching/bajas` y `/distribuidoras/reposiciones` bloquean en SSR a sesiones no autenticadas y a roles `COMERCIAL`/`CANAL`, formatean marcas temporales en `Europe/Madrid`, autocompletan contexto en vivo por CUPS (trámites abiertos en anulaciones, titular/contrato en bajas y bajas recientes `C1/C2` en `E2_01`) y auto-registran por defecto (`registerInErp = true`) los XMLs emitidos (`B1_01` preservando `MOTIVO_03`, `Anulaciones`, `D1_02`, `E2_01` y `E2_15`) en `SwitchingEvent` y Cloudflare R2. En `/eventos-switching/generar`, la interfaz muestra contadores en vivo para `ACEPTADO` y `RECHAZO_DISTRIBUIDORA` e interseca la selección con las filas visibles.
- **Decodificación Automática de XMLs (`decodeXmlBuffer`), Extensiones Numéricas y Proceso `J1` (`Regla 261`):** Muchas distribuidoras emiten XMLs en `ISO-8859-1` / `Windows-1252` o ficheros CNMC con extensión numérica secuencial (`.0`, `.1`, `.2`) dentro de ZIPs. Tanto `switchingIngest.ts` como `f1Ingest.ts` detectan automáticamente la codificación con `decodeXmlBuffer`, aceptan entradas `/\.(xml|\d+)$/i`, resuelven el CUPS con *fallback* en `<Cabecera><Codigo>` (soportando expedientes de fraude/inspección `J1`) y ejecutan al cierre de cada scraping automático el barrido `retryUnresolvedSwitchingEventsInternal()`.
- **Deduplicación con Soporte de Secuencial (`buildSwitchingUniqueProcess`):** Construye `<CodigoSolicitud>_<CodComercializadora>_<CUPS>_<Proceso>_<Paso>` y añade sufijo de secuencial en pasos iterativos de `R1` (`03, 04, 08, 09`) con `SecuencialDeSolicitud > 01` o `SINCUPS`.
- **Proxy Seguro de Documentos Adjuntos (`/api/cnmc/document`, `Reglas 192 y 252`):** Soporta `GET` y `POST` autenticado (`Basic Auth` con soporte de `:` en contraseñas o parámetros `user`/`password`, validados mediante comparación en tiempo constante `timingSafeEqual`) restringido estrictamente a documentación técnica autorizada (`cnmc/`, `cie/`, `reclamaciones/`, `SupplyPoint.fileCie` y `Document` técnico), bloqueando carpetas internas (`switching/`, `invoices/`, contratos firmados) y respetando `X255`.
- **Ciclo Completo `D1` y Reportes Oficiales `CNMC` / `MITECO` (`Reglas 200 y 252–256`, ver [`GUIA_REGULACION.md`](./GUIA_REGULACION.md)):** Soporta `D1_01` (`NotificacionCambiosATRDesdeDistribuidor.xsd`), emisión directa de `D1_02` (`MensajeRechazoD1`, motivos `E1`, `F1`, `I1` desde `/switching-warnings` y `/eventos-switching/anulaciones`) y anulación `D1_10`. En `parser.ts`, los rechazos de actuación en campo (`Paso 04` y `E2 Paso 12`) asignan `fechaSolicitudDate` a `fechaAR` cuando `<FechaRechazo>` no viene informada. Los generadores regulatorios filtran por sociedad mercantil activa (`Company`), ofrecen pre-validador (`?preview=true`) y registro de entregas en `SyncJob`:
  * **`/api/cnmc/si-codage` (Manual SCC v6.0 y `SolicitudesRealizadas_v1.0.xsd`):** Excluye `T1`, resuelve `R1-xxx` reales (`Distributor.registroCnmc` + fallbacks verificados), contabiliza el doble cómputo `Paso 02` aceptado + `Paso 04` rechazado en campo (Ejemplo 4 CNMC), calcula `<TMActivacion>` desde `fechaPrevActivacion` / incidencia `03`, reconstruye pendientes inter-mensuales (ventana de 14 meses acotada a `< endYmd`), genera `<DetallePendientesRespuesta>` y `<DetallePdteActivacion>`, suma `<Reposiciones>` sobre `E2` ejecutadas (`05`/`06`) y controla meses sin actividad (`cambiodecomercializador@cnmc.es`) y versión correlativa `_01`..`_99`.
  * **`/api/cnmc/tm-codage` y `/api/cnmc/coberturas`:** `TM_CODAGE` exporta `.csv` (`CANAL;ACTUACION_CAMPO;IND_ACTIVACION;NUM_ACTIVADAS;TIEMPO_MEDIO`, sin `_01`) y `.xls` (pestaña `'Datos'`), filtrando por activación efectiva trimestral (`fechaActivacionAlta`) y midiendo desde `Contract.signatureDate`. `Coberturas` genera `Coberturas_<CODAGE>_<AAAA>.csv` conforme a la Circular `CIR/DE/007/25` (1 fila sin cabecera con 10 enteros en `kWh BC`).
