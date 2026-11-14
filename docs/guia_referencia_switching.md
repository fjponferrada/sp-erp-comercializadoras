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
    *   **Resumen:** Procedimiento de **Facturación ATR**. Detalla el envío del XML Paso 01 (Facturacion.xsd) desde Distribuidor a Comercializador.
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
    *   **Tabla 3:** Código de Paso (`01`, `02`, `03`, `04`, `05`, `06`, `08`, `09`, `11`, etc.).
    *   **Tabla 10:** Motivo de Baja (`01` Cese, `02` Fin, `03` Corte impago, `04` Baja impago).
    *   **Tabla 17:** Tarifas ATR (`018` para `2.0TD`, `019` para `3.0TD`, `020` para `6.1TD`, etc.).
    *   **Tabla 27:** Motivos de Rechazo (`MOTIVOS_RECHAZO_CNMC`: más de 100 códigos compartidos entre contratación y Paso `02`/`09` de `R1`).
    *   **Tabla 28:** Motivos de Incidencia en Campo (Ej: `01` Cliente ausente).
    *   **Tabla 35:** Discriminación Horaria del equipo de medida (`TipoDHEdM`).
    *   **Tabla 61:** Tipos de Documentación Aportada (`TIPOS_DOCUMENTACION_CNMC`: `01` CIE, `02` Acta puesta en marcha, `04` NIF/NIE/CIF, `07` Otra documentación del cliente, `08` Otros, etc., usada en `<RegistrosDocumento>`).
    *   **Tabla 113:** Tipo de Autoconsumo.
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
- **Motor de Estados Aislado por Proceso (`Regla 125`):** `src/lib/switching/parser.ts` y `src/app/actions/switchingIngest.ts` evalúan siempre `procesoBase` + `paso` conjuntamente. En concreto, los pasos de `R1` (`01, 02, 03, 04, 05, 08, 09`) tienen una semántica propia completamente aislada de `C1/C2/M1/A3/B1/E1/E2` (por ejemplo, en `R1` los pasos enviados por comercializadora son `01, 04, 08` y el Paso `04` es aportación de información `INFO_ENVIADA`, no un rechazo).
- **Decodificación Automática de XMLs (`decodeXmlBuffer`):** Muchas distribuidoras emiten XMLs en `ISO-8859-1` / `Windows-1252`. El ingestor detecta la cabecera `encoding=...` o la presencia de `\uFFFD` antes de parsear, preservando tildes y `ñ` sin corrupción en base de datos.
- **Deduplicación con Soporte de Secuencial (`buildSwitchingUniqueProcess`):** Para pasos iterativos de `R1` (`03, 04, 08, 09`) con `SecuencialDeSolicitud > 01` o expedientes sin CUPS (`SINCUPS`), el identificador único añade el sufijo `#Sxx`, evitando sobrescribir segundas peticiones de información mientras conserva compatibilidad total con secuencial `01`.
- **Proxy Seguro de Documentos Adjuntos (`/api/cnmc/document`):** Soporta tanto `GET` como `POST` autenticado (`Basic Auth` o parámetros `user`/`password`) para servir desde Cloudflare R2 (`cnmc/`) los ficheros declarados en `<RegistrosDocumento>` respetando el límite XSD `X255`.
- **D1 y Autoconsumo:** La ingesta de archivos `NotificacionCambiosATRDesdeDistribuidor.xsd` (`D1`, Paso `01`) asocia acuerdos de reparto y coeficientes a los suministros correspondientes, controlando el plazo normativo de respuesta.
