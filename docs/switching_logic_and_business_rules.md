# Guía Técnica y de Negocio: Procesamiento de Switching en el ERP

Este documento detalla la arquitectura técnica, las reglas de negocio y los flujos de trabajo implementados en el ERP para la gestión de los procesos de Switching (Cambios de Comercializador, Modificaciones de ATR, Bajas y Reclamaciones R1) según los estándares de la CNMC V3.0, con especial foco en las decisiones de diseño adoptadas en producción.

---

## 1. Módulos Principales del ERP

### 1.1 Emisión Masiva de Contratación (`/eventos-switching/generar`)
Este módulo se encarga de empaquetar las solicitudes de inicio de procesos (ej. Paso 01 para Altas o Modificaciones, Paso 11 para Bajas) que la comercializadora debe enviar a las distribuidoras.

- **Flujo Técnico:** La función `fetchPendingSwitchingContracts` busca contratos en estado `BORRADOR` o `ACEPTADO` que necesiten ser enviados. Al pulsar "Generar ZIP", se ejecuta `generateSwitchingXmls(ids)`.
- **Tolerancia a fallos (Silent Fail):** Si de 50 contratos, 3 tienen datos incompletos (ej. falta tarifa o potencia), el proceso **no se detiene**. Genera el ZIP con los 47 correctos y devuelve una lista de `validationErrors` para los fallidos. El frontend muestra alertas amarillas específicas con el código del contrato y el motivo del fallo para que el operador los corrija individualmente.

### 1.2 Importación, Codificación y Motor de Reglas (`/importar-switching` y `switchingIngest.ts`)
El corazón del sistema. Recibe los archivos XML enviados o recibidos de las distribuidoras (por subida manual, sincronización FTP o auto-registro interno) y los procesa en `src/lib/switching/parser.ts` y `src/app/actions/switchingIngest.ts`.

- **Auto-detección de codificación (`decodeXmlBuffer`):** Antes de parsear cualquier XML, el sistema inspecciona la cabecera `<?xml ... encoding="ISO-8859-1"?>` y valida la decodificación UTF-8 frente a `windows-1252`, eliminando por completo caracteres corruptos (`\uFFFD`) en textos con tildes o `ñ`.
- **Aislamiento por Proceso Base (`Regla 125`):** El sistema evalúa conjuntamente `procesoBase` (`C1`, `C2`, `M1`, `A3`, `B1`, `E1`, `E2`, `R1`, etc.) y `paso` (`01..11`). La lógica de `R1` está estrictamente encapsulada para no disparar jamás transiciones contractuales ni errores propios de `C1`/`M1`.
- **Resolución de Suministro y Contrato:** Cruza los **20 primeros caracteres** del CUPS contra todos los clones `SupplyPoint` del contador físico (Regla 104 / Regla 124) y ejecuta las transiciones de estado correspondientes.

### 1.3 Bandeja de Incidencias Switching (`/switching-warnings`)
Actúa como buzón de tareas pendientes para los operadores en procesos de contratación/modificación.
- **Generación de Warnings:** Si el motor de ingestión detecta anomalías en procesos contractuales (ej. llega un paso 05 de Alta, pero el contrato no estaba `TRAMITANDO`, o llega un paso 06 de `C1/C2` esperando el paso 11), guarda el evento como no resuelto con su `tipoError` y `warning` correspondientes. *(Nota: En `R1`, los submotivos sin CUPS o de CUPS ajeno `007` no generan falsos warnings `CUPS_NO_ENCONTRADO`).*
- **Auto-Resolución:** Si un error se produjo por desorden de llegada (ej. Paso 05 antes que Paso 02), el operador puede pulsar **"Re-procesar Warnings"** (`retryUnresolvedSwitchingEventsAction`), reinyectando los eventos pendientes y auto-resolviéndolos cuando los pre-requisitos ya se cumplen.

---

## 2. Lógica Específica del Proceso M1 (Modificaciones de ATR)

El proceso M1 es uno de los más complejos debido a sus múltiples variantes (Técnicas, Administrativas, Autoconsumo).

