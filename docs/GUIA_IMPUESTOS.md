# Guía Maestra de Impuestos y Tasas (ERP Comercializadoras)

Esta guía documenta toda la lógica de negocio, arquitectura y optimizaciones críticas relacionadas con la liquidación de impuestos (Modelo 560 AEAT) y tributos locales (Tasa Municipal). 

Las reglas descritas a continuación son de obligado cumplimiento para garantizar que el ERP genere desgloses exactos, prevenga requerimientos por parte de la Agencia Tributaria y evite caídas de los servidores (Vercel) al procesar altos volúmenes de datos.

---

## 1. MODELO 560 (IMPUESTO ESPECIAL SOBRE LA ELECTRICIDAD)

El Modelo 560 es la declaración a la AEAT del Impuesto Eléctrico. La generación del fichero de desglose (TXT/CSV) requiere una precisión milimétrica.

### 1.1 Exclusión de Zonas Forales y Especiales
La declaración del Modelo 560 que se presenta en la **AEAT Peninsular** no debe incluir las facturas de territorios con régimen fiscal propio o imposición especial.
- **Regla:** El sistema debe excluir matemáticamente todas las facturas correspondientes al País Vasco (Álava, Guipúzcoa, Vizcaya), Navarra, Ceuta y Melilla.
- **Detección:** Se realiza mediante los Códigos Postales (`01`, `20`, `31`, `48`, `51`, `52`) o leyendo explícitamente el nombre de la provincia del `SupplyPoint`.
- **Riesgo:** Si no se aplica esta exclusión, se sobredeclara la Base Imponible y la Cuota Íntegra a la Hacienda Estatal, pagando impuestos de más.

### 1.2 Extracción Real del Impuesto (No aplicar Tipos Fijos a bulto)
- **Error común de proveedores externos:** Coger la suma total de las bases imponibles de todos los suministros de baja tensión (SBFO) y multiplicarla por un tipo impositivo fijo (ej. 3,8% o 5,112696%). Esto genera cuotas irreales.
- **Regla del ERP:** El cálculo de la cuota agregada **NUNCA** se hace multiplicando la suma de bases por un porcentaje. El ERP debe leer individualmente el campo `Importe Impuesto` extraído de cada factura en el momento de su emisión.
- **Motivo:** A lo largo de un trimestre coexisten distintas tarifas, bonificaciones gubernamentales o reducciones de base imponible. Solo la suma del impuesto exacto cobrado factura a factura garantiza cuadrar al céntimo la contabilidad.

### 1.3 Desglose de Exenciones (Clave 98.1E)
- Cuando se declaran exenciones o reducciones (por ejemplo, usos industriales o riegos bajo la clave 98.1E), Hacienda exige trazabilidad absoluta.
- **Regla:** Queda prohibido agrupar toda la energía y base imponible exenta en una única línea totalizadora. Cada exención debe ir desglosada individualmente con el **NIF del destinatario** y su **CIE** (Código de Identificación de la Electricidad). La omisión de estos datos provoca un requerimiento automático de la AEAT.

---

## 2. TASA MUNICIPAL (1.5% POR UTILIZACIÓN PRIVATIVA)

La Tasa Municipal exige declarar los ingresos facturados en un ayuntamiento específico, descontando impuestos y bonos sociales.

### 2.1 Aislamiento de Datos por Marca (SaaS)
- **Regla:** Todas las consultas a la base de datos (Prisma) deben inyectar obligatoriamente el `brandId` del usuario activo en la sesión. Bajo ninguna circunstancia se debe permitir que una comercializadora liquide o visualice consumo y tasas pertenecientes a otra marca del ecosistema.

