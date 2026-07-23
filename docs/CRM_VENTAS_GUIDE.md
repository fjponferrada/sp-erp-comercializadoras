# Guía del Módulo: CRM VENTAS (ERP Comercializadora)

Esta guía detalla la arquitectura, el flujo de negocio y las decisiones de diseño del módulo **CRM Ventas** dentro de nuestro ERP propietario. Está diseñado específicamente para las necesidades de una Comercializadora Eléctrica, permitiendo que Canales y Comerciales operen de manera autónoma con visibilidad filtrada.

---

## 1. Arquitectura de Contratos y Trazabilidad

A diferencia de CRMs genéricos, este sistema utiliza un modelo de **Trazabilidad por Versiones** para mantener el historial completo de un Punto de Suministro (CUPS).

*   **Versionado (`version`)**: Todo contrato nuevo parte de la versión 1. Cualquier modificación posterior (Cambio de titular, cambio de tarifa) genera un nuevo registro de contrato con `version + 1`.
*   **Encadenamiento (`previousContractId`)**: El nuevo borrador se enlaza al contrato anterior. Esto permite saber de dónde viene un contrato y bloquear acciones contradictorias (ej. no dejar que dos comerciales renueven el mismo contrato a la vez).
*   **Tipos de Modificación (M1)**: 
    *   **Administrativa (Cambio de Titular)**: Hereda las fechas contractuales (`expectedEndDate`, `permanenceStartDate`) pero cambia el `client` asociado.
    *   **Técnica (Cambio de Tarifa/Potencia)**: Modifica los parámetros técnicos (P1-P6) pero mantiene al mismo cliente.

---

## 2. Gestión de Fechas (El núcleo del ciclo de vida)

Para que el sistema de facturación, renovaciones y switching funcione sin colisiones, las fechas se tratan de manera totalmente independiente:

*   `activationDate` (Fecha Activación): La fecha real en la que la distribuidora activó el suministro.
*   `fechaPrevistaActivacion`: Fecha estimada que marca el usuario o el sistema antes de que la distribuidora confirme la activación.
*   `expectedEndDate` (Fin Previsto): Fecha de caducidad legal del contrato. **Vital para el motor de renovaciones**. Se hereda íntegramente en las modificaciones (M1) para no perder de vista cuándo caduca realmente el acuerdo.
*   `terminationDate` (Fecha Baja): La fecha real en la que el cliente dejó de estar activo con nosotros (Paso 06 del Switching).
*   `fechaPrevistaBaja`: Exclusiva del **Paso 11 del Switching**. Es un aviso temprano de la distribuidora. **No sobreescribe** la `expectedEndDate`, garantizando que a nivel legal el contrato mantiene sus plazos, pero activando alarmas visuales para retención.

---

## 3. Renovaciones y Fidelización

El módulo de **Renovaciones** es el motor proactivo del CRM:

*   **Ventana de 90 días**: Solo se muestran en la tabla de renovables los contratos `ACTIVOS` o `TRAMITANDO` cuya `expectedEndDate` esté a 90 días o menos de caducar.
*   **Bloqueo por trámites pendientes**: Si un contrato tiene un "hijo" (`previousContractId` apuntando a él) que no esté `RECHAZADO` ni `CANCELADO`, el sistema asume que ya hay un trámite en marcha (ej. un cambio de titular pendiente de activar) y bloquea el contrato antiguo poniéndole la etiqueta **✅ Renovado**.
*   Una vez que el "hijo" se activa, el padre pasa a `FINALIZADO` (desapareciendo de la tabla), y el hijo ocupa su lugar, siendo renovable de nuevo cuando se acerque su fecha de fin.

---

## 4. Bajas, Winback y Emisión de Ofertas

El panel de **Bajas** se alimenta directamente de los eventos del motor de Switching (importadores F1 e Ingesta XML):

*   **Alerta Temprana (Paso 11)**: Cuando otra comercializadora solicita el CUPS, recibimos un Paso 11. El ERP pone el contrato en la sección de Bajas, permitiendo actuar al departamento de retención.
*   **Ofertas Automáticas (Resend)**: Los comerciales pueden enviar contraofertas en 1 clic. El ERP genera un PDF y un Email que distinguen inteligentemente entre:
    *   **Tarifas Fijas**: Muestran la tabla de precios (P1 a P6).
    *   **Tarifas Indexadas**: Ocultan la tabla a 0€ y muestran el texto legal: *"facturado a precio de mercado (Indexado) más un margen de comercialización (Fee)"*.
*   **Navegación Fluida**: El CUPS es clicable para auditar el contrato en detalle, y el botón de volver (`router.back()`) recuerda el estado del buscador y los filtros de la tabla de bajas.

---

## 5. Rendimiento y Base de Datos (Prisma Postgres / Vercel)

Al alojar la base de datos en **Prisma Postgres (`db.prisma.io`)** y la web en **Vercel (Serverless)**, la gestión de conexiones es crítica:

*   **El problema del Serverless**: Vercel levanta múltiples instancias simultáneas. Si cada instancia pide 5 conexiones a la vez, se supera el límite del plan Hobby rápidamente (`Too many database connections opened`).
*   **Connection Pool Limiting**: En `src/lib/prisma.ts`, la variable `max` del `Pool` de `pg` está configurada a **1 o 2 conexiones máximo por instancia**. Esto fuerza un "cuello de botella" ordenado en la RAM de Vercel (encolando las peticiones) en lugar de tumbar la base de datos PostgreSQL por exceso de aforo.
*   **Fast Refresh Local**: En desarrollo (`npm run dev`), guardar archivos repetidamente puede dejar conexiones fantasma abiertas. La solución local es detener el proceso (`Ctrl+C`) y volver a arrancar el servidor.

---

## 6. Permisos y Visibilidad (Row Level Security en App)

El CRM Ventas asegura que la información esté encapsulada mediante filtros en las "Actions" (ej. `getDashboardMetricsAction`, `historicalInvoices`):

*   **COMERCIAL**: Solo ve los contratos, leads y facturas donde su `userId` coincida.
*   **CANAL**: Ve lo suyo y todo lo de los comerciales que cuelgan de su `channelId`.
*   **BACKOFFICE / SUPERADMIN**: Visibilidad total de la comercializadora.
*   Esta arquitectura convierte al sistema en un **CRM propietario multi-tenant**, ahorrando costes de licencias externas (Salesforce, HubSpot) y manteniendo toda la lógica adaptada nativamente al sector eléctrico español.
