# Guía Detallada: PPAs y Gestión de Riesgo (ERP)

Este documento recoge los fundamentos matemáticos y de negocio que gobiernan la gestión de PPAs (Power Purchase Agreements) solares, proyecciones de precios y mercados de futuros (OMIE/OMIP) dentro de este ERP.

## 1. Arquitectura de Precios Futuros (OMIP Carga Base)

El ERP ha sido diseñado para tener una **visibilidad completa del calendario multi-año**.

*   **Modelo de Datos (`FuturePrice`):** A diferencia de modelos simples que solo guardan un "mes del 1 al 12" atemporal, el ERP guarda la curva de futuros financieros Carga Base (FTB) en formato `YYYYMM` (ej. `202607` para Julio de 2026).
*   **Gestión en UI:** Desde la sección *Configuración > Costes Regulados*, se pueden imputar los precios de cotización de futuros para cada mes y año de manera independiente.
*   **Impacto:** Esto permite realizar análisis financieros a largo plazo (2025, 2026, 2027...) sin que los precios de un año "pisen" a los del siguiente.

## 2. El Orquestador Financiero y la Curva Pato Sintética

El corazón predictivo del ERP es el cron job `/api/cron/update-portfolio`. Su misión es proyectar el coste de la energía futura hora a hora basándose en la volatilidad histórica.

### ¿Cómo modela el ERP la "Curva Pato"?
Para estimar cuánto valdrá la energía en una hora concreta del futuro (por ejemplo, a las 14:00 de un martes de Febrero de 2027), el ERP hace lo siguiente:
1.  **Ventana de 365 días:** Retrocede exactamente 365 días desde el momento de la consulta y lee el histórico real de OMIE de esa ventana.
2.  **Agrupación `m-w-h`:** Coge todos los martes (`w`) de ese mes (`m`) en el histórico y promedia los precios de esa hora en concreto (`h`).
3.  **Normalización:** Saca el "peso" (ratio) de esa hora respecto a la media de todo el día.
4.  **Escalado:** Aplica ese ratio horario a la Carga Base (el futuro OMIP) que le hemos dicho que tendrá ese mes futuro.

## 3. Divergencias entre el ERP y OMIP (FTS)

A la hora de valorar un PPA Solar, nos encontraremos diferencias brutales (hasta de un 90%) entre lo que cotiza el mercado OMIP Solar (FTS) y la estimación que da el ERP. **No es un error informático, es la diferencia entre un algoritmo matemático y un especulador financiero.**

*   **La Estimación del ERP (El Peor Escenario / Stress Test):**
    El ERP proyecta el "efecto caníbal" de manera pura. Si el Febrero pasado fue muy ventoso y lluvioso, provocando precios de cero en las horas solares, el ERP asume que el próximo Febrero pasará exactamente lo mismo. El precio capturado estimado solar se hundirá drásticamente frente a la Carga Base.
*   **Los Futuros Solares de OMIP (Consenso Optimista):**
    OMIP cotiza basándose en expectativas. Los traders asumen un clima "normal" y un aumento futuro de la demanda (por bombeos, baterías e interconexiones), añadiendo además una prima de riesgo financiera.

### Ejemplo Práctico (Febrero 2027)
*   **OMIP Carga Base (FTB):** 73 €/MWh
*   **OMIP Solar (FTS):** 55 €/MWh
*   **Estimación Captura ERP:** 3,49 €/MWh (debido al arrastre matemático de un Febrero histórico anómalamente barato durante las horas de sol).

## 4. Mejores Prácticas (Risk Management)

Para la negociación de PPAs, fiarse al 100% de OMIP es peligroso (puedes comprar demasiado caro y perder margen si el mes sale muy renovable), y fiarse al 100% del ERP bloquea oportunidades (te dará valoraciones de compra bajísimas).

**La recomendación en el sector (Blended Forecast):**
Fijar los precios de los PPAs basándose en el promedio de ambos mundos:
`(Futuro OMIP Solar + Estimación Captura ERP) / 2`

Esto genera un precio prudente que mitiga el riesgo histórico pero que reconoce el valor financiero a futuro del activo. El ERP debe utilizarse como **herramienta de auditoría de peor escenario** para no quedar expuesto a la ruina en años caníbales.

## 5. Mantenimiento y Puntos Críticos del Código

*   `/api/cron/update-portfolio/route.ts`: Orquestador principal que genera la tabla `PortfolioBaseCurve`.
*   `/api/ppas/proyeccion/route.ts`: API que simula la liquidación de un PPA leyendo de `PortfolioBaseCurve`. Aquí es donde se calcula el `omieMedio` (Precio Promedio OMIE Capturado Solar) cruzando el perfil de generación de la planta con los precios horarios futuros.
*   `energiaPendienteActions.ts`: Cruza la energía pendiente de facturar con `PortfolioBaseCurve`.
*   Siempre que se edite la tabla de futuros, se debe correr de nuevo la Sincronización de Portfolio para que la `PortfolioBaseCurve` se regenere y todas las analíticas beban del nuevo dato.
