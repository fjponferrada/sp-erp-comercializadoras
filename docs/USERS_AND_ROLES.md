# 👥 Guía de Usuarios, Roles y Seguridad Multi-Marca

Este documento detalla exhaustivamente el modelo de permisos, tipos de usuario y reglas de acceso del CRM (ERP Comercializadoras), fundamentado en las reglas de negocio principales y en la arquitectura de autenticación de `NextAuth`.

---

## 1. Arquitectura de Seguridad (Aislamiento por Marcas)

El sistema opera bajo un modelo de arquitectura **SaaS Multi-Tenant** estricto, donde el aislamiento de los datos se realiza a nivel de **Marca** (`brandId`).

- **Unicidad Relativa**: Los identificadores comunes como el NIF/DNI (`vatNumber`) o el CUPS **no son globales**. Un mismo DNI puede existir múltiples veces en la base de datos siempre que pertenezca a marcas diferentes.
- **Acceso por Marcas Asignadas (`assignedBrands`)**: Aunque a nivel de base de datos de Prisma todo usuario tiene obligatoriamente una marca primaria (`brandId`), el acceso real de un empleado al sistema está dictado **exclusivamente por el array de sus Marcas Asignadas (`assignedBrands`)**.
- **Comprobación de Acceso (Login)**: Si a un agente comercial o canal se le desmarcan todas las marcas autorizadas en su ficha (su `assignedBrands` queda vacío), el sistema de autenticación (`src/auth.ts`) bloqueará el inicio de sesión arrojando un error interno de "Acceso denegado", el cual se refleja como "Credenciales incorrectas" en el Front-End.

---

## 2. Tipos de Roles y sus Privilegios

La plataforma clasifica a los usuarios mediante el campo `role`, estructurando los permisos de arriba hacia abajo:

### 👑 SUPERADMIN
- **Privilegios**: Acceso total, absoluto e irrestricto.
- **Marcas permitidas**: Automáticamente tiene acceso a **TODAS** las marcas del sistema sin necesidad de asignación explícita.
- **Secciones exclusivas**: Es el único rol que puede ver la sección de Configuración "Usuarios", permitiéndole dar de alta nuevos usuarios y asignarles roles o marcas.
- **Usuario raíz**: `fjponferrada@sp-energia.com` actúa como el Superadmin global del proyecto.

### 🏢 COMPANYADMIN (Responsable de Comercializadora)
- **Privilegios**: Gestión integral de una o más comercializadoras (`Company`).
- **Marcas permitidas**: Tiene acceso a todas las marcas que cuelguen de sus empresas asignadas (`user.companies`), además de las marcas que se le hayan asignado explícitamente en `assignedBrands`.

### 💼 BACKOFFICE (Responsable de Marca / Backoffice)
- **Privilegios**: Perfil de gestión, auditoría y tramitación de expedientes.
- **Marcas permitidas**: Solo puede visualizar y operar dentro de las marcas a las que está explícitamente asociado en `assignedBrands`.

### 🤝 CANAL (Distribuidor Externo)
- **Privilegios**: Los canales actúan como entidades agrupadoras de comerciales. Pueden visualizar las ventas y el catálogo de su red.
- **Catálogo de Productos**: Un canal sólo tiene permiso para vender los productos que se le hayan habilitado en su matriz de relaciones (Tabla `PRODUCTOS` por canal).
- **Aislamiento de Canal**: Los canales están aislados y pertenecen a una única marca (`brandId`). El backend siempre filtra las consultas por la marca activa del usuario para garantizar que no haya cruce de canales entre comercializadoras competidoras.

### 👔 COMERCIAL (Fuerza de Ventas)
- **Privilegios restringidos**: El comercial tiene un perfil fuertemente acotado para evitar alteraciones de negocio.
- **Acceso a Secciones**: Leads, Contratos, Clientes, Facturas, Renovaciones, Bajas y Productos.
- **Prohibición de Edición**: Los comerciales **NO tienen permiso para editar NINGÚN registro existente** (ni facturas, ni contratos firmados).
- **Operativa**: Solo pueden operar dando de alta nuevos "Leads" mediante dos flujos (ver Flujos de Alta).
- **Asignación de Ventas**: Para saber qué comercial vendió un contrato, se vincula relacionalmente (`lead.userId = user.id`) basándose en el email del usuario.

### 👤 CLIENT (Cliente Final)
- **Privilegios**: Solo puede acceder al "Portal de Clientes" (Área Privada).
- **Acceso a Secciones**: Consulta de sus propios Contratos, Facturas y datos personales.
- **Manejo de Seguridad (Resolución de Incidencias)**: A diferencia de los perfiles internos de la comercializadora, el cliente final generalmente **no utiliza el array `assignedBrands`**. Su acceso al sistema se valida contra la marca directa a la que pertenece como cliente (`user.brandId`). En la capa de autenticación, el sistema hace un "fallback" a su `brand` primaria para permitirle el acceso sin lanzar errores de "Credenciales incorrectas".

---

## 3. Flujos Operativos y Vistas Asociadas

La página central para la gestión del personal y la red comercial en el ERP es:
- **Página de Operación Real (`/usuarios`)**: Esta es la "Base de Usuarios". Contiene la tabla interactiva (`UsersClient.tsx` y `UserModal.tsx`) para listar altas, modificar roles, asociar a canales y cambiar contraseñas. *(Nota: La antigua página `/ajustes/usuarios` fue eliminada del sistema por ser un remanente visual obsoleto).*

### Diferencia en Flujos de Alta para Ventas (Comerciales)
Cuando un Comercial o Canal accede al sistema, el alta de ventas se gestiona mediante dos flujos de Modal diferenciados en la página de **Leads**:

1. **Flujo "Crear Oferta" (Estudio Comercial)**: 
   - Proceso ágil y de baja fricción para el comercial.
   - Pide información mínima de contacto y permite anexar documentación base (DNI/Factura) para generar la oferta, **sin requerir firmas, IBAN ni validaciones complejas**.
2. **Flujo "Alta Luz" (Contrato directo)**: 
   - Proceso estricto. Obliga a introducir el NIF, Domicilios, IBAN y subir toda la documentación obligatoria.
   - Requiere validación y firma, pasando posteriormente por el motor de plantillas de contratos (B2B vs CORE).

---

## 4. Recordatorios Históricos (Importación desde Airtable)

Al tratar con datos heredados o importados:
- Se purga la tabla de `User` (respetando los administradores críticos) y se importa de Airtable filtrando solo a los que tienen `CANALES LINK`.
- Si el checkbox de Airtable "Supervisor canal" estaba a `true`, el script le inyecta el rol `COMPANYADMIN` o `CANAL`. De lo contrario, se le asigna el rol base de `COMERCIAL`.
- **Usuarios de Migración**: Para evitar huérfanos, los datos que carezcan de un usuario original claro se asignan al Superadmin global `fjponferrada@sp-energia.com`.
