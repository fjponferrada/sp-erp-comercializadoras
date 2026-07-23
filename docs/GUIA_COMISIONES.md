# 📚 Guía Completa del Motor de Comisiones (Liquidaciones)

Esta guía detalla exhaustivamente el funcionamiento interno, matemático y de interfaz de usuario del sistema de liquidaciones de comisiones del ERP. Documenta toda la lógica que gestiona cómo se paga a los canales, cómo se penalizan las bajas anticipadas, y cómo se gestiona la especificidad de las reglas.

---

## 1. Configuración de Comisiones (UI: `/comisiones-config`)

El sistema emplea un motor de especificidad basado en la jerarquía: **Canal -> Nivel -> Regla**.

### 1.1 Niveles de Comisión (Tiers)
En lugar de asignar comisiones canal por canal de manera individual, los canales comerciales se suscriben a **Niveles de Comisión** (ej. "Nivel Premium", "Nivel Básico"). 
* Modificar un Nivel afecta instantáneamente a todos los canales asignados a él.
* Se pueden **Duplicar Niveles** (mediante el botón de clonar en la UI) para crear nuevas parrillas sin empezar desde cero. Al duplicar, se copian todas las reglas internas, pero el nuevo nivel nace sin canales asignados.

### 1.2 Reglas Internas y el Motor de Especificidad
Dentro de un Nivel, se configuran las *Reglas*. Cada regla determina si el pago se hace como **Fijo (€)** o **% sobre el Margen**. El sistema evalúa los contratos contra las reglas usando un **Sistema de Puntuación por Especificidad**:

Cuando el ERP necesita calcular la comisión de un contrato, evalúa todas las reglas del nivel del canal y les otorga puntos:
1. **Tarifa específica**: (ej. `2.0TD`) -> +1 punto.
2. **Tipo de producto**: (ej. `Fijo`, `Indexado`) -> +1 punto.
3. **Tramo de potencia**: (ej. `0 a 5 kW`) -> +1 punto.
4. **Producto / Servicio concreto**: (Si se seleccionó explícitamente en la lista) -> +100 puntos (Máxima prioridad, anula el resto).

**Ejemplo de uso**: Se puede crear una regla "escudo" genérica (*Cualquier Tarifa = 60% Margen*) y luego reglas muy específicas por encima (*Tarifa 2.0TD entre 0-5kW = 100€*). El contrato siempre será capturado por la regla más específica que encaje.

---

## 2. Liquidaciones de Comisiones (Alta)

Cuando un contrato se activa, genera una comisión "Upfront" (pago por adelantado), cuyo importe se calcula basándose en la regla ganadora descrita anteriormente y en la "foto fija" del contrato (sus potencias `P1C..P6C`, y sus precios/fees firmados `P1E...`).

*   **Tarifas 2.0TD (Tipo `POWER_TIERS`)**: La comisión es una cantidad fija en Euros (€) dependiendo del tramo de potencia.
*   **Resto de Tarifas (Tipo `MARGIN_PERCENTAGE`)**: La comisión es un porcentaje sobre el margen bruto estimado anual (Margen de Energía + Margen de Potencia).

### Falsas Bajas Prematuras (Quick Drops)
Existe un filtro de salvaguarda. Si un contrato se activa, pero se da de baja **antes del día 11 del mes posterior** al mes de su activación, se considera un "alta fallida" o baja prematura. El sistema lo **omite por completo** de la liquidación de altas. Nunca llega a pagarse, evitando así tener que reclamar esa misma deuda semanas después.

---

## 3. Regularización por Bajas Anticipadas (Decomisiones)

Si un contrato que ya cobró su comisión inicial "Upfront" causa baja antes de cumplir su permanencia obligatoria, el ERP dispara un proceso de *True-Up* (Regularización). 

La lógica matemática para recuperar el dinero **difiere drásticamente** según la tarifa del contrato:

### 3.1 Decomisiones para Tarifas 2.0TD
Al operar por tramos fijos y no depender del consumo, su penalización es un **prorrateo lineal estricto en tiempo**.
*   **Permanencia teórica**: 365 días.
*   **Días activos**: Fecha de Baja - Fecha de Alta.
*   **Fórmula**: `(365 - Días Activos) * (Comisión Inicial / 365)`
*   **Regla del Euro (Perdón)**: Si, por prorrateo, la cantidad resultante a devolver a la empresa es estrictamente menor a `1,00 €` (es decir, causó baja en los ultimísimos días), el sistema perdona la deuda y la fija en `0,00 €`.

### 3.2 Decomisiones para Tarifas Mayores (3.0TD, 6.1TD, etc.)
Estas tarifas se pagaron basándose en un consumo *estimado* anual. Por tanto, para penalizar la baja, no se puede hacer un simple prorrateo de días, hay que calcular **cuánto dinero dejó realmente en la empresa** durante su corta vida.
*   **Proceso de True-Up**: El sistema localiza *todas* las facturas generadas para ese cliente mientras estuvo activo.
*   **Consumo Real Extrapolado**: Suma todo el `TotalMWh` facturado y lo divide entre los días totales de facturación para obtener el consumo real diario.
*   **Recálculo**: Vuelve a calcular el margen real de energía y potencia usando este consumo preciso adaptado a los días de vida del contrato.
*   **Comisión Real**: A ese margen real se le aplica el `% de comisión` original. Esa es la "Comisión Real" que se ganó el agente.
*   **Fórmula**: `Comisión Inicial (Upfront) - Comisión Real (Recalculada)`. 
El resultado es la cantidad exacta (Decomisión) a devolver por parte del canal.

---

## 4. Exportaciones Financieras (Excel)

Toda la complejidad anterior debe poder justificarse ante el canal comercial en un formato claro (Excel). Las exportaciones del sistema cumplen unas reglas estrictas de integridad para asegurar cuadres perfectos:

1.  **Signo Negativo Obligatorio**: Las liquidaciones de Decomisiones (ya sea 2.0TD o Resto) siempre se formatean con signo negativo (`-X.XX €`) tanto en la interfaz de la web como en las columnas del Excel.
2.  **Redondeos Matemáticos (Dst Fix)**: Los cálculos de días entre fechas usan `Math.round()` en lugar de `floor` o `ceil` para esquivar las distorsiones de los cambios de hora (Horario de Verano/Invierno) que históricamente provocaban errores de +/- 1 día.
3.  **Trazabilidad de Fechas**: El Excel siempre expone la **Fecha de Alta V0** (la fecha de inicio de permanencia original inamovible) y la **Fecha Final de Baja** (la baja real definitiva del contrato tras todas sus modificaciones) para justificar los días exactos facturados.
4.  **Columna Consumo Anual MWh**: En las decomisiones de "Resto", el Excel debe exponer el consumo anual histórico (`consumoAnual`) que sirvió como "foto fija" para pagar la comisión original, de modo que el analista financiero pueda comparar lo que se estimó frente al true-up real.
5.  **Cuadre**: El diseño garantiza que si un usuario de Excel realiza un sumatorio de la columna de liquidaciones, se cumplirá matemáticamente que: `[Total Altas] + [Total Decomisiones (negativo)] = Total Neto`.
