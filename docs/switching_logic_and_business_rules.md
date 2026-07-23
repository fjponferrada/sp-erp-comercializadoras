# Guía Técnica y de Negocio: Procesamiento de Switching en el ERP

Este documento detalla la arquitectura técnica, las reglas de negocio y los flujos de trabajo implementados en el ERP para la gestión de los procesos de Switching (Cambios de Comercializador, Modificaciones de ATR, Bajas, etc.) según los estándares de la CNMC, con especial foco en las decisiones de diseño adoptadas durante su desarrollo.

---

## 1. Módulos Principales del ERP

### 1.1 Emisión Masiva (`/eventos-switching/generar`)
Este módulo se encarga de empaquetar las solicitudes de inicio de procesos (ej. Paso 01 para Altas o Modificaciones, Paso 11 para Bajas) que la comercializadora debe enviar a las distribuidoras.

- **Flujo Técnico:** La función `fetchPendingSwitchingContracts` busca contratos en estado `BORRADOR` que necesiten ser enviados. Al pulsar "Generar ZIP", se ejecuta `generateSwitchingXmls(ids)`.
- **Tolerancia a fallos (Silent Fail):** Si de 50 contratos, 3 tienen datos incompletos (ej. falta tarifa o potencia), el proceso **no se detiene**. Genera el ZIP con los 47 correctos y devuelve una lista de `validationErrors` para los fallidos. El frontend muestra alertas amarillas específicas con el código del contrato y el motivo del fallo para que el operador los corrija individualmente.

### 1.2 Importación y Motor de Reglas (`/importar-switching`)
El corazón del sistema. Recibe los archivos XML de respuesta de las distribuidoras (Aceptaciones, Rechazos, Activaciones) y los procesa a través de la lógica contenida en `switchingIngest.ts`.

- El sistema lee el `procesoBase` (ej. C1, M1, B1) y el `paso` (01, 02, 05).
- Busca el Punto de Suministro (`SupplyPoint`) y el contrato afectado basándose en el CUPS y los estados actuales del contrato.
- Ejecuta transiciones de estado automáticas en la base de datos según el tipo de proceso.

### 1.3 Bandeja de Incidencias (`/switching-warnings`)
Actúa como buzón de tareas pendientes para los operadores. 
- **Generación de Warnings:** Si el motor de ingestión detecta anomalías (ej. llega un paso 05 de Alta, pero el contrato no estaba `TRAMITANDO`), no bloquea la base de datos, sino que guarda un evento con estado `Unresolved` y genera un warning.
- **Auto-Resolución:** Si un error se produjo por desorden de la distribuidora (llega el paso 05 antes que el 02), el operador puede pulsar el botón **"Re-procesar Warnings"**. Esto llama a `retryUnresolvedSwitchingEventsAction`, reinyectando los eventos pendientes. Si los pre-requisitos ya se cumplen, el sistema los procesa y los auto-resuelve.

---

## 2. Lógica Específica del Proceso M1 (Modificaciones de ATR)

El proceso M1 es uno de los más complejos debido a sus múltiples variantes (Técnicas, Administrativas, Autoconsumo).

### 2.1 UI y Generación de la Modificación (Botón "Modificar")
Cuando se pulsa "Modificar" en el detalle de un contrato (`ContractDetailClient.tsx`), se abre un modal para introducir los nuevos datos (Subrogación, Cambio Técnico, Autoconsumo) y se llama a `createContractModificationAction`.
- **Versionado:** El ERP **no sobrescribe** el contrato original. Crea un clon con la versión incrementada (`version + 1`), estado `BORRADOR` y `tipo = 'M1'`. El contrato anterior queda referenciado (`previousContractId`).
- **Nuevos NIFs (Subrogaciones):** Si es un cambio de titular, el ERP busca o crea un nuevo cliente (`Client`), crea un nuevo Punto de Suministro con el mismo CUPS vinculado al nuevo titular, y traslada el `Lead` de ventas para no perder trazabilidad.
- **Generación Documental:** Se inyectan las nuevas variables (`p1c`, `tarifa`, `nif`, etc.) en una plantilla Docx (`generateModificationDocxBuffer`), se envía a DocuSign para convertir a PDF y se sube a Cloudflare R2.

### 2.2 Ingestión de Pasos M1 (`switchingIngest.ts`)

#### Paso 01 (Solicitud)
- Busca el contrato en `BORRADOR` o `ACEPTADO`.
- Pasa el estado a `TRAMITANDO` y guarda el `nSolicitud` para trazar las respuestas.

#### Paso 02 (Aceptación / Rechazo)
Si la distribuidora responde con Rechazo, el estado pasa a `Rechazo Distribuidora` y se guarda el motivo.
Si responde con Aceptación, el ERP toma una decisión crítica basada en las reglas de la CNMC:

**Regla de Auto-Activación en Paso 02:**
Según la normativa CNMC, las modificaciones administrativas se activan en el Paso 02 (sin esperar trabajo de campo), a excepción de los Traspasos y el Autoconsumo. Para implementar esto, el ERP define la variable `isAutoActivatableAdmin` que exige cumplir TODO lo siguiente:
1.  **Es Administrativa:** El Tipo de Modificación Contractual (Tabla 7) es `S`. *(Se excluyen Técnicas `N` y Mixtas `A`)*.
2.  **No es Traspaso:** El Tipo de Solicitud Administrativa (Tabla 53) es distinto de `T`.
3.  **No es Autoconsumo:** El flag de autoconsumo es falso.

Si se cumplen, el contrato pasa directamente a estado **`ACTIVO`**, se finaliza el contrato anterior, y no se espera al Paso 05 (generando un log que avisa de esta auto-activación).
Si es Traspaso (T), Técnico (N), Mixto (A) o Autoconsumo, el contrato se queda en `TRAMITANDO` esperando el Paso 05.

#### Paso 05 (Activación Efectiva)
- El contrato pasa a `ACTIVO`.
- **Regla de Rescisión M1/M2:** Se busca el contrato `ACTIVO` anterior para ese mismo CUPS y se cambia a `FINALIZADO` con fecha del día anterior a la nueva activación, evitando solapamientos.
- Se actualizan los datos técnicos definitivos (Tarifa, Potencias, Autoconsumo) directamente en el registro `SupplyPoint` para mantener sincronizado el ERP.

#### Rechazos en Cadena (Bajas Concurrentes)
Existe un mecanismo de salvaguarda: si mientras un M1 está `TRAMITANDO` llega un corte de suministro o baja definitiva para ese CUPS, el sistema cancela la modificación automáticamente pasando las versiones M1 pendientes a `RECHAZADO` con el motivo: *"Rechazado automático: CUPS causa baja antes de la activación de este contrato"*.

---

## 3. Aclaración sobre Erratas de la CNMC

Durante el desarrollo se detectó una contradicción importante en el manual de la CNMC (V3.0 Mayo 2024) respecto a qué modificaciones administrativas requieren Paso 05:

- **Contradicción (Pág. 9 vs Pág. 11):** El texto de la página 9 indica que las modificaciones administrativas se activan en el paso 02 *a excepción del cambio de titular por subrogación (S)*. Sin embargo, el flujograma de la página 11 indica que la excepción son los *cambios de titular por traspaso (T)*.
- **Resolución Técnica Adoptada:** Tras analizar el comportamiento real de las distribuidoras, el ERP **hace caso al flujograma (Pág. 11)**. Las Subrogaciones (S) no cortan el ciclo de facturación y se auto-activan en el Paso 02. Los Traspasos (T) sí cortan el ciclo, requieren lectura real, y por tanto el ERP exige que esperen pacientemente al Paso 05.
