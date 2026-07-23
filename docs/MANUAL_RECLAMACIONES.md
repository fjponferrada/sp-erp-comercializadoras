# Manual de Reclamaciones R1 y Procesos Asociados

Esta guía documenta la arquitectura, reglas de negocio y soluciones técnicas implementadas en el módulo de Reclamaciones del ERP, centradas específicamente en el proceso de comunicación R1 con la distribuidora mediante el estándar XML de la CNMC.

## 1. Arquitectura de Datos y Visualización

### 1.1. Agrupación de Eventos (SwitchingEvents)
Las reclamaciones no son registros estáticos en la base de datos, sino **expedientes vivos** formados por múltiples comunicaciones (pasos) con la distribuidora. 
El sistema almacena cada XML enviado o recibido como un `SwitchingEvent`. El endpoint del backend (`getClaimsAction`) agrupa en tiempo real todos los eventos que comparten un mismo `codigoSolicitud` para ensamblar un objeto `ClaimSummary`. Este objeto consolida el estado del `Paso 01` (Apertura), `Paso 02` (Aceptación/Rechazo de Distribuidora), `Paso 03` y `Paso 05` (Cierre).

### 1.2. Filtrado en Memoria Post-Agrupación
Debido a la naturaleza de la agrupación anterior, **nunca se debe filtrar directamente en la consulta SQL de Prisma** al buscar por CUPS o Código de Solicitud/Reclamación. 
Si el filtro se aplicara en SQL, corremos el riesgo de excluir "eventos hermanos". Por ejemplo, si buscamos un código que solo está presente en el XML del Paso 01, Prisma no devolvería el evento del Paso 02, corrompiendo la visualización del expediente en el frontend.
**Solución implementada:** Prisma devuelve todos los eventos R1, se ensamblan los expedientes (`claimsMap`) y **el filtrado (`searchTerm`) se aplica en memoria** sobre el array resultante antes de realizar la paginación (`slice`).

## 2. Generación del XML (Estándar CNMC)

### 2.1. Selección del Titular Legítimo (Heurística de Contrato Activo)
Para generar una reclamación R1 se necesita asociar el CUPS al titular correcto. Un mismo CUPS puede tener un historial de múltiples `SupplyPoints` (diferentes inquilinos a lo largo de los años).
El sistema **jamás usa un `findFirst` simple**. La heurística estricta es:
1. Buscar todos los `SupplyPoints` de ese CUPS.
2. Extraer aquel que tenga un contrato en estado `ACTIVO`.
3. Si ninguno está activo, seleccionar el que tenga la fecha de finalización (`terminationDate`) más reciente.
Esto garantiza que la reclamación se abra a nombre del titular real con legitimidad vigente o más reciente.

### 2.2. Ordenación XSD Estricta en VariableDetalleReclamacion
El validador XSD de la distribuidora exige un orden secuencial/alfabético inquebrantable para los elementos del nodo `<VariableDetalleReclamacion>`.
*   El bloque `<Contacto>` **tiene que ser inyectado en primer lugar**, antes de cualquier variable dinámica (`<FechaDesde>`, `<ImporteReclamado>`, etc.).
*   Si `<Contacto>` se inyecta al final, la distribuidora rechazará el XML con un error: *"Se ha encontrado contenido no válido a partir del elemento '{Contacto}'. Se esperaba uno de '{ImporteReclamado, UbicacionIncidencia}'"*.

### 2.3. Escapado de Caracteres Especiales XML (EntityRefs)
El texto inyectado en el XML (Razón Social, Comentarios, Dirección, etc.) extraído de la base de datos puede contener caracteres especiales.
*   El carácter `&` es especialmente crítico, ya que inicia una referencia de entidad en XML (ej. `&amp;`).
*   Si una empresa se llama `"CONFIA & ESPERA S.L."` y no se escapa, el validador intentará parsear `& ESPERA`, provocando un error fatal: `xmlParseEntityRef: no name`.
**Solución implementada:** Todos los campos de texto inyectados pasan por una función unificada (`removeAccentsAndEscape` o `escapeXml`) que convierte `<`, `>`, `&`, `'` y `"` a sus entidades HTML seguras (`&lt;`, `&gt;`, `&amp;`, `&apos;`, `&quot;`).

## 3. Experiencia de Usuario (Frontend)

### 3.1. Plantillas Predefinidas por Motivo y Submotivo
Para evitar que la distribuidora rechace las reclamaciones por "falta de literalidad" o ambigüedad en la petición, el Frontend asiste al usuario inyectando plantillas legales.
Cuando el usuario selecciona un motivo y submotivo específicos en el modal de generación, el sistema rellena automáticamente el campo de texto de `Comentarios` con una frase oficial (que el usuario puede modificar posteriormente si lo desea).
*   **Ejemplo Implementado:** Para **Motivo 05** (Calidad de Suministro) y **Submotivo 039**, se inyecta automáticamente: *"Solicitud informe / certificado sobre incidencias por averías técnicas en las redes de distribución eléctrica en el periodo indicado en la solicitud"*.

---
*Este documento consolida el conocimiento técnico y de negocio referente al módulo de Reclamaciones R1. Cualquier actualización en los flujos de comunicación con la distribuidora debe verse reflejada aquí.*
