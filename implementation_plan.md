# Ajuste Motor Facturación: Alertas y Curva Excedentes

Revisando el motor y nuestras conversaciones anteriores, veo exactamente lo que está sucediendo y tienes toda la razón. Actualmente, el motor está forzando los excedentes dentro de los periodos P1, P2 y P3 definidos por el consumo (o por el F1), lo que provoca que se sitúen excedentes en horas nocturnas o poco lógicas, disparando el precio medio. Además, falta la alerta correspondiente.

Para solucionarlo, propongo los siguientes cambios en `InternalBillingEngine.ts` que implementan al 100% lo que me pides:

## User Review Required
> [!IMPORTANT]
> **Ignorar los periodos del F1 para los excedentes**
> Cuando no haya curva CCH de excedentes, el motor ignorará por completo cuánto dice el fichero F1 que se volcó en P1, P2 o P3. Cogerá el **total de excedentes** (ej: 14,13 kWh) y lo repartirá siguiendo estrictamente la curva solar (`pSolar`) a lo largo del mes, centrando la producción en las horas de sol y eliminando volcados nocturnos. ¿Estás de acuerdo en descartar los periodos del F1 para esta reconstrucción?

## Proposed Changes

### Motor de Facturación (`InternalBillingEngine.ts`)

#### [MODIFY] [InternalBillingEngine.ts](file:///C:/Users/Administrator/sp-erp-comercializadoras/src/lib/services/InternalBillingEngine.ts)
1. **Añadir Alerta de CCH Excedentes Faltante:** Modificaré la lógica de evaluación de descuadres para añadir un mensaje de `Sin datos de curva de excedentes (CCH) en BD.` si la factura F1 indica que hay energía excedentaria pero no existen lecturas CCH de `surplus`.
2. **Generación Global con `pSolar`:** Cuando no haya CCH de excedentes, se generará la curva repartiendo el total de excedentes del F1 usando únicamente el coeficiente `pSolar` mensual total. Esto asegura que toda la energía se asigne a las horas de mayor insolación (independientemente de en qué periodos P1-P6 haya caído el consumo).
3. **Escalado Global de la Curva (Descuadres):** Cuando exista una curva CCH de excedentes pero no cuadre con el total del F1, multiplicaremos todas las horas de la CCH por un único factor (`totalF1SurplusMWh / totalCchSurplusMWh`). Esto mantendrá intacta la forma de la curva real del cliente, simplemente elevándola o reduciéndola proporcionalmente.
4. **Bug de getCoef (Desfase Horario):** Corregiré un pequeño detalle en `getCoef` donde las horas de las `00:00` no lograban emparejar con el perfil por un desfase de hora 0 vs hora 24, asegurando precisión total al perfilar.

### Interfaz de Usuario
Añadiré una mención visual en la página de importación de perfiles (`PerfilesReeClient.tsx`) para aclarar que el perfil `pSolar` también forma parte del esquema de importación en la base de datos para los excedentes. (El campo ya existe en base de datos como corroboramos, solo lo aclararemos en la vista).

## Verification Plan
### Automated Tests
- Ejecutaré scripts locales de depuración para la factura de Laura Alos, verificando que la alerta "Sin datos de curva de excedentes (CCH)" salte y que el precio de los excedentes baje a un valor entre 1 y 3 céntimos.
- Desplegaré los cambios en la instancia local de Next.js.
