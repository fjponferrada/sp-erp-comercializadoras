# 📈 Guía Definitiva: Curvas de Carga Horaria (CCH) y su Importación

Esta guía documenta exhaustivamente la arquitectura, lógica de negocio y los flujos de importación relacionados con las Curvas de Carga Horaria (CCH) dentro del ERP SP Energía, basándose en las normativas del sistema y las restricciones de infraestructura (Vercel Serverless).

---

## 1. Conceptos Fundamentales

Las **Curvas de Carga Horaria (CCH)** representan el consumo (y opcionalmente la inyección de excedentes) de un punto de suministro eléctrico (CUPS) medido cuarto-hora a cuarto-hora, u hora a hora. 

El sistema almacena esta información en la tabla `LoadCurve` (o su equivalente en base de datos), que sirve como base para:
1. **Facturación Comercial**: Cruzar la curva con los precios de mercado (OMIE) en los contratos indexados.
2. **Agregación de Demanda**: Calcular la energía total consumida por la comercializadora (Demanda BC) para liquidar contra Red Eléctrica (REE).

---

## 2. Jerarquía de Veracidad (Prioridad de Ficheros)

Las distribuidoras envían constantemente ficheros con diferentes niveles de madurez. El motor de importación (`cchParser.ts`) implementa una **jerarquía absoluta** para proteger los datos definitivos frente a rectificaciones erróneas o envíos atrasados provisionales. 

La prioridad (de mayor a menor) es la siguiente:

1. **Datos Históricos Auditados (`MIGRACION_PKL`)**: Prioridad `999`. Son los datos heredados del sistema antiguo. Son inmutables y nunca serán sobrescritos.
2. **Facturación Definitiva (`F1`, `C1`, `Q1`, `F1H`, `F1QH`)**: Prioridad máxima regular. Es el dato certificado por el que se ha cobrado/pagado.
3. **Curvas Definitivas (`F5D`, `A5D`, `B5D`)**: Ficheros mensuales ya cerrados por la distribuidora.
4. **Curvas Provisionales Mensuales (`P5D`)**: Ficheros que la distribuidora envía antes del cierre definitivo.
5. **Curvas Diarias (`P1`, `P1D`, `P2`, `P2D`)**: Envíos del día a día, muy sujetos a estimaciones y fallos de telemedida.
6. **Curvas sin clasificar (`P0`)**: Prioridad mínima.

**Regla de Oro**: El sistema *JAMÁS* sobrescribirá una curva existente en base de datos si el fichero entrante tiene una prioridad MENOR que el dato ya almacenado.

---

## 3. Procesamiento y Estandarización de Datos

El parseo de los archivos CCH implica complejas reglas de estandarización defensiva:

### A. Naturaleza Dual (Consumo vs. Excedentes)
Los archivos CCH **no son exclusivos de consumo**. Una misma fila de un fichero (ej. P5D) puede contener simultáneamente columnas de Energía Activa Entrante (Consumo) y Energía Activa Saliente (Excedentes Solares). 
El `cchParser.ts` lee ambas columnas a la vez y genera **DOS** curvas independientes en la base de datos para el mismo CUPS y fecha:
- `type = CONSUMPTION` (Consumo)
- `type = SURPLUS` (Excedentes)

### B. Corrección de Unidades (Wh a kWh)
La base de datos almacena estricta y únicamente en **kWh**. Algunas distribuidoras envían los ficheros diarios (P1D) en Vatios-hora (Wh). El parser implementa un umbral heurístico: si la suma diaria excede un límite ilógico (ej. > 2000 para tarifa VIP, > 300 para PYME), el motor deduce que está en Wh y aplica automáticamente un divisor `/ 1000`.

