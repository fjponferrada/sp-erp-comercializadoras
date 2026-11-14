# 👥 Guía Técnica y Funcional de Usuarios, Roles y Seguridad Multi-Marca

Este documento constituye el manual de referencia sobre el modelo de autenticación, control de accesos basado en roles (RBAC), aislamiento multi-comercializadora/multi-marca y operativa de la sección **Usuarios y Accesos (`/usuarios`)** del ERP Comercializadoras, alineado con `docs/BUSINESS_RULES_UTF8.md` (Reglas 23–37 y 225–228).

---

## 1. Arquitectura de Seguridad y Validación en Vivo

El ERP opera como una plataforma **SaaS Multi-Tenant** jerárquica basada en **Comercializadora (`Company`) → Marca (`Brand`) → Canal (`Channel`)**.

### 1.1 Unicidad y Normalización de Credenciales
- **Identificadores de negocio relativos a la marca**: El NIF/CIF (`vatNumber`), el CUPS (`cups`) o el número de factura **no son globales**; pueden coexistir en distintas marcas sin colisión (Regla 32).
- **Correo de acceso único y *case-insensitive***: `User.email` es el identificador único de login en todo el ERP. En todas las rutas de creación, edición, registro de portal y recuperación (`src/auth.ts`, `src/app/actions/authActions.ts`, `src/app/api/users/route.ts`, `src/app/api/users/[id]/route.ts`), el correo se normaliza siempre con `.trim().toLowerCase()` y se consulta en modo *case-insensitive*.
- **Higiene de contraseñas**: Toda contraseña aplica `.trim()` y exige un **mínimo de 8 caracteres** antes de hashearse con `bcrypt` (10 rondas), garantizando simetría exacta con el `.trim()` del formulario de inicio de sesión (`src/app/(auth)/login/page.tsx`).
- **Privacidad estricta de hashes**: Todas las lecturas SSR (`src/app/(app)/usuarios/page.tsx`) y mutaciones REST (`/api/users`, `/api/users/[id]`) utilizan `omit: { password: true }` en Prisma para que ningún hash `bcrypt` viaje jamás al navegador.

### 1.2 Estado de Cuenta (`User.isActive`) y Bloqueo en Caliente
Todo registro `User` cuenta con el interruptor booleano **`isActive`** (`@default(true)` en `prisma/schema.prisma`):
1. **Login (`src/auth.ts`)**: Si `user.isActive === false`, el proveedor `Credentials` deniega inmediatamente la autenticación.
2. **Recuperación de contraseña (`src/app/actions/authActions.ts`)**: `requestPasswordReset` ignora silenciosamente cuentas con `isActive === false` para impedir reactivaciones no autorizadas sin revelar la existencia del correo.
3. **Filtros de Visibilidad en Vivo (`src/lib/permissions.ts`)**: `resolvePermissionContext()` consulta el usuario real en base de datos en cada request (optimizado mediante `React.cache()` por petición, Regla 33). Si el usuario fue desactivado o perdió sus marcas autorizadas después de iniciar sesión, todos los filtros (`getUserVisibilityFilter`, `getLeadVisibilityFilter`, `getClientVisibilityFilter`, `getInvoiceVisibilityFilter`, `getChannelVisibilityFilter`, `getSupplyPointVisibilityFilter`) bloquean el retorno de datos en el acto.
4. **Intercepción en Layout sin Bucle con Edge Proxy (`src/app/(app)/layout.tsx` + `src/components/BlockedSessionScreen.tsx`)**:
   - El middleware Edge (`src/proxy.ts`) redirige automáticamente a `/` a cualquier navegador con cookie JWT válida que visite `/login` (y no puede consultar Prisma por ejecutarse en Edge Runtime).
   - Por ello, cuando `src/app/(app)/layout.tsx` detecta en BD que el usuario de la sesión activa tiene `isActive === false` (o carece de marcas autorizadas), **no redirige a `/login`**, sino que renderiza `<BlockedSessionScreen />`, cerrando limpiamente la sesión JWT mediante `signOut({ callbackUrl: '/login' })`.

