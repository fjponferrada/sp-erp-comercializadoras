# Guía de Procesamiento e Importación de COMPODEM

Esta guía detalla el funcionamiento del módulo de importación de COMPODEM y del Visor de Precio Componentes en el SP ERP Comercializadoras, explicando de dónde provienen los datos, cómo se validan y procesan, en qué tabla y campos se almacenan y cómo se auditan visualmente.

## 1. ¿Qué es COMPODEM?

COMPODEM (Coste de los Componentes del Precio de la Demanda) es un conjunto de archivos publicados por REE (Red Eléctrica de España) a través de ESIOS. Estos archivos detallan, hora a hora (o cuarto de hora a cuarto de hora en el caso del Factor K), el coste de los diferentes servicios de ajuste del sistema eléctrico y otros recargos regulados que se suman al precio base de la energía (OMIE) en la factura final.

REE publica los datos de COMPODEM en sucesivas "liquidaciones" a medida que consolida medidas reales. La jerarquía cronológica completa de maduración reconocida por el sistema (`SETTLEMENT_ORDER` en `src/lib/reganecuShared.ts`) comprende 16 niveles:
- **Secuencia oficial:** `A1 → C1 → A2 → C2 → A3 → C3 → A4 → C4 → A5 → C5 → A6 → C6 → A7 → C7 → A8 → C8`
- **Liquidaciones Provisionales (`A`):** `A1..A8` (avances intermedios con medidas provisionales).
- **Liquidaciones Definitivas (`C`):** `C1..C8` (cierres consolidados de REE).

## 2. Origen de los Datos, Seguridad e Importación

El usuario interactúa con la plataforma desde `/compras/importar-compodem` (`ImportarCompodemPage` + `ImportarClient`), arrastrando y soltando un archivo comprimido `.zip` (o `.ZIP`) descargado desde ESIOS.

- **Control de acceso:** Tanto la página SSR `/compras/importar-compodem` como el endpoint `POST /api/compodem/import` verifican sesión activa y rol autorizado de Compras (`SUPERADMIN`, `COMPANYADMIN` o `BACKOFFICE` mediante `isComprasAuthorized`).
- **Pre-filtrado y troceado en navegador para ZIPs pesados (`JSZip`):** Los archivos maestros `liquicomun` de varios meses superan con facilidad los 10–50 MB porque incluyen miles de ficheros ajenos (`uprogram`, PDFs, `Singrdem`, etc.). Antes de enviar por red, `ImportarClient` invoca `prepareFilteredZipBatches` (`src/lib/zipClientFilter.ts`) para descomprimir recursivamente en el navegador, extraer únicamente los ficheros `_compodem_` y `k*` y re-empaquetarlos en lotes ligeros (`< 3,5 MB` cada uno), además de ampliar `experimental.proxyClientMaxBodySize: '100mb'` en `next.config.ts`.
- **Extracción recursiva y limpieza en servidor:** `CompodemService.getCompodemFiles()` desempaqueta en memoria el ZIP recibido (incluyendo subcarpetas o ZIPs anidados), ignora directorios y basura de macOS (`__MACOSX`, `._*`) y decodifica los CSV en `latin1`.
- **Recálculo reactivo y refresco inmediato:** `CompodemService.processZipBuffer()` devuelve la lista exacta de meses afectados (`affectedMonths`); si la subida consta de varios lotes, `skipRecalc` pospone `runCalculatePendingEnergy` hasta el último lote para recalcular todos los meses afectados de una sola vez. Al finalizar, el backend ejecuta `revalidatePath('/compras/importar-compodem')`, `revalidatePath('/compras/precios-componentes')` y `revalidatePath('/gestion/energia-pendiente')`, y el cliente invoca `router.refresh()` para actualizar al instante los indicadores en pantalla.

### 2.1 Archivos Extraídos del ZIP
El servicio extrae dos familias de ficheros:
1. **Fichero Base COMPODEM** (`*_compodem_*`): Contiene las filas horarias con los componentes económicos del sistema.
2. **Fichero Factor K** (`*kestimqh*` o `*krealqh*`): Contiene la curva cuartohoraria del Factor K (coeficiente de ajuste de pérdidas reales de red).

### 2.2 Panel "Estado de Actualización (Últimos 12 meses)"
Debajo del área de carga en `/compras/importar-compodem`, el servidor (`dynamic = 'force-dynamic'`) consulta los registros de `TOTAL_COMPODEM` de los últimos 12 meses usando claves de fecha **100% UTC** (`YYYY-MM` y `YYYY-MM-DD`):
- Calcula para cada mes la **versión más antigua (menor rango en `SETTLEMENT_RANKS`)** presente entre todos sus días cargados (codificada por colores: azul para `C3..C8`, rojo para `C1..C2`, ámbar para `A1..A8`, gris para `Sin datos`).
- Contabiliza cuántos días únicos (`coveredDays`) existen frente al total de días naturales del mes (`totalDays`). Si el mes está incompleto (`coveredDays < totalDays`), muestra junto al badge un aviso explícito **`Parcial (X/Y días)`** para evitar confundir una carga parcial con un mes completo cerrado.

