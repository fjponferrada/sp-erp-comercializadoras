# Guía de Procesamiento e Importación de COMPODEM

Esta guía detalla el funcionamiento del módulo de importación de COMPODEM en el SP ERP Comercializadoras, explicando de dónde provienen los datos, cómo se procesan y en qué lugar exacto de la base de datos se almacenan.

## 1. ¿Qué es COMPODEM?

COMPODEM (Coste de los Componentes del Precio de la Demanda) es un conjunto de archivos publicados por REE (Red Eléctrica de España) a través de ESIOS. Estos archivos detallan, hora a hora (o cuarto de hora a cuarto de hora), el coste de los diferentes servicios de ajuste del sistema eléctrico y otros recargos regulados que se suman al precio base de la energía (OMIE) en la factura final.

REE publica los datos de COMPODEM en sucesivas "liquidaciones" a medida que consolida medidas reales. La maduración clásica es:
- **Liquidaciones Provisionales (A):** A1, A2, A5...
- **Liquidaciones Definitivas (C):** C1, C2, C3, C4, C5, C6, C7, C8...

## 2. Origen de los Datos e Importación

El usuario interactúa con la plataforma desde `/compras/importar-compodem`, arrastrando y soltando un archivo comprimido `.zip` descargado previamente desde ESIOS.

El sistema envía este archivo al servicio `CompodemService.ts` en el backend, el cual desempaqueta en memoria el contenido y busca iterativamente los archivos CSV clave basándose en su nomenclatura.

### 2.1 Archivos Extraídos del ZIP
El servicio extrae fundamentalmente dos tipos de ficheros:
1. **Fichero Base COMPODEM** (`*_compodem_*`): Contiene la matriz con todos los componentes económicos (desvíos, restricciones técnicas, pagos por capacidad, banda secundaria, etc.).
2. **Fichero Factor K** (`*kestimqh*` o `*krealqh*`): Contiene la curva del Factor K (pérdidas horarias reales de red ajustadas).

## 3. ¿Qué información se extrae y se procesa?

Desde el fichero base `_compodem_`, el sistema procesa tres bloques principales de información económica horaria:

### A. Componentes Individuales
Se guardan directamente en bruto las columnas correspondientes a:
- **RT3 / RT6 / CT2 / CT3 / BS3 / RAD3 / RAD1X / BALX / EXD / IN7 / CFP**

### B. Componentes Agrupados (Módulos)
El sistema agrupa matemáticamente varios de los componentes anteriores para usarlos en el motor de cotizaciones (`PricingEngine`):
- **RESTRICCIONES:** Suma de `RT3 + RT6`.
- **OS (Servicios de Ajuste del Operador del Sistema):** Suma del resto de componentes que aplican al ajuste del sistema.

### C. Total Agregado
- **TOTAL_COMPODEM:** La suma consolidada total del coste de COMPODEM para esa hora. Se utiliza en los dashboards para saber rápidamente el "Estado de Actualización" del mes.

### D. Factor K
El sistema busca el coeficiente K en base a una **regla de negocio estricta** (Regla 129):
- Si el fichero tiene versión **A1, C1, A2, C2, C3 o C4** (liquidaciones jóvenes): Busca el fichero `kestimqh` (estimado cuartohorario).
- Si el fichero tiene versión **A5, C5, C6, C7 o C8** (liquidaciones definitivas reales): Busca el fichero `krealqh` (real cuartohorario).
- Se ignora a propósito cualquier archivo K diario (`kestimado` o `kreal_diario`), priorizando siempre el formato matriz cuartohorario de 96 posiciones por día.

## 4. Almacenamiento en Base de Datos

Absolutamente todos los datos (individuales, agrupados y totales) se insertan en una única tabla estandarizada del esquema Prisma.

**Tabla:** `SystemComponentPrice`

