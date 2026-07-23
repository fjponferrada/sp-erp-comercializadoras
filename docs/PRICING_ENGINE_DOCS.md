# Documentación del Motor de Cotización (Pricing Engine)

Esta guía documenta la arquitectura, lógica matemática y decisiones de diseño del `PricingEngine`, el cerebro financiero predictivo del ERP, asegurando su perfecta alineación con el `InternalBillingEngine` (Motor de Facturación).

## 1. Arquitectura "Espejo" (Cotizador vs Facturación)

El sistema ERP opera bajo una arquitectura simétrica para garantizar que el margen de beneficio proyectado en una oferta comercial se cumpla matemáticamente en el futuro durante el ciclo de vida del contrato.

*   **Motor de Facturación (`InternalBillingEngine` - El "Retrovisor"):** Es un sistema determinista. Viaja al pasado (mes ya vencido) y utiliza datos consolidados reales (cierres de OMIE, liquidaciones de Ajuste del Sistema publicadas por REE/ESIOS, y curvas CCH reales del cliente).
*   **Motor de Cotización (`PricingEngine` - El "Oráculo"):** Es un sistema probabilístico. Viaja al futuro (hasta 12 meses) simulando cada una de las 8.760 horas del año. Utiliza la *Curva Base del Portfolio* para proyectar OMIE (basada en futuros OMIP y PPAs), fusiona históricamente el comportamiento estadístico de los Servicios de Ajuste mediante `smartMergeDB`, y modela el consumo usando perfiles estadísticos de REE o CCH real historificado.

## 2. La Fórmula Matemática Maestra

Ambos motores ejecutan, hora a hora, exactamente la misma fórmula financiera estipulada legalmente:

```text
Ph = [ [(OMIEh + SSAAh + PC + ROM + ROS + DSV) * (1 + Perd) + FNEE + FEE] * 1/0,985 + ATR ]
```
*Donde:*
*   **OMIEh**: Precio base del mercado mayorista.
*   **SSAAh**: Servicios de Ajuste (Restricciones RT3, CT2, Banda Secundaria BS3, etc).
*   **PC, ROM, ROS**: Pagos por Capacidad y Retribuciones del Operador del Mercado y Sistema.
*   **DSV**: Coste de Desvíos (asumido).
*   **Perd**: Coeficiente de Pérdidas de red.
*   **FNEE**: Fondo Nacional de Eficiencia Energética (libre de pérdidas).
*   **1/0,985**: Escalado matemático para aplicar la Tasa Municipal (1,5%) sobre la base bruta de energía y margen.
*   **ATR**: Peajes y Cargos de Energía (términos variables no sujetos a tasa municipal).

## 3. Procesamiento de Curvas Cuarto-Horarias

Para adaptarse al nuevo estándar de liquidación peninsular, el `PricingEngine` está preparado nativamente para recibir curvas en resolución cuarto-horaria (96 intervalos por día) en lugar de horaria (24 intervalos).

A través del orquestador estadístico `smartMergeDB`, si el motor detecta un registro de coste o CCH con 96 valores, activa automáticamente una rutina de compresión: agrupa los 4 cuartos de hora pertenecientes a la hora base y calcula su media aritmética para poder insertarlo en la fórmula de facturación horaria sin desvirtuar la matemática del sistema.

## 4. Gestión Estricta de Costes Variables vs Fijos (El "Filtro de Energía")

Una de las reglas más críticas del `PricingEngine` es la sanitización de los Costes Regulados. Al iterar sobre la tabla `RegulatedCost`, el algoritmo de Pricing **debe calcular exclusivamente el coste variable de la energía (€/MWh)**.

Si el motor procesara accidentalmente costes fijos (Términos de Potencia, que se miden en €/kW/año), intentaría transformarlos a €/MWh, generando distorsiones colosales en el precio final (precios de energía astronómicos, e.g., 7.000 €/MWh). Por ello, el motor incorpora un filtro barrera de seguridad:

```typescript
// Skip fixed costs (Términos de Potencia, Bono Social, Alquiler) since this loop is only for energy (€/MWh)
if (conceptLow.includes('potencia') || conceptLow.includes('fijo') || conceptLow.includes('bono') || conceptLow.includes('alquiler')) {
    continue;
}
```

## 5. Algoritmo de Cálculo de Pérdidas Físicas

El tratamiento de las Pérdidas es uno de los procesos más fieles a la liquidación final de la CNMC. No se aplica como un porcentaje plano al final de la factura, sino que se inyecta directamente al coste volumétrico de la energía:

1.  **Extracción del Coeficiente Base (BOE):** El motor localiza la tarifa (ej. `2.0TD`) y extrae el multiplicador correspondiente al periodo horario actual.
2.  **Modulación con Factor K:** El coeficiente BOE se multiplica por el Factor K horario (proyectado por `smartMergeDB` para emular el comportamiento real de la red eléctrica).
3.  **Matematización:** Se construye el multiplicador final `lossF = 1 + lossPct`.
4.  **Aplicación y Aislamiento:** El coste puro de la energía (mercado + ajustes) se multiplica por `lossF`. El sistema resta posteriormente el valor base al valor con pérdidas para aislar financieramente (en el Dashboard) el impacto exacto en euros que suponen estas mermas de red para la comercializadora.

## 6. Aislamiento Financiero frente al Autoconsumo (SURPLUS)

El modelo de datos almacena en la tabla `LoadCurve` dos tipos de curvas: `CONSUMPTION` (Consumo de Red) y `SURPLUS` (Excedentes inyectados).

El `PricingEngine` está deliberadamente **ciego frente a las curvas `SURPLUS`**.
*   Su único propósito es calcular la rentabilidad y el coste de la energía que la comercializadora tiene que *comprar* para el cliente.
*   El *parsing* del CSV en el frontend busca estrictamente columnas de `energía activa`, y el exportador de CCH interno fuerza el filtro `type: 'CONSUMPTION'`.
*   El cálculo del Límite de Compensación Simplificada (RD 244/2019) y la gestión de la hucha virtual ("Bolsillo Solar") residen **exclusivamente en el `InternalBillingEngine`**, manteniendo al cotizador puro, veloz y centrado en el riesgo mayorista.

## 7. El "Snapshot" Regulatorio (Gestión del Tiempo)

Para evitar la volatilidad en la emisión de ofertas vinculantes, el Cotizador realiza una "fotografía" regulatoria basada en la Fecha de Inicio (`startDate`) introducida por el agente.

```typescript
where: {
  OR: [{ tariff }, { tariff: 'TODAS' }],
  validFrom: { lte: startDate },
  validTo: { gte: startDate }
}
```

Esto garantiza que la oferta comercial se construya utilizando exactamente el BOE de peajes y cargos legalmente vigentes en la fecha de activación del contrato, y se mantienen estables como base de cálculo durante todo el periodo cotizado.