### 2.2 Algoritmo Híbrido de Cruce de Municipios (Fuzzy Matching Avanzado)
El mayor problema al extraer los datos de la Tasa Municipal es que las distribuidoras introducen los nombres de las ciudades con múltiples erratas, sin tildes, sin apóstrofes o usando formatos acortados (ej. `LOSPITALET DE LINFANT` en lugar de `VANDELLÒS I L'HOSPITALET DE L'INFANT`).
- **Problema de los Códigos Postales:** Buscar por Código Postal es insuficiente, ya que a menudo vienen mal registrados desde la distribuidora y Google/Correos los invalida.
- **Solución implementada:** Se ignora el Código Postal y se utiliza un algoritmo mixto basado en **Distancia de Levenshtein**:
  1. **Limpieza Extrema:** Se eliminan acentos, apóstrofes, caracteres especiales y palabras vacías o artículos ("DE", "I", "LA", "EL").
  2. **Coincidencia Exacta o Substring:** Si el municipio limpio encaja 1 a 1, se acepta inmediatamente.
  3. **Tolerancia a Errores (Levenshtein):** Si no hay coincidencia exacta, se trocean ambos nombres en palabras significativas (>= 4 letras). Se exige que **todas** las palabras clave del municipio de la factura existan en el municipio buscado, pero se permite un margen de error tipográfico de **1 o 2 letras** por palabra (distancia de Levenshtein).
  4. **Prevención de Falsos Positivos:** Al exigir que *todas* las palabras del registro facturado coincidan con la cadena principal, evitamos mezclar municipios (ej. evita que "L'Hospitalet de Llobregat" se sume a "L'Hospitalet de l'Infant" porque "Llobregat" no encajará). Además, antes del cálculo, se recorta la provincia (`-- TARRAGONA`) de la cadena de búsqueda.

### 2.3 Redondeo Comercial Exacto
- El cálculo `(Base IVA - Bono Social - Impuesto Eléctrico - Base F1) * 0.015` genera flotantes infinitos.
- **Regla:** El motor de cálculo en backend debe aplicar un redondeo comercial estricto a 2 decimales (`Math.round(valor * 100) / 100`) antes de agregar totales o pasarlos al Frontend/Excel, previniendo descuadres contables en la liquidación.

### 2.4 Columnas en Reportes (Frontend y Excel)
- Por reglas de negocio, los reportes de la Tasa Municipal deben excluir la columna "Base Imponible Factura".
- Se exige mostrar "Base Imponible IVA" para dejar claro de dónde parte el cálculo.
- Siempre deben aparecer el "NIF Cliente" y la "Distribuidora" en el desglose para que el Ayuntamiento pueda auditar los sujetos pasivos.

---

## 3. ARQUITECTURA Y RENDIMIENTO (PREVENCIÓN DE TIMEOUTS)

Las consultas tributarias a menudo exigen analizar periodos larguísimos (ej. 4 a 7 años de facturación).

### 3.1 Vercel Serverless Timeouts (Error 504 / 500)
- El entorno de Vercel (Hobby/Pro) destruye las peticiones API que superan los 15-60 segundos. 
- Extraer todas las facturas de una marca para 7 años (pueden ser >60.000 registros) a memoria (RAM del proceso Node.js) y luego filtrarlas en Javascript toma más de 30 segundos, provocando un error 504 o de memoria (OOM).

### 3.2 Optimización de Consultas en Prisma (Pre-Filtrado)
- **Regla de Oro:** Nunca pedir a Prisma que cargue cientos de miles de facturas si el usuario solo quiere calcular un ayuntamiento concreto.
- **Técnica:** 
  1. Se consulta primero la tabla `SupplyPoint` filtrando únicamente los IDs de los suministros que pertenecen a ese ayuntamiento (usando la lógica de Fuzzy Matching). Este paso toma apenas milisegundos.
  2. Una vez obtenidos esos IDs (ej. 4 suministros), se pide a `Invoice` que devuelva las facturas con `supplyPointId: { in: matchingIds }` en el rango de fechas.
  3. Resultado: Se bajan 32 facturas en lugar de 60.000, reduciendo el tiempo de ejecución de la API de **34 segundos a menos de 0.1 segundos**.
  4. El uso de `.select` en Prisma es obligatorio para traer solo los campos numéricos estrictamente necesarios (`taxAmount`, `subtotal1`, etc.) e ignorar objetos anidados pesados si no se van a utilizar en la agregación.
