# Guía de Gestión de Suministro y Facturación

Esta guía detalla el funcionamiento de tres de los módulos clave del ERP encargados de la supervisión de la energía pendiente, la gestión de las facturas de clientes (CRM Ventas) y la importación de datos desde sistemas externos.

---

## 1. Suministro Pendiente Facturar (`/energia-pendiente`)

### Objetivo
Esta página sirve para **estimar cuánta energía ha consumido la cartera de clientes que aún no ha sido facturada** y qué valor económico (Base Imponible) representa ese retraso. 

### ¿Cómo funciona el cálculo?
El algoritmo actúa contrato por contrato de la siguiente manera:
1. **Punto de partida (Última Facturación):** Busca en la base de datos la fecha de fin de la última factura emitida (`billingEnd`) para el CUPS del contrato. Si el contrato nunca ha sido facturado, toma su fecha de activación.
2. **Días Pendientes:** Calcula los días transcurridos desde esa última fecha hasta el **día de hoy**. *Nota: Si el contrato se dio de baja, calcula los días hasta su fecha final de rescisión (`terminationDate`).*
3. **Estimación de Consumo:** El sistema no tiene la lectura real aún, por lo que hace una estimación. Revisa el consumo total del último año (12 meses) de ese CUPS y extrae la **media de consumo diario**. Multiplica esta media por los Días Pendientes para obtener los MWh estimados que faltan por cobrar.
4. **Estimación Económica:** Cruza esos MWh estimados con los precios horarios del mercado OMIE de los días exactos de retraso, sumando los costes regulados (peajes y cargos) para ofrecer una Base Imponible proyectada y un total con impuestos. Los importes se desglosan por meses (Mes actual, M-1, M-2).

---

## 2. Facturas de Clientes - CRM Ventas (`/facturas`)

### Objetivo
Es el panel central para el control, búsqueda y envío de los recibos emitidos a los clientes finales (modelo `Invoice` en la base de datos). 

### Funciones Principales
- **Listado y Filtros:** Muestra todas las facturas generadas. Permite filtrar por estado de pago (Pagada, Pendiente), estado de envío al cliente (Comunicada, No Comunicada), rango de fechas y texto libre (nombre del cliente, CUPS, CIF/NIF, número de factura, etc.).
- **Comunicación con el Cliente:** Desde aquí se puede hacer el envío masivo o individual de facturas por correo electrónico (Emailing / Notificaciones). El sistema marca con un check y una fecha aquellas que ya han sido comunicadas con éxito.
- **Descargas:** Posibilidad de descargar el documento PDF de cada factura de forma individual, o generar archivos masivos (como ZIPs con múltiples facturas seleccionadas) para entregar a la gestoría o contabilidad.

> ⚠️ **Aclaración Importante:** Estas facturas son los recibos de venta al cliente final. **No deben confundirse** con las facturas de peajes (F1) enviadas por la distribuidora, las cuales se gestionan en su propio panel (Distribuidoras > Listado F1). Tampoco es la vista del "Motor de Facturación Interno" del ERP, que es el módulo que *crea* facturas desde cero a partir de curvas de carga y precios indexados/fijos.

---

## 3. Importador de Facturas (`/importar-facturas`)

### Objetivo
Esta herramienta permite alimentar la base de datos del CRM con facturas que han sido generadas en plataformas externas (como el panel del proveedor de Switching, sistemas de facturación de terceros o excels heredados).

### Proceso de Importación (Dos Pasos)
El importador está dividido en dos módulos visuales que trabajan en conjunto para automatizar la ingesta:

1. **Importador de Datos (Excel / CSV):** 
   - El operador sube un archivo con las columnas de metadatos (Número de factura, CUPS, Base Imponible, Total, Fechas de inicio y fin, Cliente, etc.).
   - El sistema lee el archivo y **crea los registros** en la base de datos.
   - El algoritmo es inteligente: agrupa la importación en bloques para no saturar el servidor y detecta registros duplicados automáticamente para no sobreescribir facturas existentes erróneamente.

2. **Importador de PDFs (Carga Masiva):**
   - Una vez creados los registros, el operador arrastra los documentos PDF físicos de las facturas (se pueden procesar cientos a la vez).
   - El ERP lee el nombre de cada archivo PDF (por ejemplo, `F-2026-0455.pdf`).
   - Busca en la base de datos una factura que tenga ese mismo número y **enlaza el PDF al registro**. A partir de ese momento, la factura queda 100% completada y lista para ser visualizada o enviada desde la página de CRM Ventas.