### 1.3 Protecciones contra Escalada y Auto-Bloqueo
- **Superadmin Raíz Protegido**: La cuenta maestra `fjponferrada@sp-energia.com` (`ROOT_SUPERADMIN_EMAIL`) está blindada en UI y API contra desactivación (`isActive = false`), cambio de rol o modificación de correo electrónico (Reglas 23 y 225).
- **Protección Anti *Self-Lockout***: Ningún administrador (`SUPERADMIN` o `COMPANYADMIN`) puede desactivar su propia cuenta ni rebajar/alterar su propio rol desde `/usuarios` ni `/api/users/[id]`.

---

## 2. Matriz Resumen de Roles y Permisos

| Rol | Alcance de Datos | `<BrandSelector>` | Acceso a `/usuarios` | Acceso a `/productos` | Grupos `Sidebar.tsx` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SUPERADMIN`** | Global (todas las empresas y marcas) | Todas las marcas | **Global** (incluye ver/crear `SUPERADMIN`) | Lectura y escritura completa | Todos los módulos ERP |
| **`COMPANYADMIN`** | Sus `companies` (todas sus marcas hijas) + `assignedBrands` | Sus marcas autorizadas | **Acotado a sus comercializadoras** (prohibido ver/crear `SUPERADMIN`) | Lectura y escritura en sus marcas | Todos los módulos ERP de sus marcas |
| **`BACKOFFICE`** | Exclusivamente sus `assignedBrands` | Sus marcas autorizadas | Sin acceso | Lectura y escritura en su marca activa | Módulos operativos y Configuración (sin `/usuarios` ni `/comisiones-config`) |
| **`CANAL`** | Su cartera + comerciales de su `channelId` en su marca | Marca de su canal / `assignedBrands` | Sin acceso | **Solo lectura** (catálogo habilitado a su canal, sin comisiones internas) | `CRM Ventas` (incl. `Productos`) |
| **`COMERCIAL`** | Exclusivamente sus propios registros (`userId`) | Sus `assignedBrands` | Sin acceso | **Solo lectura** (catálogo publicado de su marca, sin comisiones internas) | `CRM Ventas` (incl. `Productos`) |
| **`CLIENT`** | Sus contratos/facturas/CUPS por `brandId` + email | Fijo a su `user.brandId` | Sin acceso | Sin acceso | `Área de Cliente` |

---

## 3. Detalle Funcional por Rol

### 👑 SUPERADMIN
- **Privilegios**: Control total e irrestricto sobre todas las comercializadoras, marcas, configuraciones regulatorias, facturación, compras y usuarios.
- **Marcas permitidas**: Acceso implícito a todas las marcas existentes o futuras sin requerir entradas manuales en `assignedBrands` ni `companies`.
- **Gestión de Usuarios**: Único perfil capaz de visualizar cuentas `SUPERADMIN`, dar de alta nuevos `SUPERADMIN` o auditar usuarios de cualquier comercializadora.

### 🏢 COMPANYADMIN (Responsable de Comercializadora)
- **Privilegios**: Dirección integral de una o varias comercializadoras (`user.companies`).
- **Resolución de Marcas**: Une automáticamente todas las marcas hijas de sus comercializadoras (`Brand.companyId IN user.companies`) con cualquier marca asignada en `assignedBrands`. Si selecciona una marca específica en `<BrandSelector>` (cookie `active-brand`), los listados operativos filtran por esa marca concreta; en caso contrario, abarcan todas sus marcas autorizadas.
- **Gestión Acotada en `/usuarios` (`src/lib/userManagementScope.ts`)**:
  - Visualiza únicamente los usuarios vinculados a sus comercializadoras o marcas autorizadas (`brandId`, `assignedBrands` o `companies`), excluyendo de raíz cualquier usuario `SUPERADMIN`.
  - Los selectores del listado y de `UserModal.tsx` cargan exclusivamente sus comercializadoras, sus marcas y los canales de sus marcas.
  - **Prohibición de escalada**: Ni el modal ofrece la opción `SUPERADMIN` ni los endpoints `POST /api/users` y `PUT /api/users/[id]` permiten crear o promocionar a `SUPERADMIN` (responden `403`).
  - **Preservación en usuarios compartidos**: Si un usuario (ej. un comercial externo multicartera) pertenece simultáneamente a una marca del `COMPANYADMIN` y a otra comercializadora ajena, `usuarios/page.tsx` oculta las relaciones externas y `PUT /api/users/[id]` preserva intactas las empresas, marcas y canales externos fuera del alcance del `COMPANYADMIN`.

### 💼 BACKOFFICE (Responsable de Marca / Operaciones)
- **Privilegios**: Tramitación de expedientes, contratación, switching CNMC, facturación interna/externa, impuestos, compras, liquidaciones e importadores dentro de sus marcas asignadas.
- **Gobierno por `assignedBrands`**: Su acceso depende estrictamente de tener al menos una marca en `assignedBrands` (Regla 27). No tiene acceso a `/usuarios` ni a la configuración de parrillas de comisiones `/comisiones-config` (reservada exclusivamente a `SUPERADMIN` y `COMPANYADMIN`, Regla 248).

### 🤝 CANAL (Jefe de Canal / Distribuidor Externo)
- **Privilegios**: Supervisión comercial de su red (`channelId`). Visualiza sus propias operaciones y todas las de los agentes adscritos a su mismo `channelId` dentro de la marca del canal (`Channel.brandId`, Regla 37).
- **Catálogo de Productos en Solo Lectura**: Accede a **CRM Ventas → Productos** (`/productos`) visualizando únicamente los productos publicados habilitados en la matriz relacional de su canal (Regla 25), con las acciones de crear/editar/borrar deshabilitadas tanto en UI (`ProductosClient.tsx`, `ProductModal.tsx`) como en API (`/api/products*`) y sin exponer márgenes ni tablas de comisiones internas.

### 👔 COMERCIAL (Fuerza de Ventas)
- **Privilegios acotados**: Visibilidad limitada estrictamente a sus propios Leads, Contratos, Clientes, Facturas, Renovaciones y Bajas (`userId = user.id`).
- **Prohibición estricta de edición**: No puede modificar ni eliminar contratos, clientes, facturas ni productos existentes; su operativa de escritura se circunscribe al alta de nuevas oportunidades/contratos en `/leads` (**Crear Oferta** y **Alta Luz**).
- **Catálogo de Productos en Solo Lectura**: Consulta en `/productos` las tarifas activas de su marca sin permisos de edición ni acceso a comisiones internas.

### 👤 CLIENT (Cliente Final — Portal Área Privada)
- **Navegación dedicada**: En `Sidebar.tsx` dispone únicamente del bloque **Área de Cliente** (*Mis Contratos*, *Mis Facturas*, *Mis Suministros*, *Mis Datos* y *Mis Incidencias*).
- **Doble cerrojo Multi-Marca (`brandId` + Email)**:
  - El cliente final no utiliza `assignedBrands`; su identidad pertenece a una única marca mediante `user.brandId` (en el auto-registro de `/login`, el sistema prioriza la marca correspondiente al dominio web desde el que accede el cliente).
  - En `src/lib/permissions.ts`, todas las consultas exigen simultáneamente **`brandId = user.brandId`** y coincidencia *case-insensitive* de su correo con cualquiera de los 5 campos de email del modelo `Client` (`contactEmail`, `invoiceEmail`, `contactEmail2`, `contactEmail3`, `representativeEmail`). Así, si una misma persona contrata con dos marcas distintas usando el mismo email, cada cuenta de portal solo expone los suministros y facturas de su marca correspondiente.

---

## 4. Arquitectura de la Sección `/usuarios` y Endpoints Asociados

*(Nota: La antigua ruta duplicada `/ajustes/usuarios` fue eliminada definitivamente; toda la gestión reside en `/usuarios`).*

### 4.1 Ficheros Clave
- `src/lib/userManagementScope.ts`: Cálculo centralizado del alcance (`getUserManagementScope`) y verificación de pertenencia (`isTargetUserInScope`).
- `src/app/(app)/usuarios/page.tsx`: Server Component (`force-dynamic`) que carga usuarios sin hash de contraseña, filtra por alcance y sanea relaciones fuera de ámbito para `COMPANYADMIN`.
- `src/app/(app)/usuarios/UsersClient.tsx`: Tabla interactiva con:
  - **3 Pestañas**: *Equipo y Red Comercial* (roles internos/ventas), *Clientes Portal* (`CLIENT`) y *Todos los Usuarios*.
  - **Filtros dinámicos combinables** (Regla 208): Buscador instantáneo + selectores de Rol, Marca, Canal (incluyendo *"Sin canal asignado"*) y Estado (*Con acceso activo* vs *Bloqueados / Sin marcas*).
  - **Indicadores reales de acceso**: Muestra las marcas efectivas según la lógica real de cada rol y distingue visualmente los estados **Activo**, **Sin acceso** (activo pero con 0 marcas asignadas) y **Bloqueado** (`isActive = false`).
  - **Paginación estándar**: 100 usuarios por página mediante `PaginationFooter` (Regla 3).
- `src/app/(app)/usuarios/UserModal.tsx`: Modal responsivo con scroll interno, visor mostrar/ocultar contraseña, interruptor *Activo / Bloqueado* y formulario adaptativo según rol:
  - `SUPERADMIN`: Aviso informativo de acceso global automático.
  - `CLIENT`: Selector único de marca del portal (`brandId`) y ocultación de código comercial.
  - `CANAL` / `COMERCIAL`: Selector de Canal de Ventas (obligatorio en `CANAL`, opcional en `COMERCIAL`) + casilla *Supervisor del Canal*; si es comercial directo sin canal, habilita el selector de comercializadoras y marcas.
  - `COMPANYADMIN` / `BACKOFFICE`: Árbol jerárquico **Comercializadoras Autorizadas → Marcas Autorizadas** (Regla 28), pre-hidratando automáticamente las empresas padre a partir de `assignedBrands` para soportar sin fricción usuarios históricos migrados.
  - Al cambiar el rol hacia un perfil no comercial (`BACKOFFICE`, `COMPANYADMIN`, `SUPERADMIN`, `CLIENT`), limpia automáticamente `channelId` e `isChannelSupervisor` tanto en estado UI como en base de datos (`channel: { disconnect: true }`).
- `src/app/api/users/route.ts` (`POST`) y `src/app/api/users/[id]/route.ts` (`PUT`): Validación server-side completa de alcance, unicidad *case-insensitive* de email, longitud mínima de contraseña, coherencia automática canal → marca → comercializadora y preservación de relaciones externas.

---

## 5. Flujos de Alta Comercial y Notas de Migración Histórica

### 5.1 Flujos de Alta en `/leads` para Comerciales y Canales
1. **Crear Oferta (Estudio Comercial)**: Flujo ágil de baja fricción que solicita únicamente datos básicos de contacto/suministro y adjuntos esenciales (DNI/Factura) sin exigir IBAN, dirección completa ni firma.
2. **Alta Luz (Contrato Directo)**: Flujo completo con validación estricta (NIF, domicilios, representante legal en personas jurídicas según Regla 75, IBAN, verificación documental y selección de plantilla SEPA `CORE` vs `B2B`).

### 5.2 Reglas de Coherencia con Datos Migrados de Airtable
- Los usuarios comerciales importados desde Airtable (`CANALES LINK`) mantienen su vinculación relacional a través de `User.email` y `channelId`, asignándose `role = 'CANAL'` + `isChannelSupervisor = true` cuando tenían activo `"Supervisor canal"`, o `role = 'COMERCIAL'` en caso contrario (Regla 26).
- Para deshabilitar agentes o cuentas históricas se utiliza siempre **`isActive = false`** desde `/usuarios`, manteniendo íntegro su correo original y la trazabilidad histórica de todos sus contratos y leads vendidos.
- Los registros históricos huérfanos sin comercial identificable se vinculan al Superadmin raíz `fjponferrada@sp-energia.com` (Regla 23).