### C. Zonas Horarias (Local vs. UTC)
Las distribuidoras proporcionan los ficheros CCH en **Hora Local Española**. Sin embargo, Prisma y PostgreSQL operan obligatoriamente en **UTC**.
Sumar horas directamente al UTC provocaría desplazamientos de madrugada. El motor usa `fromZonedTime(fechaLocal, 'Europe/Madrid')` para transformar con precisión milimétrica la hora local al instante UTC correspondiente, respetando los cambios de horario de verano/invierno.

---

## 4. Vías de Importación

Existen dos vías principales para introducir curvas al sistema, centralizadas en la página `/ajustes/importador`:

### Vía 1: Sincronización FTP Automática
Conecta de manera directa a los servidores SFTP/FTP de distribuidoras (ej. e-Distribución, UFD, CIDE).
- **Lógica de Ejecución (Chunking)**: Debido a que las funciones Serverless de Vercel tienen un tiempo de vida máximo (10s a 60s), el backend procesa los archivos en pequeños lotes ("chunks"). El front-end (`page.tsx`) llama en bucle al endpoint `/api/cron/ftp-sync/execute` mientras este responda con la bandera `hasMore: true`. Esto evita los errores 504 (Timeout).
- **Polling**: Un proceso interno de la UI consulta cada 3 segundos el estado del Job (`/api/jobs/sync/`) para mostrar el log en vivo.

### Vía 2: Subida Manual (UI Drag & Drop)
Útil para inyectar históricos masivos desde el ordenador del usuario.
- **Procesamiento en Memoria**: Soporta archivos comprimidos `.zip`, `.gz` (Endesa/Iberdrola) y `.bz2` (ASEME). Usando `jszip` y `zlib`, los archivos se descomprimen en la memoria RAM y se iteran al vuelo. No se escriben archivos temporales en disco.
- **Límite de Vercel (4.5 MB)**: El Dropzone sube los ficheros **de uno en uno**, recomendando que los ZIP no excedan los 4.5 MB, ya que Vercel rechaza peticiones HTTP cuyo `Body` supere este tamaño de payload.

---

## 5. Excedentes y Facturación F1 (Reparación)

Durante la generación de facturas, si un cliente indexado inyecta excedentes según la factura de peajes (F1) pero su medición real no es perfecta, el motor interviene:

1. **Escalado Proporcional**: Si existe curva de excedentes en base de datos (`SURPLUS`), pero la suma total difiere del volumen cobrado en el F1, el motor calcula un coeficiente (`F1 / Suma CCH`) y multiplica cada hora por ese factor. Así se cuadran los totales respetando la forma y picos reales de inyección del cliente.
2. **Perfilado Teórico (`pSolar`)**: Si la distribuidora cobró excedentes en el F1, pero la curva real de telemedida NO LLEGÓ al sistema (hueco de datos), el motor reparte los excedentes usando el perfil de generación fotovoltaica `pSolar`. Queda **prohibido** usar coeficientes de consumo (P1-P6) para repartir energía solar, y se garantizan ceros absolutos durante las horas nocturnas para no adulterar el precio medio percibido.

---

## 6. Agregación de Demanda BC

Para liquidar compras en el mercado eléctrico (REE/OMIE), se debe conocer la demanda total de la cartera:

- **Sin Inventos**: El servicio de agregación (`AggregationService`) es conservador. Suma únicamente lo medido. Si un cliente no tiene CCH reportada por la distribuidora en un día, suma `0`. No rellena huecos con perfiles estimados, porque la intención es visualizar el déficit "real" de medida.
- **Ventana Contractual**: Al sumar las curvas, el servicio evalúa la ventana temporal del contrato (`activationDate` a `terminationDate`). Una curva solo suma al pool global si pertenece a un día en el que el contrato del cliente estaba formalmente `ACTIVO`.
- **Descuadres Estructurales**: Es normal que en meses recientes el volumen agrupado sea mucho menor que el facturado por REE (generando "Energía Pendiente a Cobrar" negativa). Esto ocurre por falta temporal de telemedida y se corrige a medida que van llegando los ficheros mensuales P5D/F5D.
