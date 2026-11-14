# Arquitectura, Estructura CNMC, API Drop-In y Exportador CSV SIPS (`SIPS.md`)

**Última actualización:** 14 de Noviembre de 2026  
**Propósito:** Especificación técnica definitiva para evolucionar el sistema SIPS provisional de `Z:\AED\SIPS\BD_AEDEN_SIPS` (Google Cloud BigQuery + Cloud Run) y dotar al ERP de:
1. **API SIPS 100% compatible con el JSON de Ingebau** (para que todos los procesos del ERP sigan funcionando cambiando únicamente la URL de consulta).
2. **Módulo Visual Frontend `"Consulta de CUPS"`** (inspirado en UniEléctrica / Ingebau).
3. **Exportador de CSVs idénticos a los de Ingebau (`{CUPS}_consumos.csv` y `{CUPS}_ps.csv`)** desde el Frontend SIPS para que el apartado **`SIPS CSV` del Cotizador (`/pricing`)** siga funcionando exactamente igual que cuando se descargaban los CSV de Ingebau.

---

## 1. Contexto Actual: De Ingebau y el SIPS Provisional (`Z:\AED\SIPS\BD_AEDEN_SIPS`) al SIPS Definitivo del ERP

### 1.1. Cómo consumía el ERP los datos de Ingebau
En el ERP existen **dos vías** que dependían del formato de Ingebau:
1. **Vía API Automática (JSON)**:
   - **`src/app/api/sips/route.ts`** y **`src/lib/sips.ts`** consultaban la API de Ingebau y recibían un JSON con `{ data: { ps: [...], consumos: [...] } }`.
   - Ese JSON lo consumen directamente el modo **"Por CUPS" del Cotizador** (`fetchSipsForPricingAction` en `supplyPointActions.ts`), el **Alta de Leads/Contratos** (`NewLeadModal.tsx` y `leadActions.ts`) y la pestaña **SIPS** dentro de Contratos (`ContractDetailClient.tsx`) y Puntos de Suministro (`SupplyPointDetailClient.tsx`).
2. **Vía Subida Manual de Archivo CSV en el Cotizador (`/pricing` $\rightarrow$ `Cálculo Genérico` $\rightarrow$ `SIPS CSV`)**:
   - En `src/app/(app)/pricing/page.tsx` (`handleFileUpload`, líneas 173–262), el usuario puede arrastrar el archivo `{CUPS}_consumos.csv` descargado del visor web SIPS de Ingebau.
   - El parser de `/pricing` lee la cabecera del CSV buscando:
     - Columna de fecha: **`Lectura Hasta`** (o `Lectura Desde`) para filtrar automáticamente los últimos **365 días** (`cutoff = maxDate - 1 año`).
     - Columna de tarifa: **`Tarifa ATR`** (esperando texto legible como `"2.0TD"`, `"3.0TD"`, `"6.1TD"`, etc.).
     - Columnas de consumo activo en **`kWh`** (excluyendo explícitamente las que contienen `Reactiva`): **`Energia Activa P1 (kWh)`** a **`Energia Activa P6 (kWh)`**.

---

## 2. Diagnóstico Completo de Todo el Contenido de `Z:\AED\SIPS\BD_AEDEN_SIPS`

Se han analizado **absolutamente todos los archivos** de `Z:\AED\SIPS\BD_AEDEN_SIPS` (`Manual_Tecnico_Arquitectura_SIPS_AEDEN.docx`, `convertir_certificado.py`, `0_descargador_masivo_cnmc.py`, `1_ingesta_bigquery.py`, `3_SIPS_TO_CSV.py`, `sips_aeden.db`, `api_error_log.txt`, los CSVs `*_ING.csv` vs generados, `backups/`, `SCRIPT ZIP TO BD NUBE/` y `SCRIPT API SIPS NUBE/`):

