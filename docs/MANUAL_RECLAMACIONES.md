# Manual de Reclamaciones R1 y Procesos Asociados

Esta guía documenta la arquitectura, reglas de negocio y soluciones técnicas implementadas en el módulo de Reclamaciones del ERP, centradas específicamente en el proceso de comunicación R1 con la distribuidora mediante el estándar XML de la CNMC.

## 1. Arquitectura de Datos y Visualización

### 1.1. Agrupación de Eventos (SwitchingEvents)
Las reclamaciones no son registros estáticos en la base de datos, sino **expedientes vivos** formados por múltiples comunicaciones (pasos) con la distribuidora. 
El sistema almacena cada XML enviado o recibido como un `SwitchingEvent`. El endpoint del backend (`getClaimsAction`) agrupa en tiempo real todos los eventos que comparten un mismo `codigoSolicitud` para ensamblar un objeto `ClaimSummary`. Este objeto consolida el estado del `Paso 01` (Apertura), `Paso 02` (Aceptación/Rechazo de Distribuidora), `Paso 03` y `Paso 05` (Cierre).

### 1.2. Filtrado en Memoria Post-Agrupación
Debido a la naturaleza de la agrupación anterior, **nunca se debe filtrar directamente en la consulta SQL de Prisma** al buscar por CUPS, Titular o Código de Solicitud/Reclamación. 
Si el filtro se aplicara en SQL, corremos el riesgo de excluir "eventos hermanos". Por ejemplo, si buscamos un código que solo está presente en el XML del Paso 01, Prisma no devolvería el evento del Paso 02, corrompiendo la visualización del expediente en el frontend.
**Solución implementada:** Prisma devuelve todos los eventos R1, se ensamblan los expedientes (`claimsMap`) y **el filtrado (`searchTerm`) se aplica en memoria** sobre el array resultante antes de realizar la paginación (`slice`).

## 2. Generación del XML (Estándar CNMC)

### 2.1. Selección del Titular Legítimo (Heurística de Contrato Activo)
Para generar una reclamación R1 se necesita asociar el CUPS al titular correcto. Un mismo CUPS puede tener un historial de múltiples `SupplyPoints` (diferentes inquilinos a lo largo de los años).
El sistema **jamás usa un `findFirst` simple**. La heurística estricta es:
1. Buscar todos los `SupplyPoints` de ese CUPS.
2. Extraer aquel que tenga un contrato en estado `ACTIVO` (y tomar el cliente de dicho contrato activo).
3. Si ninguno está activo, seleccionar el que tenga la fecha de finalización (`terminationDate`) más reciente.
Esto garantiza que la reclamación se abra a nombre del titular real con legitimidad vigente o más reciente.

### 2.2. Ordenación XSD Estricta en VariableDetalleReclamacion
El validador XSD de la distribuidora exige un orden secuencial inquebrantable (`xs:sequence` en `ReclamacionPeticion.xsd`) para los elementos hijos de `<VariableDetalleReclamacion>`:
1. `NumExpedienteAcometida`
2. `NumExpedienteFraude`
3. `FechaIncidente`
4. `NumFacturaATR`
5. `TipoConceptoFacturado` (Tabla 77)
6. `FechaLectura`
7. `TipoDHEdM` (Tabla 35)
8. `CAU`
9. `LecturasAportadas`
10. `DisconformidadAutoconsumo` (Tabla 139)
11. `CodigoIncidencia` (Tabla 86)
12. `CodigoSolicitud`
13. `ParametroContratacion` (Tabla 79)
14. `ConceptoDisconformidad`
15. `TipoDeAtencionIncorrecta` (Tabla 87)
16. `MotivoConsulta` (Tabla 140)
17. `IBAN`
18. `Contacto`
19. `CodigoSolicitudReclamacion`
20. `FechaDesde`
21. `FechaHasta`
22. `ImporteReclamado`
23. `UbicacionIncidencia`

*   **Nota importante:** Elementos como `<NumFacturaATR>`, `<FechaLectura>` y `<LecturasAportadas>` **van siempre antes de `<Contacto>`**, mientras que `<CodigoSolicitudReclamacion>`, `<FechaDesde>`, `<FechaHasta>`, `<ImporteReclamado>` y `<UbicacionIncidencia>` **van después de `<Contacto>`**. El generador utiliza el array `XSD_ORDER` en `reclamacionesActions.ts` para garantizar siempre esta secuencia.

### 2.3. Escapado de Caracteres Especiales XML y Normalización de Campos
El texto inyectado en el XML (Razón Social, Comentarios, Dirección, etc.) extraído de la base de datos puede contener caracteres especiales o formatos que violan las facetas XSD:
*   **Entidades XML:** Todos los campos de texto pasan por `removeAccentsAndEscape` o `escapeXml` que convierte `<`, `>`, `&`, `'` y `"` a `&lt;`, `&gt;`, `&amp;`, `&apos;` y `&quot;`.
*   **Código Postal (`CodPostal`):** Se rellena siempre con ceros a la izquierda hasta 5 dígitos (`.padStart(5, '0')`) para cumplir la faceta `minLength="5"`.
*   **NIF / NIE vs CIF (`TipoPersona`):** Solo se marcan como Persona Jurídica (`J`) los identificadores cuyo primer carácter corresponde a una letra de CIF societario (`/^[ABCDEFGHJNPQRSUVW]/i`), evitando que los NIE (`X`, `Y`, `Z`) se clasifiquen erróneamente como empresas.

## 3. Experiencia de Usuario (Frontend)

### 3.1. Plantillas Predefinidas por Motivo y Submotivo
Para evitar que la distribuidora rechace las reclamaciones por "falta de literalidad" o ambigüedad en la petición, el Frontend asiste al usuario inyectando plantillas legales.
Cuando el usuario selecciona un motivo y submotivo específicos en el generador, el sistema rellena automáticamente el campo de texto de `Comentarios` con una frase oficial (que el usuario puede modificar posteriormente si lo desea).
*   **Ejemplo Implementado:** Para **Motivo 05** (Calidad de Suministro) y **Submotivo 039**, se inyecta automáticamente: *"Solicitud informe / certificado sobre incidencias por averías técnicas en las redes de distribución eléctrica en el periodo indicado en la solicitud"*.

---
*Este documento consolida el conocimiento técnico y de negocio referente al módulo de Reclamaciones R1. Cualquier actualización en los flujos de comunicación con la distribuidora debe verse reflejada aquí.*
