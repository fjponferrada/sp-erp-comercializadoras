# Reglas de Negocio para Generación de Facturas (Desglose de Comercialización)

Cuando se genere un desglose de factura de electricidad (ya sea en PDF, Excel o vista detallada), se debe respetar estrictamente la siguiente estructura visual y conceptual, que separa de manera clara la energía activa del ATR (Peajes y Cargos), además de incluir todos los conceptos legales y extras.

## Estructura de la Tabla "DETALLE DE LA FACTURA"
Columnas requeridas: **Concepto | Cantidad | Días | Precio Ud | Total €**

### 1. Potencia Facturada
- **Cantidad**: kW
- **Días**: (ej. 30)
- **Precio Ud**: €/kW/día
- **Desglose por periodo (P1 a P6)**: `Px. Potencia Facturada`
- **Subtexto debajo de cada periodo**: `Peajes potencia: X €, Cargos potencia: Y €`

### 2. Término de Energía ATR
- **Cantidad**: kWh
- **Precio Ud**: €/kWh
- **Desglose por periodo (P1 a P6)**: `Px. ATR Energía`
- **Subtexto debajo de cada periodo**: `Peajes energía: X €, Cargos energía: Y €`

### 3. Término de Energía Activa
- **Cantidad**: kWh
- **Precio Ud**: €/kWh
- **Desglose por periodo (P1 a P6)**: `Px. Energía Activa` (Precio pactado con el cliente excluyendo ATR)

### 4. Término de Excesos de Potencia
- `Importe Excesos de Potencia` (Total €)

### 5. Término de Excedentes
- **Cantidad**: kWh
- **Precio Ud**: €/kWh
- `Excedentes Autoconsumo (máximo aplicable según RD 244/2019: X €)` (Total negativo)
- `Llenado de Bolsillo Solar (Excedentes - Máximo aplicable)`

### 6. Impuestos y Conceptos Regulados/Adicionales
- `Impuesto Eléctrico (Impuesto especial sobre la facturación de la electricidad suministrada (Base = TPA + TEA + TER): [Base] x [Tipo]% (Mínimo de 1 €/MWh para tarifas 2.0TD y 3.0TD y 0,5 €/MWh para el resto)`
- `Financiación del Bono Social según Orden TED/1487/2024` (Días, €/día)
- `Alquiler equipo de Medida` (Días, €/día)
- `Costes de Gestión Bolsillo Solar` (Días, €/día)

### 7. Totales
- `Base Imponible`
- `[XX]% IVA (BI [Base] €)`
- `Total FACTURA` (En negrita y destacado)

### 8. Tu Bolsillo Solar en esta Factura
Tabla inferior con las columnas:
- Saldo inicial
- Llenado
- Uso
- Saldo final