### 2.1. Inventario Real de la Arquitectura V3.1 Desplegada en Google Cloud (`custom-cycling-496811-q2`)
Según el **`Manual_Tecnico_Arquitectura_SIPS_AEDEN.docx`** y los scripts de la carpeta:
1. **Extracción de Certificado y Descarga Oficial CNMC (`convertir_certificado.py` + `0_descargador_masivo_cnmc.py`)**:
   - Convierte el certificado `.p12` de la comercializadora a `certificado_aeden.pem` y conecta por `OAuth1` + certificado mutuo contra `https://api.cnmc.gob.es/ficheros/v1/consultar?idProcedimiento=2&nifEmpresa=B10915544&estado=DISPONIBLE`, descargando los `.zip` mensuales en `Z:\AED\SIPS\BD_AEDEN_SIPS`.
2. **Motor de Ingesta V3.1 en Cloud Run Jobs (`SCRIPT ZIP TO BD NUBE/job_ingesta.py`)**:
   - En producción (según el Dossier Técnico V3.1, superando la nota antigua de `16Gi` del `.txt`), el Job `sips-ingesta-masiva` se despliega con **`--memory 32Gi --cpu 8 --task-timeout=28800`** sobre la imagen `sips-ingesta-v2:latest`.
   - Descarga el `.zip` de `gs://bucket-sips-aeden/archivos_crudos/` en los 32 GB de RAM y usa el *trick* `data_file.mode = "rb"` para inyectar los **124 GB** en BigQuery (`WRITE_TRUNCATE`) en **~39,5 minutos**.
   - **Mejora clave pendiente en `job_ingesta.py` (`clustering_fields=["cups"]`)**: Añadir `clustering_fields=["cups"]` al `bigquery.LoadJobConfig` de `datos_ps` y `datos_consumos`. Sin clustering, cada consulta sobre `datos_consumos` escanea 124 GB completos en BigQuery; con `clustering_fields=["cups"]`, BigQuery ordena físicamente los bloques por CUPS, escaneando **solo ~10 MB por consulta** (velocidad `< 300 ms` y **coste prácticamente 0 €/mes** dentro del primer TB gratuito mensual de BigQuery).
3. **API Online en Cloud Run (`SCRIPT API SIPS NUBE` vs Versión en Consola GCP)**:
   - El archivo local `SCRIPT API SIPS NUBE/main.py` quedó en una versión preliminar v1.1 (que solo hacía `SELECT * FROM datos_ps WHERE cups = @cups_param`), mientras que **en el editor online de Google Cloud Console** ya evolucionasteis el endpoint `https://api-sips-aeden-1090285260522.europe-southwest1.run.app/cups/{cups}` (protegido por `X-API-KEY`) para consultar con `WHERE STARTS_WITH(cups, SUBSTR(@cups_parametro, 1, 20))` y devolver ambas claves `{"ps": [...], "consumos": [...]}` con las **57 columnas crudas de PS** y las **24 columnas crudas de Consumos** de la CNMC.
4. **Prototipo Local Inicial (`sips_aeden.db` y `api_error_log.txt`)**:
   - Base SQLite inicial donde se modelaron las 36 columnas de `datos_ps` y 23 columnas de `datos_consumos` imitando los CSV de Ingebau (`*_ING.csv`), y un servidor Uvicorn local en puerto `8000` (`GET /Cups?cups=...&token=...`).

### 2.2. Qué Falta Exactamente para Conectar Nuestra API de Google Cloud al ERP con Compatibilidad 100% Ingebau

