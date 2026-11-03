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
    *   La tabla filtra todos los contratos que estaban vigentes en esa fecha exacta (`activationDate <= fecha 23:59:59` y `terminationDate === null` o `> fecha 23:59:59`), incluyendo tanto contratos con comisión activa > 0 € como contratos con comisión 0 €.
    *   No se descartan por «falsa baja» contratos que estuvieran activos en la fecha consultada aunque meses después hayan sido renovados.
    *   Las tarjetas superiores de **Contratos Activos** y **MWh Totales** (deduplicados por CUPS de 20 caracteres) se actualizan dinámicamente para reflejar la foto exacta de la cartera en esa fecha, y el botón **Exportar XLSX** descarga el detalle completo de dichos contratos (`Exportacion_Contratos_Activos_YYYY-MM-DD.xlsx`).

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

## 6. Rendimiento y Base de Datos (Prisma Postgres / Vercel)

Al alojar la base de datos en **Prisma Postgres (`db.prisma.io`)** y la web en **Vercel (Serverless)**, la gestión de conexiones es crítica:

*   **El problema del Serverless**: Vercel levanta múltiples instancias simultáneas. Si cada instancia pide 5 conexiones a la vez, se supera el límite del plan Hobby rápidamente (`Too many database connections opened`).
*   **Connection Pool Limiting**: En `src/lib/prisma.ts`, la variable `max` del `Pool` de `pg` está configurada a **1 o 2 conexiones máximo por instancia**. Esto fuerza un "cuello de botella" ordenado en la RAM de Vercel (encolando las peticiones) en lugar de tumbar la base de datos PostgreSQL por exceso de aforo.
*   **Fast Refresh Local**: En desarrollo (`npm run dev`), guardar archivos repetidamente puede dejar conexiones fantasma abiertas. La solución local es detener el proceso (`Ctrl+C`) y volver a arrancar el servidor.

---

## 7. Permisos y Visibilidad (Row Level Security en App)

El CRM Ventas asegura que la información esté encapsulada mediante filtros en las "Actions" (ej. `getDashboardMetricsAction`, `historicalInvoices`):

*   **COMERCIAL**: Solo ve los contratos, leads y facturas donde su `userId` coincida.
*   **CANAL**: Ve lo suyo y todo lo de los comerciales que cuelgan de su `channelId`.
*   **BACKOFFICE / COMPANYADMIN / SUPERADMIN**: Visibilidad total de la comercializadora (respetando la marca seleccionada en el selector de marcas).
*   **Gráfica de Evolución de Cartera en Dashboard**: En el panel principal y de análisis, la gráfica **Evolución de Cartera (MWh y Contratos)** muestra en el eje vertical izquierdo el número de **Contratos Activos** y en el eje vertical derecho los **MWh** (`Total Activos MWh`, `Altas MWh` y `Bajas MWh`), reflejando ambos indicadores en el tooltip interactivo de cada mes.
*   Esta arquitectura convierte al sistema en un **CRM propietario multi-tenant**, ahorrando costes de licencias externas (Salesforce, HubSpot) y manteniendo toda la lógica adaptada nativamente al sector eléctrico español.
