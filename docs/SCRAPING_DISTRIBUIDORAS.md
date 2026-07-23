# Guía de Sincronización y Scraping de Distribuidoras (CCH)

Esta guía documenta la arquitectura, reglas de negocio y peculiaridades técnicas asociadas a la ingesta, parseo y sincronización de las Curvas de Carga Horarias (CCH) desde los servidores de las distribuidoras eléctricas españolas (e-distribución, i-DE, UFD, CIDE, etc.) hacia el ERP.

## 1. Arquitectura de Conexión

El módulo encargado de conectarse a las distribuidoras vive en `src/app/api/cron/ftp-sync`. 

- **Protocolos Soportados:** El sistema se adapta automáticamente a FTP estándar (puerto 21) y SFTP (puertos 22, 11022, 6222).
- **Procesamiento por Tramos (Chunking):** Debido a los límites de tiempo de ejecución en Vercel (Timeouts de 10s o 60s), el job no procesa todos los archivos de golpe. Procesa lotes pequeños y envía una señal al frontend (o al propio Vercel Cron) con la bandera `hasMore: true` para indicar que el bucle debe volver a llamarlo inmediatamente.
- **Seguimiento (Cursor):** Cada distribuidora tiene guardada la fecha de su última sincronización (`ftpLastSyncAt`). En cada iteración, el sistema explora los directorios recursivamente y solo extrae archivos cuya fecha de modificación sea superior a este cursor.

## 2. Archivos y Mapeo de Prioridades

Las distribuidoras nombran sus ficheros siguiendo nomenclaturas estándar, que indican si la medida es diaria, mensual, provisional o de facturación (definitiva).
El analizador `cchParser.ts` aplica el siguiente `PRIORIDAD_MAP` para decidir qué fichero tiene supremacía sobre la base de datos:

- **Prioridad 100 (Facturación / Definitivos):** F1, C1, Q1, F1H, F1QH
- **Prioridad 90:** F5D
- **Prioridad 80:** A5D, B5D
- **Prioridad 40:** P5D
- **Prioridad 20 (Provisionales diarios):** P1, P1D, P2, P2D
- **Prioridad 10:** P0

**Reglas de Sobrescritura:**
1. Si llega una curva *definitiva* y en base de datos había una *provisional*, se sobrescribe de inmediato.
2. Si llega una curva *provisional* y en base de datos ya había una *definitiva*, el nuevo archivo es ignorado (`skipped`).
3. Si ambas tienen el mismo nivel de provisionalidad, prevalece el archivo cuya prioridad calculada sea superior (comparando el sufijo del nombre del fichero origen).
4. Existen curvas protegidas como `MIGRACION_PKL` (provenientes del antiguo sistema Python V22) que no pueden ser sobrescritas por procesos automatizados de menor prioridad.

## 3. Peculiaridades de Datos y Parseo

Existen varios "edge cases" y trampas informáticas comunes enviadas por las distribuidoras que el parser aborda y neutraliza automáticamente:

### A. Basura Informática y Seguridad (El Error 0x00)
Algunas distribuidoras (especialmente UFD) envían archivos corruptos o mal generados que incluyen internamente caracteres nulos (`\u0000` o `0x00`).
PostgreSQL, por seguridad, prohíbe terminantemente guardar "null bytes" en campos de tipo texto, provocando un error fatal que abortaba la sincronización. 
**Solución:** Antes de pasar el fichero por el analizador CSV (`PapaParse`), el contenido pasa por una función de sanitización global (`csvContent.replace(/\0/g, '')`) que extirpa cualquier byte nulo del texto.

### B. Confusión de Fechas (Formato US vs Formato EU)
Las distribuidoras en España envían fechas en formato `DD/MM/YYYY`. 
Javascript por defecto intentará interpretar fechas como el 07/05/2026 como "5 de Julio" (Formato Americano) si no se formatea explícitamente. 
**Solución:** El parser trocea las fechas de los CSV detectando `/` y `-`, y las reconstruye en formato ISO forzado (`YYYY-MM-DD`) antes de convertirlas a un objeto `Date`.

### C. Zonas Horarias y Horarios de Verano
La información horaria que remite la distribuidora marca el **final** del periodo en Tiempo Local español, no en UTC ni en el inicio del periodo. 
**Solución (Basado en la lógica V22 del antiguo algoritmo de Python):** Se extrae 1 hora a cada registro de lectura (`dateObj.setHours(dateObj.getHours() - 1)`) antes de trazarlo sobre el array de 96 cuartos de hora (`readings`).

### D. Identificación de Tramos (Cuartohoraria vs Horaria)
El sistema deduce la resolución de la curva escaneando el array:
- Si existen valores en los cuartos `1, 2 o 3` de cada hora, se considera `QUARTER_HOURLY`.
- Si todos los datos caen en el índice `0` (en punto), el array es comprimido a 24 huecos y se marca como `HOURLY`.

## 4. Límites Físicos (Umbrales de Consumo)

Para descartar ficheros aberrantes (picos de 9 millones de kWh por error de contador de la distribuidora), el sistema aplica umbrales de seguridad durante la ingesta:
1. **Clientes VIP / Grandes Consumidores:** Límite máximo de `2000 kWh` por hora/cuarto.
2. **Resto (PyME y Hogar):** Límite máximo de `300 kWh` por hora/cuarto.
3. Si se excede el umbral, el sistema intuye que el dato de la distribuidora llegó en `Wh` en lugar de `kWh` e intenta dividirlo automáticamente entre 1000. Si tras la división el dato sigue siendo aberrante, la lectura se descarta o estanca el proceso.

## 5. Compresión y Empaquetado
A menudo, las distribuidoras (por ejemplo EDISTRIBUCIÓN) agrupan cientos de curvas en ficheros `ZIP` o `BZ2`. El sistema carga estos archivos comprimidos de forma íntegra a RAM, extrae y descomprime al vuelo solo los ficheros que cumplen el `PRIORIDAD_MAP` en memoria `buffer`, sin tener que escribir copias temporales en el disco duro del servidor web, reduciendo dramáticamente el consumo de IOPS y disco en Vercel.

---

*Documento técnico de arquitectura. Toda modificación de parsers o motores FTP dentro del proyecto deberá respetar obligatoriamente las leyes expuestas en este archivo.*