### Estructura de Campos en la Tabla

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | String | Identificador único (CUID) del registro. |
| `component` | String | Nombre del componente guardado. Puede ser: `K`, `TOTAL_COMPODEM`, `RESTRICCIONES`, `OS`, `OMIE` o cualquier componente individual (`RT3`, `CT2`, etc.). |
| `date` | DateTime | Fecha a la que pertenece la matriz (Ej: `2026-06-01T00:00:00Z`). Solo se guarda la fecha base (sin horas). |
| `values` | Float[] | Matriz o array numérico que contiene la curva. Por lo general, tendrá **24 valores** (uno por hora) para los ficheros compodem clásicos, o **96 valores** (uno cada cuarto de hora) para los ficheros como el Factor K. |
| `version` | String | Identificador de la liquidación de la que proviene el dato (Ej: `C1`, `C2`, `A5`). |
| `createdAt` | DateTime | Fecha y hora en la que se importó el archivo por primera vez. |
| `updatedAt` | DateTime | Fecha y hora de la última vez que un fichero sobreescribió este registro. |

### Lógica de Sobreescritura (Upsert)

La tabla tiene un índice único sobre la combinación `[component, date]`.
Durante la importación de un `.zip`:
1. El sistema lee la versión del ZIP.
2. Si para el mismo `date` y `component` ya existe un registro con la misma versión o una más nueva, **no lo sobrescribe**.
3. Si no existe, o existe una versión anterior (Ej: había un C1 y se sube un C2), **actualiza la matriz de valores `values`** y sube el string `version` a la nueva versión importada.

## 5. Casos de Uso del Dato

Una vez los datos descansan en `SystemComponentPrice`, son consumidos por distintas piezas de la plataforma:
- **`PricingEngine`:** Utiliza `smartMergeDB` para viajar al pasado, leer los componentes `RESTRICCIONES`, `OS` y `K`, sacar una media estadística según el nivel de riesgo y proyectarlos 12 meses al futuro en el cotizador.
- **`InternalBillingEngine`:** Consulta los datos exactos del mes facturado para aplicar los costes reales passthrough de REE a los clientes finales.
- **Visor de Precios (`/compras/precios-componentes`):** Pinta de forma interactiva las series temporales de la base de datos para auditoría visual humana.

## 6. Página de Precio Componentes (Visor de Precios)

La interfaz ubicada en `/compras/precios-componentes` es la herramienta principal de auditoría para verificar la correcta ingesta tanto de COMPODEM como de OMIE. Consta de dos herramientas analíticas principales:

### 6.1 Visor de Precios Gráfico
Permite seleccionar cualquier componente extraído individualmente (ej. `AJOM`, `CT2`, `EXD`, `K`, `TOTAL_COMPODEM`) en un rango de fechas personalizado. El backend, mediante la API `/api/precios-componentes`, extrae la matriz de `values` de `SystemComponentPrice` para ese periodo y la pinta en un gráfico interactivo temporal, permitiendo exportar el detalle a CSV.

### 6.2 Promedios Mensuales (Últimos 12 meses)
Esta tabla actúa como el principal panel de control histórico consolidado, mostrando la media aritmética mensual de los tres agregados principales del sistema eléctrico.

El cálculo se realiza **en tiempo de servidor (Server-Side Rendering)** al cargar la página:
1. El backend retrocede 12 meses en el tiempo.
2. Consulta en `SystemComponentPrice` todos los registros de los componentes `OMIE`, `RESTRICCIONES` y `OS`.
3. Para cada día y cada componente, extrae el array de `values` (de 24 o 96 posiciones) y suma todos sus valores.
4. Agrupa las sumas por mes (ej. `2026-06`) y cuenta el número total de horas o cuartos de hora registrados en ese mes.
5. Divide la suma total mensual entre el recuento de horas (`sum / count`) para obtener el coste promedio exacto en **€/MWh** de ese mes.

*Nota:* Como se explicó en el apartado 3, los valores de `RESTRICCIONES` (RT3 + RT6) y `OS` (resto de servicios de ajuste) son agrupaciones matemáticas que el motor calculó durante la importación inicial del ZIP, por lo que esta tabla simplemente consolida dichas agrupaciones pre-calculadas.