## 3. ¿Qué información se extrae y se procesa?

Desde el fichero base `_compodem_`, el sistema filtra exclusivamente los registros cuyo campo `Tipo` sea **`NOCUR`** y excluye expresamente el componente **`PC3`** (Pagos por Capacidad, tarificados por vía regulada independiente). Con ello construye curvas diarias de 24 valores horarios:

### A. Componentes Individuales
Se guardan por separado todos los componentes individuales presentes con `Tipo === 'NOCUR'` (excepto `PC3`), tales como:
- `RT3`, `RT6`, `CT2`, `CT3`, `BS3`, `RAD3`, `RAD1`, `RAD1X`, `BALX`, `EXD`, `IN7`, `CFP`, `MI`, `SECX`, `AJOM`, etc.

### B. Componentes Agrupados (Módulos)
El sistema calcula matemáticamente dos agregados horarios consumidos directamente por `PricingEngine` e `InternalBillingEngine` (Regla 128):
- **RESTRICCIONES:** Suma exacta de `RT3 + RT6 + CT2 + CT3`.
- **OS (Servicios de Ajuste del Operador del Sistema):** Suma exacta de `BS3 + RAD3 + RAD1 + RAD1X + BALX + EXD + IN7 + CFP + MI + SECX`.

### C. Total Agregado
- **TOTAL_COMPODEM:** Suma consolidada de todos los componentes `NOCUR` válidos (excluyendo `PC3`) para cada hora. Sirve como serie global de auditoría y como indicador maestro del estado mensual de importación.

### D. Factor K y Normalización en Cambios de Hora (DST)
El sistema selecciona el coeficiente `K` según la madurez de la liquidación (Reglas 129 y 169):
- Versiones **`A1, C1, A2, C2, A3, C3, A4, C4`**: procesa exclusivamente `kestimqh` (estimado cuartohorario).
- Versiones **`A5, C5, A6, C6, A7, C7, A8, C8`**: procesa exclusivamente `krealqh` (real cuartohorario).
- Se descartan los ficheros diarios (`kestimado`, `kestmedio`, `kreal_`) para mantener siempre matrices cuartohorarias de **96 posiciones**.
- **Normalización DST de primavera (23h / 92 cuartos):** Dado que `PricingEngine` e `InternalBillingEngine` exigen arrays de longitud exacta **24** (horaria) o **96** (cuartohoraria), en el domingo de cambio de hora de marzo el sistema replica el último valor válido conocido en los huecos finales, evitando introducir ceros artificiales (`0 €/MWh` o `K = 0`) que distorsionarían las medias y la elevación de pérdidas.

## 4. Almacenamiento en Base de Datos

Todos los componentes (individuales, agrupados, `TOTAL_COMPODEM`, `K` y también `OMIE`) se almacenan en una única tabla del esquema Prisma:

**Tabla:** `SystemComponentPrice`

### Estructura de Campos en la Tabla

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | String | Identificador único (CUID) del registro. |
| `component` | String | Código del componente (`K`, `TOTAL_COMPODEM`, `RESTRICCIONES`, `OS`, `OMIE` o componente individual como `RT3`, `CT2`, etc.). |
| `date` | DateTime | Fecha UTC base del día (`YYYY-MM-DDT00:00:00.000Z`). |
| `values` | Float[] | Array numérico con la curva del día: **24 valores** (horarios) para COMPODEM o **96 valores** (cuartohorarios) para `K` y `OMIE` cuartohorario. |
| `version` | String | Identificador de la liquidación de origen (ej. `A1`, `C1`, `C2`, `A5`, `C5` o `IMPORT` para OMIE). |
| `createdAt` | DateTime | Fecha y hora de primera inserción del registro. |
| `updatedAt` | DateTime | Fecha y hora de la última actualización del registro. |

### Lógica de Sobreescritura y Persistencia por Lotes

La tabla define la clave única compuesta `@@unique([component, date])`. Durante la importación de un `.zip`:
1. **Deduplicación en memoria:** `CompodemService` consolida primero en RAM todos los trabajos del ZIP por `(component, date)`, conservando la versión de mayor rango en `SETTLEMENT_RANKS`.
2. **Precarga única (`findMany`):** Consulta de una sola vez los registros ya existentes en el rango `[minDate, maxDate]` de los componentes afectados, eliminando consultas `N+1`.
3. **Regla jerárquica de actualización (`>=`):**
   - Si no existe registro previo, se inserta en bloque mediante `createMany` (lotes de 200).
   - Si la versión entrante tiene un rango **mayor o igual (`>=`)** al existente en BD (ej. `C2` sobre `C1`, `A5` sobre `C4`, o reimportación de un `C2` corregido sobre `C2`), actualiza `values` y `version` en lotes de **20 operaciones** para respetar estrictamente el límite del pool de conexiones PostgreSQL (`pg.Pool`, Regla 134).
   - Si en base de datos ya existe una versión **estrictamente superior** (ej. existe `C3` y se sube un histórico `C1`), el registro consolidado **se protege y no se sobrescribe**.