### 2.1 UI y Generación de la Modificación (Botón "Modificar")
Cuando se pulsa "Modificar" en el detalle de un contrato (`ContractDetailClient.tsx`), se abre un modal para introducir los nuevos datos (Subrogación, Cambio Técnico, Autoconsumo) y se llama a `createContractModificationAction`.
- **Versionado:** El ERP **no sobrescribe** el contrato original. Crea un clon con la versión incrementada (`version + 1`), estado `BORRADOR` y `tipo = 'M1'`. El contrato anterior queda referenciado (`previousContractId`).
- **Nuevos NIFs (Subrogaciones):** Si es un cambio de titular, el ERP busca o crea un nuevo cliente (`Client`), crea o reutiliza un Punto de Suministro con el mismo CUPS vinculado al nuevo titular (Regla 92), y traslada el `Lead` de ventas para no perder trazabilidad.
- **Generación Documental:** Se inyectan las nuevas variables (`p1c`, `tarifa`, `nif`, etc.) en una plantilla Docx (`generateModificationDocxBuffer`), se envía a DocuSign para convertir a PDF y se sube a Cloudflare R2.

### 2.2 Ingestión de Pasos M1 (`switchingIngest.ts`)

#### Paso 01 (Solicitud)
- Busca el contrato en `BORRADOR`, `ACEPTADO` o `Rechazo Distribuidora` (Regla 127).
- Pasa el estado a `TRAMITANDO` y guarda el `nSolicitud` para trazar las respuestas.

#### Paso 02 (Aceptación / Rechazo)
Si la distribuidora responde con Rechazo, el estado pasa a `Rechazo Distribuidora` y se guarda el motivo prependiéndolo en `internalComments` (Regla 183).
Si responde con Aceptación, el ERP aplica la **Regla de Auto-Activación en Paso 02** cuando se cumple TODO lo siguiente:
1.  **Es Administrativa:** El Tipo de Modificación Contractual (Tabla 7) es `S`. *(Se excluyen Técnicas `N` y Mixtas `A`)*.
2.  **No es Traspaso:** El Tipo de Solicitud Administrativa (Tabla 53) es distinto de `T`.
3.  **No es Autoconsumo:** El flag de autoconsumo es falso.

Si se cumplen, el contrato pasa directamente a estado **`ACTIVO`**, se finaliza el contrato anterior y no se espera al Paso 05. Si es Traspaso (`T`), Técnico (`N`), Mixto (`A`) o Autoconsumo, el contrato permanece en `TRAMITANDO` esperando el Paso 05.

#### Paso 05 (Activación Efectiva)
- El contrato pasa a `ACTIVO`.
- **Regla de Rescisión M1/M2:** Se busca el contrato `ACTIVO` anterior para ese mismo CUPS y se cambia a `FINALIZADO` con fecha del día anterior a la nueva activación, evitando solapamientos.
- Se actualizan los datos técnicos definitivos (Tarifa, Potencias, Autoconsumo) en `SupplyPoint` al confirmarse la activación.

#### Rechazos en Cadena (Bajas Concurrentes)
Si mientras un M1 está pendiente llega una baja definitiva para ese CUPS, el sistema cancela las versiones M1 y renovaciones huérfanas pendientes pasándolas a `RECHAZADO` con el motivo: *"Rechazado automático: CUPS causa baja antes de la activación de este contrato"*.

---

## 3. Aclaración sobre Erratas de la CNMC en M1

Durante el desarrollo se detectó una contradicción en el manual de la CNMC (V3.0 Mayo 2024) respecto a qué modificaciones administrativas requieren Paso 05:

- **Contradicción (Pág. 9 vs Pág. 11):** El texto de la página 9 indica que las modificaciones administrativas se activan en el paso 02 *a excepción del cambio de titular por subrogación (S)*. Sin embargo, el flujograma de la página 11 indica que la excepción son los *cambios de titular por traspaso (T)*.
- **Resolución Técnica Adoptada:** Tras analizar el comportamiento real de las distribuidoras, el ERP **hace caso al flujograma (Pág. 11)**. Las Subrogaciones (`S`) no cortan el ciclo de facturación y se auto-activan en el Paso 02. Los Traspasos (`T`) sí cortan el ciclo, requieren lectura real, y esperan al Paso 05.

---

## 4. Lógica Específica del Proceso R1 (Reclamaciones CNMC V3.0)

Las reclamaciones B2B hacia distribuidora se gestionan íntegramente sobre `SwitchingEvent` (`procesoBase = 'R1'`), separadas del sistema de tickets B2C (`/incidencias`, Regla 114).

