# Guía de Referencia de Ficheros Switching de la CNMC (Sector Eléctrico)

Esta guía detalla la documentación clave sobre los procedimientos de Switching regulados por la CNMC, incluyendo rutas y resúmenes de información técnica para su implementación en parsers y sistemas de la comercializadora.

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
    *   **Resumen:** Procedimiento de **Reclamaciones**. Flujo para gestionar reclamaciones entre cliente, comercializadora y distribuidora (Petición, Aceptación, Información Adicional y Cierre).
*   **CNMC - E - Formato Fichero T1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Traspaso a la COR** (Comercializadora de Referencia). Casos de impago prolongado, o extinciones de contrato.
*   **CNMC - E - Formato Fichero W1 2024.05.16.pdf**
    *   **Resumen:** Procedimiento de **Aportación de Autolecturas**. Envío de lectura del cliente a Distribución.

---

## 2. Esquemas y Definición de Nodos XML (Excel)
Estos ficheros definen campo por campo la estructura del XML (XSD) para cada paso del flujograma: nombre del tag, formato (X(2), AAAA-MM-DD...), si es obligatorio, y si está referenciado en las Tablas Maestras.

**Ruta base:** `Z:\AED\Switching\CNMC - E - V3.0 2024.05.16\CNMC - E - Anexos 2024.05.16\CNMC - E - Procesos 2024.05.16\`

*   **CNMC - E - Proceso [A3, B1, B2, C1, C2, D1, E1, E2, F1, M1, M2, P0, Q1, R1, T1, W1] 2024.05.16.xlsx**
    *   **Resumen:** Existe un fichero Excel por proceso. Cada pestaña de Excel representa un mensaje/paso (ej: `01_CambiodeComercializador`, `02_Aceptacion`, `06_ActivacionComerSaliente`).
    *   **Uso práctico en parsers:** Aquí es donde se consulta exactamente si el tag de fecha se llama `FechaActivacionPrevista`, `FechaFinalizacion` o `Fecha`, o si el identificador es `CodigoREEEmpresaEmisora` en lugar del genérico `Remitente`.
*   **Archivos `.docx` (CNMC - E - A5D, B5D, F5D, P5D)**
    *   **Resumen:** Documentos que detallan la estructura plana (o CSV/XML) de las Curvas de Carga Horaria (`CCH_FACT`, `CCH_VAL`, etc.).

---

## 3. Tablas Maestras de Códigos (Documento Maestro)
Es el "Diccionario de Datos" de todo el switching.

**Ruta base:** `Z:\AED\Switching\CNMC - E - V3.0 2024.05.16\CNMC - E - Anexos 2024.05.16\CNMC - E - Tablas de Codigos  2024.05.16\CNMC - E - Tablas de códigos 2024.05.16.docx`

*   **Resumen:** Contiene 89 tablas maestras que proporcionan los catálogos de valores permitidos para las comunicaciones:
    *   **Tabla 2:** Código de Proceso (C1, M1, B1, etc.)
    *   **Tabla 3:** Código de Paso (01, 02, 05, 06, 11, etc.)
    *   **Tabla 10:** Motivo de Baja (01 Cese, 02 Fin, 03 Corte impago, 04 Baja impago)
    *   **Tabla 17:** Tarifas ATR (códigos 018 para 2.0TD, 019 para 3.0TD, 020 para 6.1TD, etc.)
    *   **Tabla 27:** Motivos de Rechazo (Más de 100 códigos. Ej: 01: No existe PS, 11: Comercializadora incorrecta, G4: Suministro Mínimo Vital).
    *   **Tabla 28:** Motivos de Incidencia en Campo (Ej: 01 Cliente ausente).
    *   **Tabla 35:** Discriminación Horaria del equipo de medida.
    *   **Tabla 73:** Detalle Resultado de Reclamaciones.
    *   **Tabla 113:** Tipo de Autoconsumo.

> [!TIP]
> Cuando haya errores en el parser del sistema o un XML retorne valores numéricos que no entiendas, busca el número en el documento de *Tablas Maestras* bajo la tabla correspondiente. Cuando busques cómo extraer un dato concreto de un archivo XML para añadir a la base de datos, revisa la hoja de Excel (`CNMC - E - Procesos 2024.05.16`) que corresponde a ese Proceso y Paso para conocer el "Nombre de Campo" exacto.

## 4. Notas de Implementación para el ERP
- **Motor de Estados**: El backend debe basarse en el `Código de Proceso` (Tabla 2) y el `Código de Paso` (Tabla 3) para realizar transiciones de estado en la Base de Datos. Por ejemplo, al recibir un XML con Proceso `C1` y Paso `05` (Activación), el contrato asociado debe pasar a estado `Activo`.
- **D1 y Autoconsumo**: La ingesta de archivos `NotificacionCambiosATRDesdeDistribuidor.xsd` (D1, Paso 01) debe asociar automáticamente los acuerdos de reparto y coeficientes a los `Client` o `Contract` correspondientes, disparando una notificación en el Dashboard del backoffice, ya que el comercializador tiene un reloj de 10 días para enviar un rechazo (`RechazoD1.xsd` Paso 02) si existe disconformidad del cliente.
- **Evitar Dependencias**: Esta lógica reemplaza nativamente a Make, garantizando validación estricta XSD y permitiendo al usuario final ver en qué paso exacto se encuentra la activación de su luz.