## 5. Casos de Uso del Dato

Una vez almacenados en `SystemComponentPrice`, los datos alimentan cuatro módulos principales:
- **`PricingEngine`:** Emplea `smartMergeDB` para leer el histórico de `RESTRICCIONES`, `OS` y `K`, calcular medias estadísticas según el perfil de riesgo y proyectar precios a 12 meses vista en el cotizador.
- **`InternalBillingEngine`:** Recupera las curvas reales del periodo facturado para trasladar con precisión horaria/cuartohoraria los costes *pass-through* de REE y la modulación de pérdidas `K`.
- **Motor de Predicción y *Backtesting* OMIE (`/compras` — `ForecastService.ts`, Regla 244):** Combina el coeficiente horario/cuartohorario **`K`** (`SystemComponentPrice` con `component = 'K'`, aplicando en predicción el día equivalente `-364d` o fallback automático al mismo día de la semana más reciente publicado) con las pérdidas reguladas BOE vigentes (`RegulatedCost` `PERDIDAS`) evaluadas en `Europe/Madrid` y por prefijo provincial (`Península`, `Canarias`, `Ceuta/Melilla`) para elevar la demanda prevista y las curvas de *backtesting* a **Barras de Central (`BC`)**.
- **Motor de Energía Pendiente de Liquidar REE (`/gestion/energia-pendiente` — `src/scripts/calculate_pending_energy.ts`):** Promedia los 4 cuartos de cada hora del Factor `K` (`96qh -> 24h`) para elevar las curvas agregadas `CCH` a Barras de Central y combina el promedio mensual normalizado por días de `RESTRICCIONES` junto a `OMIE` (`OMIE + Restricciones`) para valorar económicamente el `Descuadre F1-CCH` (véase [`docs/GUIA_ENERGIA_PENDIENTE_REE.md`](./GUIA_ENERGIA_PENDIENTE_REE.md)).
- **Visor de Precios (`/compras/precios-componentes`):** Permite auditar visualmente y exportar cualquier serie temporal almacenada.

## 6. Página de Precio Componentes (Visor de Precios)

La interfaz ubicada en `/compras/precios-componentes` (`PreciosComponentesPage` + `PreciosClient`, con `dynamic = 'force-dynamic'` y cabecera limpia `showSearch={false}`) es la herramienta central de auditoría para verificar la ingesta de COMPODEM y OMIE. Consta de dos bloques analíticos:

### 6.1 Visor de Precios Gráfico y Tabla Detallada
- **Selector priorizado:** Sitúa en la parte superior los componentes troncales de negocio (`OMIE`, `TOTAL_COMPODEM`, `RESTRICCIONES`, `OS`, `K`) seguidos del resto de componentes individuales en orden alfabético (excluyendo curvas internas `PERD_*`).
- **Consulta API segura y exacta en UTC:** El endpoint `GET /api/precios-componentes` valida autorización (`isComprasAuthorized`) y acota el rango completo en UTC (`YYYY-MM-DDT00:00:00.000Z` a `YYYY-MM-DDT23:59:59.999Z`), formateando las etiquetas de fecha en `timeZone: 'UTC'` para evitar desfases de huso horario en el navegador.
- **Formato adaptado por magnitud y trazabilidad de versión:** Incluye la columna **`Versión`** de liquidación en cada fila diaria y adapta las unidades automáticamente: **`K`** se representa con **5 decimales** sin unidad monetaria (coeficiente adimensional), mientras que los componentes económicos se muestran con **2 decimales en `€/MWh`**.
- **Exportación CSV robusta:** Genera la descarga mediante `Blob` y `URL.createObjectURL` anteponiendo el BOM UTF-8 (`\uFEFF`), garantizando compatibilidad directa con Microsoft Excel (tildes y símbolo `€`) y soporte para rangos largos sin límite de longitud de URL.

### 6.2 Promedios Mensuales (Últimos 12 meses)
Esta tabla resume en Server-Side Rendering (SSR) la evolución mensual de `OMIE`, `RESTRICCIONES` y `OS`:
1. Calcula el inicio del periodo hace 11 meses usando `startOfMonth` + `Date.UTC` (evitando desbordamientos de calendario al consultar en días 29, 30 o 31).
2. Consulta en `SystemComponentPrice` todos los registros de `OMIE`, `RESTRICCIONES` y `OS` del rango.
3. Para cada registro calcula primero su **media aritmética diaria** (`dailyAvg = sum(values) / values.length`) y después promedia las medias diarias dentro de cada mes UTC (`YYYY-MM`). De este modo, días horarios (24 valores) y días cuartohorarios (96 valores) pesan exactamente **1 día** cada uno sin sesgar los meses híbridos.
4. Muestra el promedio mensual en **`€/MWh`** con 2 decimales, o **`—`** cuando aún no existen datos publicados para ese componente en un mes determinado.