### 4.1 Ingesta Multi-Paso y Vinculación (`parser.ts` y `switchingIngest.ts`)
- **Dirección de mensajes:** En `R1`, los pasos enviados por la comercializadora son `01`, `04` y `08` (se toma `Remitente`), y los recibidos de distribuidora son `02`, `03`, `05` y `09` (se toma `Destinatario`).
- **Clave única con soporte iterativo (`buildSwitchingUniqueProcess`):** Soporta expedientes sin CUPS (`SINCUPS`) e incorpora el sufijo `#Sxx` cuando `SecuencialDeSolicitud !== '01'` en los pasos `03, 04, 08, 09`, permitiendo múltiples rondas de solicitud/envío de información adicional sin sobrescribir eventos previos.
- **Vinculación a Contrato:** Aunque un `R1` no muta el estado del contrato, el ingestor busca todos los `SupplyPoint` que comparten la raíz de 20 caracteres del CUPS y vincula el evento tanto a `supplyPointId` como al `contractId` activo (o al más reciente si ya finalizó), garantizando su visibilidad en la pestaña **Reclamaciones** de `/contratos/[id]`.
- **Semántica de estados por paso:**
  - `Paso 01`: Guarda `<Comentarios>` en `observaciones`, `<FechaLimite>` en `fechaPrevActivacion` y `Tipo`/`Subtipo` normalizados (`02` / `009`, etc.).
  - `Paso 02`: `ACEPTADO` (extrae `CodigoReclamacionDistribuidora`) o `RECHAZADO` (traduce `<Rechazos><Rechazo>` mediante Tabla 27 CNMC en `motivosRechazo` y `observaciones`).
  - `Paso 03`: Clasifica `estadoAR = COM_01..COM_04` (Tabla 84), guarda `FechaLimiteEnvio`, actualiza `Tipo`/`Subtipo` si hay `<Retipificacion>` y detalla los documentos requeridos. Si el último Paso `03` es `COM_01` sin Paso `04` posterior ni cierre `05`, el expediente figura como **`Pte. Info (Paso 03)`**.
  - `Paso 04`: Se registra como `estadoAR = 'INFO_ENVIADA'`.
  - `Paso 05`: Clasifica `estadoAR = RES_01..RES_05` (Tabla 80), extrae `DetalleResultado`, `IndemnizacionAbonada` y concatena `Observaciones` + `Comentarios`.
  - `Pasos 08 / 09`: Si Paso `09` es `ACEPTADO`, marca `isAnnulled = true` en todos los eventos del `codigoSolicitud` (**`Anulada`**).

### 4.2 Generación XSD, Adjuntos y Detección de Duplicados (`/reclamaciones/generar`)
- **Cumplimiento XSD (`reclamacionesActions.ts`):** Ordenación estricta de los 23 campos de `<VariableDetalleReclamacion>` (`XSD_ORDER`), `<CUPS>` completo de 22 caracteres, fechas en zona `Europe/Madrid`, `CodigoPeriodoDH` mantenido en `91..96` (Regla 189), soporte de submotivos sin `<CUPS>` (selector manual de distribuidora REE) o sin `<Cliente>` (`007`), subida de adjuntos a R2 (`cnmc/`) tipificados con Tabla 61 hacia `/api/cnmc/document` (`GET`/`POST`, `<= 255` chars) y auto-ingesta inmediata en `SwitchingEvent` (`ingestXmlStringInternal`).
- **Cruce F1 + ERP en modo automático `006`:** `searchCupsWithBillingDelay` consolida todos los clones `SupplyPoint` de cada CUPS activo y compara el máximo entre `Invoice.billingEnd` y `F1Invoice.fechaFin` (`> 45 días`), alertando además si el suministro ya tiene una reclamación `R1` abierta (`getOpenR1ByBaseCups`).

### 4.3 Seguimiento y Exportación (`/reclamaciones` y `/contratos/[id]`)
- Pestañas por estado con contadores en vivo, paginación por defecto de **100 filas**, `diasAbierta` exclusivo para estados abiertos, modal de cronología íntegra sin truncar al pulsar cualquier fila y descarga `.xlsx` sobre el total filtrado (`limit = 0`) con los textos completos de los pasos `01, 02, 03, 04 y 05`, resultado CNMC e indemnización.
