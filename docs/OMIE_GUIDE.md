# Guía de Importación de OMIE (Mercado Diario SPOT)

Esta guía detalla el funcionamiento interno del proceso de importación de los precios del pool eléctrico u OMIE a través del ERP.

## 1. ¿Qué es la Importación de OMIE?

El proceso de importación de OMIE permite cargar manualmente los precios horarios (o cuartohorarios) del mercado diario. Estos datos son publicados típicamente por el operador del mercado (OMIE) o el operador del sistema (REE - ESIOS) y representan el componente principal de coste de la energía antes de aplicar desvíos, servicios de ajuste (COMPODEM) y costes regulados.

## 2. Origen de los Datos y Flujo de Importación

El usuario interactúa desde la vista `/compras/importar-omie`, donde puede subir un archivo exportado de plataformas oficiales.

**Ruta API:** `POST /api/compras/importar-omie`

El backend procesa la subida en memoria sin guardar el archivo físico en el servidor. 

### 2.1 Formatos de Archivo Soportados
El sistema está diseñado para ser muy robusto y soporta los formatos de exportación más comunes de la industria:
1. **XLS (Falso Excel de ESIOS):** Archivos que tienen extensión `.xls` pero que internamente son código HTML puro (tablas `<tr>` y `<td>`).
2. **Archivos tabulares reales:** CSV o verdaderos Excel XLSX, parseados mediante la librería nativa `xlsx`.

## 3. Lógica de Extracción de Datos (Parsing)

El parseador emplea una doble estrategia para garantizar la lectura de los precios:

1. **Estrategia Principal (Cheerio para HTML de ESIOS):** 
   - El sistema carga el contenido del archivo como texto y busca etiquetas `<tr>`.
   - Si la fila tiene suficientes columnas, extrae el **precio** de la quinta columna (`tds[4]`) y la **fecha/hora ISO** de la sexta columna (`tds[5]`).
   - Parsea el string de fecha con la expresión regular `/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}/` para separar Día, Hora y Minuto.

2. **Estrategia Secundaria (Fallback con `xlsx`):**
   - Si la primera técnica falla (0 filas detectadas), se lee el archivo como un libro de Excel.
   - Itera por cada celda de cada fila buscando la expresión regular de fecha ISO. Cuando la encuentra, asume inmediatamente que **la celda anterior** contiene el precio flotante.

## 4. Normalización Horaria vs Cuartohoraria

A diferencia de COMPODEM, OMIE ha sido tradicionalmente un mercado horario. Sin embargo, con los recientes cambios europeos, se introdujo resolución cuartohoraria. El ERP es agnóstico y se adapta al archivo subido:

- El sistema agrupa todas las tuplas de precio-hora extraídas por día (`YYYY-MM-DD`).
- **Autodetección:** Si el sistema detecta que hay alguna tupla donde los minutos no son `00` (`minute !== 0`) o si un día tiene más de 25 registros, asume formato **cuartohorario**.
- **Generación de la Matriz:**
  - Si es cuartohorario, construye un array de 96 posiciones (o más, en cambios de hora de invierno). Posición del array = `(hora * 4) + (minuto / 15)`.
  - Si es horario, construye un array de 24 posiciones (o 25 en horario de invierno). Posición del array = `hora`.

## 5. Almacenamiento en Base de Datos

La información procesada se unifica en la misma tabla maestra que el resto de componentes del sistema.

**Tabla:** `SystemComponentPrice`

### Campos Clave Guardados
- `component`: Se guarda siempre con el valor rígido **`OMIE`**.
- `date`: La fecha del día a las 00:00:00 UTC.
- `values`: El array numérico `Float[]` con las 24 o 96 horas/cuartos de hora, rellenando con `0` los huecos sin datos de mercado.
- `version`: Se marca como **`IMPORT`** para indicar que ha sido una importación manual directa.

### Lógica de Sobreescritura
Se utiliza la clave única `[component, date]`. Si ya existe la curva OMIE para un día determinado, el sistema hace un `update` y sobreescribe la curva por la nueva subida, permitiendo corregir fallos o actualizar datos provisionales.

## 6. Integración en el ERP

Una vez subido, este array `OMIE` es consumido directamente por:
- **`PricingEngine`:** Para sumar OMIE base a la curva del portfolio en las cotizaciones a cliente.
- **`InternalBillingEngine`:** Para la refacturación exacta horaria en los contratos Pass-Through indexados a OMIE puro.
- **Auditoría visual (`PreciosComponentesPage`):** La vista gráfica de precios carga la evolución de la media diaria aritmética de este componente.