Dado que la API desplegada en Cloud Run (`api-sips-aeden`) devuelve actualmente las **columnas crudas de BigQuery/CNMC** (`57 columnas en datos_ps` y `24 columnas en datos_consumos`, en minúsculas y en Vatios `W`/`Wh`), tenemos dos opciones muy limpias (recomendando hacer el mapeo directamente en un **Traductor SIPS dentro de nuestro ERP `src/lib/sipsTranslator.ts`** o en el propio `main.py` de Cloud Run):
- Si hacemos la traducción en **`src/lib/sips.ts`** al recibir la respuesta de `https://api-sips-aeden-1090285260522.europe-southwest1.run.app/cups/{cups}` (o actualizamos `main.py` y sincronizamos la copia local de `Z:\`), convertimos al vuelo las 57 columnas de `ps` y las 24 de `consumos` de CNMC al **JSON exacto de Ingebau** y a los **CSVs exactos de Ingebau** sin ningún desplazamiento de columnas.

### 2.3. Por qué no cuadraban los CSV generados por `3_SIPS_TO_CSV.py`

### ⚠️ Diferencia 1: Desplazamiento de Columnas en `consumos.csv` (Renombrado por Posición en vez de por Nombre)
En el CSV bruto de la CNMC (`202604_SIPS2_CONSUMOS_ELECTRICIDAD_peninsular.csv`), el orden de las columnas es distinto al del CSV de Ingebau:
- En **CNMC**, la columna 3 es `codigoTarifaATR` (`"019"`), la columna 4 es `consumoEnergiaActivaEnWhP1`, las columnas 10–15 son **Reactiva (`VArh`)**, las columnas 16–21 son **Maxímetro (`W`)** y la última columna (índice 23) es `codigoTipoLectura` (`"30"` / `"60"`).
- En **Ingebau (`_consumos_ING.csv`)**, la columna 3 es `"Tipo Lectura"`, la columna 4 es `"Tarifa ATR"`, las columnas 5–10 son **Activa (`kWh`)**, las columnas 11–16 son **Maxímetro (`kW`)** y las columnas 17–22 son **Reactiva (`Varh`)**.
- **Qué pasaba en `3_SIPS_TO_CSV.py`**: Al sobrescribir los nombres de las cabeceras por posición (`df_consumos.columns = CABECERAS_CONSUMOS_ORIGINAL`) sin reordenar antes las columnas:
  - El código de tarifa `"019"` caía debajo de `"Tipo Lectura"`.
  - El consumo de **`P1` caía debajo de `"Tarifa ATR"`** y el de **`P2` caía debajo de `"Energia Activa P1 (kWh)"`** (desplazando todos los periodos un hueco a la izquierda).
  - La **Reactiva** caía debajo de las columnas de **Maxímetro**, y el **Maxímetro** caía debajo de las columnas de **Reactiva**.

### ⚠️ Diferencia 2: Orden de Columnas y Falta de Consumo Anual en `ps.csv`
- El CSV bruto de la CNMC (`SIPS2_PS_ELECTRICIDAD`) tiene **57 columnas** y **NO trae las 8 columnas de consumo anual** (`Consumo Anual kWh`, `Consumo Anual P1 kWh`..`P6 kWh`, `Consumo Anual Anterior`).
- Ingebau devuelve en su `_ps_ING.csv` **36 columnas específicas**, calculando esas 8 columnas de consumo anual a partir de la suma del último año de `SIPS2_CONSUMOS_ELECTRICIDAD`. Al renombrar por posición sin mapear por clave, en el script provisional los campos de `ps.csv` también quedaban desplazados.

### ⚠️ Diferencia 3: Unidades en Vatios (`W` / `Wh`) en la CNMC frente a Kilovatios (`kW` / `kWh`) en Ingebau
- La CNMC entrega en sus CSV todas las potencias (`potenciasContratadasEnWP1..P6`, `potenciaMaximaBIEW`, `valorDerechosExtensionW`, `potenciaDemandadaEnWP1..P6`) en **Vatios (`W`)** (ej. `5750`, `8000`) y todos los consumos de activa (`consumoEnergiaActivaEnWhP1..P6`) en **Vatios-hora (`Wh`)** (ej. `542000`).
- Ingebau y nuestro ERP (`/pricing`, `leadActions`, `ContractDetailClient`) trabajan estrictamente en **`kW`** y **`kWh`**, por lo que **es obligatorio dividir todos esos valores entre `1000`** (`5.75 kW`, `8 kW`, `542 kWh`).

### ⚠️ Diferencia 4: Códigos Numéricos CNMC (`"018"`, `"019"`, `"60"`) sin Traducir
- En los CSV de la CNMC la tarifa viene como `"018"` (en lugar de `"2.0TD"`), `"019"` (en lugar de `"3.0TD"`), `"020"` (en lugar de `"6.1TD"`), y el tipo de lectura como `"60"` (en lugar de `"Telegestión"` / `"REAL"`).
- Cuando se sube un CSV al Cotizador (`/pricing`), el parser lee la columna `Tarifa ATR` esperando encontrar `"2.0"`, `"3.0"`, `"6.1"`, etc. Si recibe `"018"` o `"019"`, no puede cambiar automáticamente el selector de tarifa del Cotizador.

---

## 3. Estructura Real de los 2 ZIP de la CNMC (`Z:\AED\SIPS\BD_AEDEN_SIPS`)

A continuación queda documentada la estructura exacta de ambos ficheros de la CNMC para que cualquier script o servicio del ERP los mapee por nombre de columna (nunca por posición ciega):

### 3.1. `202604_SIPS2_PS_ELECTRICIDAD_peninsular.zip` (`985 MB` $\rightarrow$ `8,68 GB` descomprimido)
Contiene un único archivo `202604_SIPS2_PS_ELECTRICIDAD_peninsular.csv` con **57 columnas** (en `1_ingesta_bigquery.py` se normalizan a minúsculas en la tabla `sips_nacional.datos_ps`):

1. `codigoempresadistribuidora` (Ej: `"0022"`, `"0031"`)
2. `cups` (22 caracteres, ej: `"ES0022000001000003SL1P"`)
3. `nombreempresadistribuidora` (Ej: `"UNION FENOSA DISTRIBUCION, S.A."`)
4. `codigopostalps` (Ej: `"15300"`)
5. `municipiops` (Código INE de 5 dígitos, ej: `"15009"`)
6. `codigoprovinciaps` (Código INE de 2 dígitos, ej: `"15"`)
7. `fechaaltasuministro` (`YYYY-MM-DD`)
8. `codigotarifaatrenvigor` (`"018"`=`2.0TD`, `"019"`=`3.0TD`, `"020"`=`6.1TD`, `"021"`=`6.2TD`, `"022"`=`6.3TD`, `"023"`=`6.4TD`, `"024"`=`3.0TDVE`, `"025"`=`6.1TDVE`)
9. `codigotensionv` (`"02"`=`1X230`, `"06"`=`3X400`, etc.)
10. `potenciamaximabiew` (En **Vatios `W`** $\rightarrow$ dividir `/ 1000` para `Potencia Max BIE (kW)`)
11. `potenciamaximaapmw` (En **Vatios `W`** $\rightarrow$ dividir `/ 1000`)
12. `codigoclasificacionps` (`"01"`..`"05"` $\rightarrow$ `"Tipo 1"`..`"Tipo 5"`)
13. `codigodisponibilidadicp` (`"0"` / `"1"`)
14. `tipoperfilconsumo` (`"P2.0TD"`, `"P3.0TD"`)
15. `valorderechosextensionw` (En **Vatios `W`** $\rightarrow$ dividir `/ 1000` para `valorDerechosExtensionkW`)
16. `valorderechosaccesow` (En **Vatios `W`** $\rightarrow$ dividir `/ 1000` para `valorDerechosAccesokW`)
17. `codigopropiedadequipomedida` (`"1"`=`Distribuidor`, `"2"`=`Cliente`)
18. `codigopropiedadicp` (`"1"`=`Distribuidor`, `"2"`=`Cliente`, `"4"`=`Otros`)
19. `potenciascontratadasenwp1` .. `potenciascontratadasenwp6` (Columnas 19 a 24, en **Vatios `W`** $\rightarrow$ dividir `/ 1000` para `Potencia Contratada P1..P6 kW`)
20. `fechaultimomovimientocontrato`, `fechaultimocambiocomercializador`, `fechalimitederechosreconocidos`, `fechaultimalectura` (Columnas 25 a 28, `YYYY-MM-DD`)
21. `informacionimpagos`, `importedepositogarantiaeuros`, `tipoidtitular`, `esviviendahabitual`, `codigocomercializadora` (Columnas 29 a 33)
22. `codigotelegestion` (`"01"`=`Telegestión operativa con curva de carga horaria`, `"02"`=`Telegestión operativa sin curva de carga horaria`, `"03"`=`Sin telegestión`)
23. `codigofasesequipomedida` (`"M"` / `"T"`), `codigoautoconsumo` (`"00"` $\rightarrow$ `"0"`), `codigotipocontrato`, `codigoperiodicidadfacturacion`, `codigobie`, `fechaemisionbie`, `fechacaducidadbie`, `codigoapm`, `fechaemisionapm`, `fechacaducidadapm`, `relaciontransformacionintensidad` (Columnas 35 a 45)
24. `cnae` (Columna 46), `codigomodocontrolpotencia` (Columna 47), `potenciacgpw` (Columna 48), `codigodhequipodemedida` (Columna 49), `codigoaccesibilidadcontador` (Columna 50), `codigopscontratable` (Columna 51), `motivoestadonocontratable` (Columna 52), `codigotensionmedida` (Columna 53), `codigoclaseexpediente` (Columna 54), `codigomotivoexpediente` (Columna 55), `codigotiposuministro` (Columna 56), `aplicacionbonosocial` (Columna 57).

### 3.2. `202604_SIPS2_CONSUMOS_ELECTRICIDAD_peninsular.zip` (`23,05 GB` $\rightarrow$ `124,23 GB` descomprimido)
Contiene un único archivo `202604_SIPS2_CONSUMOS_ELECTRICIDAD_peninsular.csv` con **24 columnas** (en `1_ingesta_bigquery.py` se normalizan a minúsculas en la tabla `sips_nacional.datos_consumos`):

1. `cups` (22 caracteres)
2. `fechainiciomesconsumo` (`YYYY-MM-DD` $\rightarrow$ `Lectura Desde` / `LecturaDesde`)
3. `fechafinmesconsumo` (`YYYY-MM-DD` $\rightarrow$ `Lectura Hasta` / `LecturaHasta`)
4. `codigotarifaatr` (`"018"` $\rightarrow$ `"2.0TD"`, `"019"` $\rightarrow$ `"3.0TD"`, etc. $\rightarrow$ `Tarifa ATR` / `TarifaATR`)
5. `consumoenergiaactivaenwhp1` .. `consumoenergiaactivaenwhp6` (Columnas 5 a 10, en **`Wh`** $\rightarrow$ **dividir `/ 1000`** $\rightarrow$ `Energia Activa P1 (kWh)`..`P6 (kWh)`)
6. `consumoenergiareactivaenvarhp1` .. `consumoenergiareactivaenvarhp6` (Columnas 11 a 16, en **`VArh`** $\rightarrow$ `Energía Reactiva P1 (Varh)`..`P6 (Varh)`)
7. `potenciademandadaenwp1` .. `potenciademandadaenwp6` (Columnas 17 a 22, en **`W`** $\rightarrow$ **dividir `/ 1000`** $\rightarrow$ `Maxímetro P1 (kW)`..`P6 (kW)`)
8. `codigodhequipodemedida` (Columna 23)
9. `codigotipolectura` (Columna 24: `"60"` $\rightarrow$ `"Telegestión"`, `"10"`/`"30"` $\rightarrow$ `"Real"`, `"20"`/`"40"` $\rightarrow$ `"Estimada"`).

---

## 4. Mapeo Exacto 1:1 para Exportación de CSVs en el Frontend SIPS (Compatibilidad Total con `/pricing`)

En el nuevo módulo visual **`/consulta-cups`** de nuestro ERP, añadiremos el botón **"📥 Descargar CSV SIPS (Formato Cotizador / Ingebau)"**, que generará en el navegador los dos archivos CSV con las **cabeceras, unidades y orden de columnas 100% idénticos a los de Ingebau** (`ES0031101457409001HM_consumos_ING.csv` y `ES0031101457409001HM_ps_ING.csv`):

### 4.1. Formato Exacto de `{CUPS}_consumos.csv` (23 Columnas — Compatible con `/pricing` $\rightarrow$ `SIPS CSV`)

Cabecera exacta (todos los valores entrecomillados con `"..."` y separados por coma `,`):
```csv
"CUPS","Lectura Desde","Lectura Hasta","Tipo Lectura","Tarifa ATR","Energia Activa P1 (kWh)","Energia Activa P2 (kWh)","Energia Activa P3 (kWh)","Energia Activa P4 (kWh)","Energia Activa P5 (kWh)","Energia Activa P6 (kWh)","Maxímetro P1 (kW)","Maxímetro P2 (kW)","Maxímetro P3 (kW)","Maxímetro P4 (kW)","Maxímetro P5 (kW)","Maxímetro P6 (kW)","Energía Reactiva P1 (Varh)","Energía Reactiva P2 (Varh)","Energía Reactiva P3 (Varh)","Energía Reactiva P4 (Varh)","Energía Reactiva P5 (Varh)","Energía Reactiva P6 (Varh)"
```
Ejemplo de fila generada:
```csv
"ES0031101457409001HM0F","2026-02-15","2026-03-15","Telegestión","2.0TD","123","114","115","0","0","0","3.38","0","3.924","0","0","0","0","0","0","0","0","0"
```
- **Por qué funciona al 100% con el Cotizador (`/pricing`)**:
  - `handleFileUpload` en `src/app/(app)/pricing/page.tsx` detecta `"Lectura Hasta"` (`2026-03-15`), filtra los últimos 365 días, detecta `"Tarifa ATR"` (`2.0TD`) seleccionando automáticamente la tarifa en el desplegable, y suma `"Energia Activa P1 (kWh)"` a `"Energia Activa P6 (kWh)"` ya convertidas a `kWh`.

### 4.2. Formato Exacto de `{CUPS}_ps.csv` (36 Columnas — Ficha Maestro Ingebau)

Cabecera exacta:
```csv
"Codigo Distribuidora","Nombre Distribuidora","CUPS","Código Postal PS","Municipio PS","Fecha Alta PS","Tarifa ATR","Tension","Potencia Max BIE (kW)","Tipo PM","Consumo Anual kWh","Consumo Anual P1 kWh","Consumo Anual P2 kWh","Consumo Anual P3 kWh","Consumo Anual P4 kWh","Consumo Anual P5 kWh","Consumo Anual P6 kWh","Consumo Anual Anterior","Potencia Contratada P1 kW","Potencia Contratada P2 kW","Potencia Contratada P3 kW","Potencia Contratada P4 kW","Potencia Contratada P5 kW","Potencia Contratada P6 kW","valorDerechosExtensionkW","valorDerechosAccesokW","Propietario EM","fechaUltimoMovimientoContrato","fechaUltimoCambioComercializador","fechaLimiteDerechosReconocidos","fechaUltimaLectura","codigoTelegestion","codigoAutoconsumo","CNAE","codigoModoControlPotencia","aplicacionBonoSocial"
```

---

## 5. Mapeo Exacto 1:1 en la API (`SCRIPT API SIPS NUBE/main.py`) para Devolver el JSON de Ingebau

Para que el servidor de Google Cloud Run (`https://api-sips-aeden-1090285260522.europe-southwest1.run.app/cups/{cups_id}`) devuelva exactamente el JSON que el ERP espera en `src/lib/sips.ts` y `src/app/api/sips/route.ts`:

1. **Consulta en BigQuery por prefijo de 20 caracteres (`cups20`)**:
   - Tanto en `sips_nacional.datos_ps` como en `sips_nacional.datos_consumos`, se busca por `STARTS_WITH(cups, SUBSTR(@cups_param, 1, 20))` (para que funcione tanto si el comercial escribe 20 caracteres `ES0031101457409001HM` como si escribe los 22 caracteres `ES0031101457409001HM0F`).
   - En `1_ingesta_bigquery.py` / `job_ingesta.py`, se añade `clustering_fields=["cups"]` al `LoadJobConfig` para que BigQuery indexe físicamente los bloques por CUPS y responda en milisegundos sin escanear los 124 GB.
2. **Construcción del JSON de Respuesta en `main.py`**:
   - Convierte `potenciascontratadasenwp1..p6`, `potenciamaximabiew`, `valorderechosextensionw`, `valorderechosaccesow` y `potenciademandadaenwp1..p6` de `W` a `kW` (`/ 1000`).
   - Convierte `consumoenergiaactivaenwhp1..p6` de `Wh` a `kWh` (`/ 1000`).
   - Suma los últimos 365 días de `datos_consumos` para rellenar `ConsumoAnualP1kWh..P6kWh` y `ConsumoAnualkWh` dentro de `data.ps[0]`.
   - Devuelve el objeto con doble compatibilidad (`result: "OK"`, campos raíz `tarifa, p1..p6, cp, poblacion, provincia, cnae, autoconsumo, consumo` y el bloque `data: { ps: [ps_mapped], consumos: consumos_mapped }`).

---

## 6. Diseño del Módulo Visual Frontend `"Consulta de CUPS"` en el ERP

Además de los botones de descarga CSV y conexión automática por API, el ERP incorporará en el menú lateral (`Sidebar.tsx`) la sección **"Consulta de CUPS"** (`/consulta-cups`):

1. **Buscador por CUPS (20 o 22 caracteres)** + **Texto Legal Obligatorio (Ley 24/2013 y RD 1435/2002)** con auditoría de accesos (`SipsAuditLog`).
2. **Vista de Resultados en 4 Pestañas (estilo UniEléctrica / Ingebau)**:
   - **`Datos generales`**: Todos los datos de `data.ps[0]` (`CUPS`, `Distribuidora`, `Población`, `Provincia`, `Tarifa`, `Potencia contratada P1..P6`, `Potencia máxima instalación (BIE)`, `Derechos de extensión/acceso`, `Tensión`, `Tipo de punto de medida`, `Última modificación de contrato`, `Último cambio de comercializadora`, `Última lectura`, `Alta de suministro`, `Propiedad ICP`, `Propiedad Contador`, `Trans./Rel. de Intensidad`, `Autoconsumo`, `CNAE` y `Bono Social`).
   - **`Lecturas de activa`**: Tabla superior de **Consumo anual estimado (`P1..P6` + Total kWh)** + Tabla inferior de **Últimas lecturas** (`Fecha`, `Tipo: REAL / ESTIMADO`, `Consumo P1..P6` en `kWh`).
   - **`Lecturas de reactiva`**: Tabla superior de **Consumo anual de reactiva** + Tabla inferior de **Últimas lecturas de reactiva** (`Fecha`, `Tipo`, `Consumo P1..P6` en `Varh`).
   - **`Lecturas de maxímetro`**: Tabla de **Últimas lecturas de maxímetro** (`Fecha`, `Tipo`, `Maxímetro P1..P6` en `kW`).
3. **Barra Superior de Acciones en 1 Clic**:
   - **`📥 Descargar CSV Consumos (para Cotizador)`**: Descarga `{CUPS}_consumos.csv` con las 23 columnas exactas de Ingebau listo para subir en `/pricing` $\rightarrow$ `SIPS CSV`.
   - **`📥 Descargar CSV Datos PS`**: Descarga `{CUPS}_ps.csv` con las 36 columnas exactas de Ingebau.
   - **`⚡ Cotizar Directamente en Pricing`**: Abre `/pricing` con el CUPS ya cargado sin necesidad siquiera de descargar y subir el CSV manualmente.
   - **`➕ Crear Lead / Contrato`**: Abre el modal de nuevo Lead autocompletado con los datos del SIPS.

---

## 7. Automatización Mensual 100% Cloud (Día 5 de cada mes — Sin Subidas Manuales desde `Z:\`)

Como evolución programada (registrada también en [`docs/ROADMAP.md`](./ROADMAP.md)), se unificará `0_descargador_masivo_cnmc.py` dentro del propio **Cloud Run Job (`sips-ingesta-masiva`)** en Google Cloud:
1. **Certificado en Google Secret Manager**: `certificado_aeden.pem` y las claves OAuth1 de la CNMC se guardarán cifrados en Google Secret Manager.
2. **Disparo Automático el Día 5 (`Cloud Scheduler`)**: El día 5 de cada mes (con reintento automático los días 6 y 7 si aún no hay fichero `DISPONIBLE` en la sede CNMC), el Cloud Run Job descargará directamente desde la API de la CNMC los `.zip` de `PS_ELECTRICIDAD` y `CONSUMOS_ELECTRICIDAD`, los respaldará en `gs://bucket-sips-aeden/archivos_crudos/` y los inyectará en BigQuery con `clustering_fields=["cups"]`, sin tener que abrir consola ni subir archivos desde `Z:\`.
