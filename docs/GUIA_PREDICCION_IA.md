# Guía del Motor de Predicción de Demanda e Inteligencia Artificial

Este documento detalla la arquitectura, reglas matemáticas y decisiones de diseño implementadas en el módulo de Predicción de Compras de Energía del ERP (Módulo IA). Sirve como referencia técnica para comprender por qué el motor actúa de forma determinista y cómo evitar regresiones en el futuro.

## 1. Arquitectura General del Motor

El motor de predicción se divide en dos algoritmos paralelos, dependiendo del tipo de cliente (Segmento):

1. **SDA (Similar Day Average)**: Utilizado exclusivamente para los segmentos **VIP** y **VE (Vehículo Eléctrico)**.
   - **Motivo**: Estos segmentos son altamente predecibles y dependen estrictamente de contratos individuales con perfiles de carga fijos. No se benefician de la Inteligencia Artificial genérica.
   - **Mecanismo**: Busca exactamente el consumo de esos mismos CUPS en el mismo día de la semana de la semana anterior.
2. **IA (Decision Tree Regression)**: Utilizado para el **Resto de Segmentos** (Hogares, PYMEs, etc.).
   - **Motivo**: El consumo masivo depende fuertemente de la meteorología (temperatura) y de la estacionalidad. Se utiliza un Árbol de Decisión entrenado con el histórico meteorológico y de consumo.

## 2. Compresión Matemática (Feature Aggregation)

### El Problema de la "Ruleta Rusa" (Muestreo Aleatorio)
Inicialmente, el modelo extraía 10.000 muestras aleatorias (`Math.random()`) del histórico bruto de curvas de carga. Esto provocaba **varianza estocástica**: el modelo aprendía anomalías, picos de consumo atípicos (ej. un cliente encendiendo maquinaria un martes a las 10:00) y generaba curvas en forma de "diente de sierra" impredecibles en cada re-entrenamiento.

### La Solución Determinista
Para conseguir una curva suave y 100% predecible, el entrenamiento de la IA (`/api/cron/train-forecast`) aplica una compresión agrupando todo el histórico de la base de datos (`AggregatedLoadCurve`):

*   **Clave de Agrupación**: `segmentId | provinceId | díaDeLaSemana | horaDelDía`
*   **Cálculo**: Se calcula la **media aritmética exacta** del consumo (`avgY`) y de la temperatura (`avgTemp`) para cada grupo.
*   **Resultado**: El modelo aprende de "perfiles de carga puros" (ej. El consumo medio real de una PYME en Madrid un lunes a las 10:00 con 22ºC) en lugar de aprender del ruido individual.

## 3. Limitaciones Serverless y Downsampling

Al agrupar el histórico completo cruzando Provincias, Segmentos, Días y Horas con sus respectivas Temperaturas, la matriz multidimensional generada puede superar holgadamente los **100.000 registros**. 

Dado que el ERP está desplegado en un entorno Serverless (Vercel), los endpoints tienen un **límite estricto de ejecución (Timeout de 10-15 segundos)**. Si se intenta entrenar el Árbol de Decisión con 150.000 nodos en memoria, el proceso se cuelga y la interfaz de usuario se queda bloqueada indefinidamente (ej. "Sincronizando... 95%").

Para evitar esto, se implementa un **Downsampling Determinista**:
1. Se capan las muestras a un máximo de `10.000`.
2. Para evitar micro-variaciones (dado que los iteradores de mapas en memoria de JS como `Map.entries()` no garantizan el orden tras consultas a BD sin `ORDER BY`), **se ordena la matriz multidimensional entera** secuencialmente por todas sus columnas numéricas.
3. Una vez ordenada matemáticamente, se extraen los 10.000 puntos usando intervalos regulares (`Math.floor(i * step)`). 
4. Esto garantiza que el entrenamiento sea hiper-rápido y **100% idéntico** en infinitos re-entrenamientos.

## 4. Zonas Horarias y el "Efecto Fin de Semana"

Es crítico tener en cuenta cómo manejan las fechas Next.js, Vercel (UTC) y el navegador del cliente (Hora Local Española).

*   **Predicción para "Mañana"**: El botón "Generar Predicción Mañana" utiliza `startOfDay(addDays(new Date(), 1))`.
*   Si un usuario hace clic a las **00:15 h del Sábado** (hora española), el servidor de Vercel (UTC) evaluará que son las **22:15 h del Viernes**. 
*   "Mañana" para Vercel será el Sábado. "Mañana" para el usuario local será el Domingo.
*   Esto puede provocar aparentes "desplomes de volumen de energía VIP" (ej. bajadas drásticas de 19 MWh a 6 MWh), que no son bugs matemáticos, sino simplemente que el sistema está prediciendo la carga de un Domingo (día de inactividad industrial) en lugar de un Sábado. El código debe manejar siempre las fechas forzando el Timezone de Europa/Madrid.

## 5. Sincronización y Agregación

La base de datos maneja dos capas de información de consumo:
1.  **`LoadCurve`**: Millones de registros brutos importados de los archivos ZIP de las distribuidoras.
2.  **`AggregatedLoadCurve`**: Tabla resumen que agrupa los consumos por día, hora, segmento y provincia.

*   **Sincronización Normal**: El botón "Sincronizar y Entrenar" llama a `AggregationService.regenerateAggregates(30)`. Solo recalcula las agregaciones de los últimos 30 días (operación muy rápida) y entrena el modelo.
*   **Sincronización Profunda**: Llama a `regenerateAggregates(365)`. Destruye y recalcula todo el histórico de un año entero. **Solo debe usarse si se han importado archivos ZIP de facturación muy antiguos** (ej. de hace 6 meses) que el sistema no tenía agregados. No aporta ninguna mejora matemática al modelo de IA si no hay datos nuevos en disco.
