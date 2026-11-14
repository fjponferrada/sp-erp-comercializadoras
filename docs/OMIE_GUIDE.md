# Guía de Importación de OMIE (Mercado Diario SPOT)

Esta guía detalla el funcionamiento interno del proceso de importación de los precios del mercado mayorista eléctrico (OMIE) en el SP ERP Comercializadoras y su auditoría posterior en el Visor de Precio Componentes.

## 1. ¿Qué es la Importación de OMIE?

El proceso de importación de OMIE permite cargar manualmente los precios horarios o cuartohorarios del mercado diario SPOT. Estos datos son publicados por el operador del mercado (OMIE) o el operador del sistema (REE - ESIOS) y representan el componente base del coste mayorista de la energía antes de sumar servicios de ajuste (COMPODEM), desvíos (REGANECU), pérdidas de red y peajes regulados.

## 2. Origen de los Datos, Seguridad y Flujo de Importación

El usuario interactúa desde la vista `/compras/importar-omie`, donde sube el fichero exportado desde ESIOS u OMIE.

- **Ruta API:** `POST /api/compras/importar-omie`
- **Control de Acceso:** El endpoint verifica sesión activa mediante `auth()` y exige que el usuario pertenezca a uno de los roles autorizados del área de Compras (`SUPERADMIN`, `COMPANYADMIN` o `BACKOFFICE`).
- **Procesamiento en memoria:** El backend procesa el `Buffer` íntegramente en RAM sin escribir archivos temporales en disco.

### 2.1 Formatos de Archivo Soportados
El importador soporta de forma transparente los formatos habituales de exportación del sector:
1. **XLS (HTML tabular de ESIOS):** Archivos descargados con extensión `.xls` cuyo contenido interno es una tabla HTML (`<tr>` y `<td>`).
2. **Archivos tabulares reales (CSV / XLSX):** Hojas de cálculo o ficheros CSV estándar leídos mediante la librería `xlsx`.

## 3. Lógica de Extracción de Datos (Parsing)

El parseador emplea una estrategia dual en cascada:

1. **Estrategia Principal (`cheerio` para HTML de ESIOS):**
   - Carga el contenido textual y localiza todas las filas `<tr>`.
   - En cada fila con al menos 6 celdas `<td>`, extrae el **precio** de la quinta columna (`tds[4]`, normalizando separadores de miles `.` y coma decimal `,`) y el **timestamp ISO** de la sexta columna (`tds[5]`).
   - Parsea la marca temporal con `/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}/` para obtener `dateKey` (`YYYY-MM-DD`), `hour` y `minute`.

2. **Estrategia Secundaria (Fallback con `xlsx`):**
   - Si no existen nodos HTML `<tr>`, interpreta el buffer como libro Excel/CSV (`xlsx.read(buffer, { type: 'buffer' })`).
   - Recorre las celdas de cada fila buscando el patrón ISO de fecha/hora y toma automáticamente el valor numérico o texto decimal de la **celda inmediatamente anterior (`c - 1`)** como precio.

## 4. Normalización Horaria vs Cuartohoraria (Regla 169)

Con la transición del mercado ibérico a liquidación cuartohoraria (96 periodos por día), el importador es híbrido y autodetecta la resolución día a día:

- Agrupa todas las tuplas `{ hour, minute, value }` por fecha (`YYYY-MM-DD`).
- **Autodetección por día:** Si alguna tupla tiene `minute !== 0` o el día supera 25 registros, se clasifica como **cuartohorario**; en caso contrario, como **horario**.
- **Construcción del vector `values`:**
  - **Cuartohorario:** Construye un array de al menos **96 posiciones** (o hasta 100 en el cambio de hora de otoño), indexado mediante `(hour * 4) + (minute / 15)`.
  - **Horario:** Construye un array de al menos **24 posiciones** (o 25 en el cambio de hora de otoño), indexado directamente por `hour`.

## 5. Almacenamiento en Base de Datos

La información procesada se unifica en la misma tabla maestra que COMPODEM y el Factor K:

**Tabla:** `SystemComponentPrice` (`@@unique([component, date])`)

### Campos Clave Guardados
- `component`: Valor fijo **`OMIE`**.
- `date`: Fecha base del día en medianoche UTC (`YYYY-MM-DDT00:00:00.000Z`).
- `values`: Array `Float[]` con los 24 o 96 precios en `€/MWh`.
- `version`: Se registra con el identificador **`IMPORT`**.

### Lógica de Sobreescritura
Si ya existe un registro para `('OMIE', date)`, el importador ejecuta `update` reemplazando `values` y manteniendo `version: 'IMPORT'`, permitiendo corregir o reimportar curvas de cualquier día.

## 6. Integración en el ERP y Auditoría en Precio Componentes

Una vez almacenada, la serie `OMIE` es consumida directamente por:
- **`PricingEngine` y Orquestador de Portfolio (`/api/cron/update-portfolio`):** Para construir las curvas horarias normalizadas de pato (ventana móvil de 365 días por `mes - díaSemana - hora`) que modulan los futuros Carga Base (`FuturePrice`) en `PortfolioBaseCurve`, comprimiendo curvas de 96 cuartos a medias horarias.
- **Motor de Liquidaciones PPA (`POST /api/ppas/liquidaciones` y `src/lib/ppaEngine.ts`):** Cruza los precios reales de `OMIE` (tanto días horarios de 24h como cuartohorarios de 96qh, así como los domingos de cambio horario de marzo `23h`/`92qh` y octubre `25h`/`100qh` mapeados por `mapOmieIntervalToMadridClock`) contra los contratos PPA Físicos y Financieros (`CfD`) de la comercializadora activa para obtener el precio medio capturado solar/base y el importe exacto de liquidación.
- **`InternalBillingEngine`:** Para facturar con exactitud horaria o cuartohoraria (Regla 169) los contratos indexados *Pass-Through* tras elevar el consumo a barras de central.
- **Visor de Precios (`/compras/precios-componentes`):**
  - **Componente por defecto:** `OMIE` aparece priorizado en **primera posición** del selector de componentes.
  - **Visor gráfico y exportación:** Consulta `GET /api/precios-componentes` (protegido por `isComprasAuthorized` y acotado a días UTC completos `00:00:00.000Z..23:59:59.999Z`), muestra la media diaria en `€/MWh`, la columna `Versión` (`IMPORT`) y permite exportar el detalle horario/cuartohorario a CSV con BOM UTF-8 (`\uFEFF`) vía `Blob`.
  - **Promedios Mensuales (Últimos 12 meses):** El servidor calcula primero la **media diaria (`dailyAvg`)** de cada día y luego promedia los días de cada mes UTC (`YYYY-MM`), garantizando que en meses híbridos los días de 24 horas y los días de 96 cuartos de hora pesen exactamente **1 día** cada uno sin distorsionar la media mensual de `OMIE`.
