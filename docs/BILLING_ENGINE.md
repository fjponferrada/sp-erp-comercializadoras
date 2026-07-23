# Motor de Facturación y Áreas Asociadas

Esta guía documenta en detalle el funcionamiento, la arquitectura y las reglas de negocio del Motor de Facturación Interna (`InternalBillingEngine.ts`) del ERP de SP Comercializadoras, así como sus áreas y componentes dependientes.

## 1. Arquitectura General del Motor

El motor de facturación es el núcleo encargado de calcular el importe exacto a cobrar a cada cliente en cada factura, desglosando los costes de energía, potencia, peajes, cargos, impuestos y conceptos regulados adicionales. 

Su punto de entrada principal es la clase estática `InternalBillingEngine` ubicada en `src/lib/services/InternalBillingEngine.ts`. 

### Flujo de Ejecución (Pipeline de Cálculo)

Cuando se solicita calcular una factura (ya sea por primera vez al importar la F1 o forzando un recálculo), el motor ejecuta la función `calculate(invoiceId: string, forceCCHRepair: boolean)`. El flujo es el siguiente:

1. **Obtención de Datos Base (`fetchInvoiceData`)**: 
   - Extrae la factura F1 enviada por la distribuidora.
   - Carga el contrato del cliente asociado al CUPS.
   - Obtiene el producto (tarifa) y el modelo de precios (Indexado, Fijo, Fijo+Indexado, etc.).

2. **Obtención de Curva de Carga (CCH)**:
   - Se busca el consumo horario exacto del cliente (`HourlyReading`) que coincide con el periodo de la factura F1.
   - Si no hay curva, o la curva está incompleta (le faltan horas respecto al total de días facturados), y `forceCCHRepair` está activo, el motor inicia un proceso de **reparación** o **profiling**.
   - **Profiling**: Si falta la curva real, se genera una curva estimada utilizando los perfiles iniciales de REE (Red Eléctrica de España), repartiendo el consumo total (Total MWh) reportado por la distribuidora en las horas del periodo.

3. **Cálculo de Potencia (`calculatePowerCost`)**:
   - Calcula el coste de la potencia contratada multiplicando la potencia en kW de cada periodo (P1 a P6) por el número de días facturados y el precio de la potencia.
   - Se desglosa en Peajes (regulados), Cargos (regulados) y Margen/Precio comercializadora.
   - Analiza los excesos de potencia registrados en la F1 de la distribuidora y repercute su coste al cliente.

4. **Cálculo de Energía (`calculateEnergyCost`)**:
   - Itera hora por hora el periodo de facturación cruzando el consumo de la CCH con el precio de la energía.
   - Según el modelo de precios (`pricingModel`) del contrato, el precio horario varía (Mercado OMIE, PPA, Fijo, etc.).
   - Añade los peajes y cargos de energía correspondientes según el periodo (P1-P6).
   - Calcula las mermas (Pérdidas de Red) basándose en los coeficientes publicados en el BOE.

5. **Cálculo de Conceptos Regulados y Extras (`calculateRegulatedCosts`)**:
   - Repercute el Bono Social (financiación obligatoria).
   - Repercute el Alquiler del Equipo de Medida.
   - Aplica el Impuesto Eléctrico (sobre la base de energía + potencia + excesos).

6. **Cálculo de Autoconsumo y Bolsillo Solar**:
   - Cuantifica la energía vertida a la red (excedentes).
   - Limita los excedentes según la normativa (nunca pueden superar el valor de la energía consumida, es decir, el término de energía).
   - El resto del valor excedentario (si el contrato tiene "Bolsillo Solar" o batería virtual) se guarda para futuros descuentos.

7. **Consolidación (Totalización)**:
   - Suma todos los conceptos para calcular la Base Imponible, aplica el IVA/IGIC correspondiente y genera el Resultado de Facturación (`BillingCalculationResult`).
   - El resultado se guarda en el borrador de la factura (`DraftInvoice`).

## 2. Modelos de Precios y Pricing Engine

El motor se apoya en el servicio `PricingEngine` para resolver el precio de la energía en una hora concreta. Existen varios modelos:

*   **INDEXADO (Pass-Through)**: El cliente paga la energía a precio de mercado mayorista (OMIE) más unos desvíos, costes de operación del sistema (ESIOS) y un _fee_ (margen de comercialización).
*   **FIJO**: El cliente tiene un precio cerrado (€/kWh) por cada periodo (P1 a P6) independientemente del mercado.
*   **PPA (Purchase Power Agreement)**: Modelos mixtos donde un porcentaje de la curva del cliente se cubre con energía solar a precio fijo, y el excedente (la energía que necesita de noche o en picos) se cobra a precio indexado.
*   **HERMANOS / ROA**: Subvariantes de indexado puro o mixto según las políticas comerciales.

## 3. Pérdidas de Red (Mermas)

Al comprar energía para el cliente, la comercializadora debe adquirir más energía de la que el cliente consume debido a las pérdidas de la red eléctrica. 
El cálculo de pérdidas en el motor (`InternalBillingEngine.ts`):
1. Obtiene los coeficientes de pérdidas por periodo desde la base de datos (extraídos del BOE y de REE).
2. Multiplica el consumo horario por el coeficiente horario.
3. Se aplican reglas de corrección normativas (por ejemplo, correcciones de factor 1.0 a 2.0 y división porcentual) dependiendo de las directrices de la OMIE/CNMC vigentes para ajustar la merma real repercutible.

## 4. Financiación del Bono Social

Todas las comercializadoras están obligadas a financiar el Bono Social. Este es un cargo **diario** por punto de suministro (CUPS).
*   El coste diario cambia cada año a raíz de la publicación de las Órdenes Ministeriales (por ejemplo, TED/1487/2024 o TED/634/2026).
*   El sistema dispone de la tabla `RegulatedDailyCost` en base de datos.
*   El motor cruza las fechas del periodo de facturación con la tabla de `RegulatedDailyCost`. 
*   **Anotación dinámica**: Para cumplir con la normativa legal, el motor inserta en el borrador (`invoiceData.bonoSocialLabel`) la descripción exacta de la Orden que estipula el precio cobrado en esos días, y esto se transfiere dinámicamente al PDF de la factura final.

## 5. Servicios de Valor Añadido (SVA)

Los SVA son cuotas fijas o extras que se cobran al cliente por servicios de la comercializadora (Mantenimientos, Seguros, Costes de Gestión de Batería Virtual). 

**Campos clave en el Contrato (`Contract`)**:
*   `svaPrice` (Float): Precio total del servicio por su duración.
*   `svaDuration` (Int): Duración del servicio en meses.
*   `svaStartDate` (DateTime): Fecha de comienzo de la cuota.
*   `svaConcept` (String): El concepto o etiqueta a imprimir en el PDF de la factura.

**Lógica de Prorrateo**:
El motor de facturación comprueba las fechas de la factura contra el rango activo del SVA (`svaStartDate` a `svaStartDate + svaDuration meses`). Extrae el precio mensual, lo convierte en un precio diario prorrateado anual (`(PrecioMensual * 12) / 365`), y lo multiplica por los **días que solapen** con el periodo facturado.

## 6. Generación del PDF (Desglose de Comercialización)

El PDF generado (a través de los componentes de React como `InvoicePdfTemplate.tsx`) obedece estrictas reglas de negocio para no inducir a confusión al consumidor final. 

**Separación Visual Obligatoria**:
*   La factura **separa estrictamente** los costes regulados (Peajes y Cargos definidos por el Estado) de los costes de comercialización y energía.
*   Para cada periodo (P1 a P6), se muestra por separado el `Peaje/Cargo` frente a la `Energía Activa` o `Potencia Comercial`.
*   Los cargos extras (Impuesto Eléctrico, Bono Social, SVA, Alquiler de Medida) cuentan con su desglose unitario, mostrando Cantidad (Días o kWh) y Precio por Unidad.

## 7. Recálculos y Reparación (Self-Healing)

Cuando existen discrepancias entre lo facturado por la distribuidora (F1) y lo que nuestro motor calcula que deberíamos haber facturado, la factura entra en modo alerta o requiere validación manual.
A través de la API `/api/facturacion/interna/recalculate`, el ERP permite al equipo de BackOffice forzar un recálculo desde cero. 
- Si durante el recálculo el motor detecta incoherencias graves en la curva de carga, activa rutinas de reparación automática insertando consumos proporcionales (`profiling`) de REE para salvar el hueco, dejando constancia en un registro de auditoría (`repairData` en `invoiceData`) que la factura ha sido reparada o estimada.
