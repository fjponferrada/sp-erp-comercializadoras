# Hoja de Ruta Evolutiva del ERP (`ROADMAP.md`)

**Última actualización:** 14 de Noviembre de 2026  
**Estado actual del Core ERP:** Operativo extremo a extremo (~92% de cobertura funcional del ciclo completo de comercialización eléctrica en España).

---

## 1. Resumen del Estado Actual Consolidado

El ERP cuenta actualmente con los siguientes pilares integrados y en producción:
1. **Motor de Pricing Forward (`PricingEngine`)**: Cotización dinámica con curva base de cartera (`PortfolioBaseCurve`), futuros OMIP + perfilado solar (*duck curve*), cobertura de PPAs, pérdidas BOE $\times K$, desvíos, garantías, FNEE y divisor exacto de Tasa Municipal ($\frac{1}{1 - 0.015}$).
2. **Motor de Facturación ATR y Energía (`InternalBillingEngine`)**: Cruce de XML `F1` de distribuidora con curvas horarias/cuarto-horarias (`LoadCurve`) en zona horaria `Europe/Madrid`, perfilado/escalado REE, autoconsumo RD 244/2019, **Bolsillo Solar post-IVA**, regímenes de Impuesto Eléctrico (exenciones 85%/100%, mínimo de $1\text{ €/MWh}$ o $0.5\text{ €/MWh}$) e impuestos territoriales (`IVA`, `IGIC`, `IPSI`).
3. **Switching CNMC V3.0 y CRM Multicapa**: Generación e ingesta de XMLs oficiales (`A3`, `C1`, `C2`, `M1`, `B1`, `T1`, `D1`, `E1`, `E2`, `J1`, `R1`), jerarquía `Company -> Brand -> Channel`, congelación de *snapshot* económico al firmar y motor de comisiones a 365 días (*Clawback* lineal en `2.0TD` y *True-Up* sobre kWh reales en `3.0TD`/`6.XTD`).
4. **Operaciones de Mercado, Telemedida y Scraping Desatendido**: Ingesta automática de curvas (`F5D`, `P5D`, `RF5D`, `CCH_VAL`, `CCH_FACT`, `SIPS`), conciliación de Energía Pendiente REE (`A1..C8` cruzando `REGANECU` con `COMPODEM`/`OMIE` y deducción `1.0x` de autoconsumo según P.O. 14.8), separación de PPAs físicos vs. financieros CfD, predicción de demanda IA (`SDA + ml-cart`) y worker de scraping 100% *headless* con auto-recuperación.
5. **Cumplimiento Normativo y Fiscal**: Informes CNMC/MITECO (`SI_CODAGE`, `TM_CODAGE`, `CIR/DE/007/25`, `ESCILA` en `ISO-8859-1`, `DAFNE/FNEE`) y liquidaciones fiscales (**Modelo 560 AEAT** y **Tasa Municipal 1,5%**).

---

## 2. Módulos y Mejoras Planificadas (Backlog Estratégico)

A continuación se detallan los **5 grandes bloques evolutivos** priorizados por retorno operativo y financiero para alcanzar el 100% de automatización.

---

### Prioridad 1: Tesorería Bancaria SEPA (`pain.008` / `pain.002`) y Ciclo Regulado de Impagos y Cortes (`B1_03` $\rightarrow$ `E2`)

#### Objetivo de Negocio
Automatizar el cobro por domiciliación bancaria de las facturas emitidas y enlazar las devoluciones bancarias con el procedimiento legal de requerimiento de pago, suspensión de suministro (`B1` motivo `03`) y reposición (`E2`).

#### Alcance Funcional y Técnico
1. **Generador de Remesas Bancarias SEPA XML (`ISO 20022 pain.008.001.02`)**:
   - Nueva vista `/treasury/remittances` para agrupar facturas en estado `EMITIDA` / `PENDIENTE_COBRO` con método de pago domiciliado.
   - Separación estricta en dos ficheros XML según el mandato del contrato (`Contract.sepaMandateType`):
     - **SEPA CORE (`CORE`)**: Para consumidores domésticos y pymes generales (plazo de devolución de hasta 8 semanas).
     - **SEPA B2B (`B2B`)**: Para clientes industriales/empresas con mandato B2B firmado (sin derecho a devolución una vez cargado en cuenta).
   - Gestión automática de secuencia de adeudo (`FRST` / `RCUR` unificado bajo estándar EPC actual), referencia única de mandato (`RUM`) y fecha de cobro (`ReqdColltnDt`).
2. **Importador de Devoluciones Bancarias (`ISO 20022 pain.002` / Norma 19)**:
   - Lector drag-and-drop de ficheros XML de rechazo/devolución emitidos por la entidad bancaria.
   - Identificación automática de la factura por `EndToEndId` (`Invoice.invoiceNumber`), cambio de estado a `DEVUELTA`, registro del código de motivo de devolución (`AC01` IBAN incorrecto, `AM04` saldo insuficiente, `MD01` sin mandato, `MS02` orden del cliente) e imputación configurable de gastos de devolución.
3. **Orquestador Legal de Recobro y Corte por Impago (RD 1955/2000 y RD 897/2017)**:
   - **Bloqueo de Suministros Esenciales**: Validación automática en `SupplyPoint` / `Contract` para impedir la generación de corte si el CUPS está marcado como suministro esencial, electrodependiente o consumidor vulnerable en prórroga legal.
   - **Hito 1 (Notificación Fehaciente)**: Envío automatizado de comunicación certificada (email/SMS certificado o integración burofax) con requerimiento de pago y fecha límite.
   - **Hito 2 (Solicitud de Corte a Distribuidora)**: Superado el plazo legal sin cobro, habilitación de botón directo para generar y enviar el XML CNMC **`B1` (`Motivo 03 - Suspensión de suministro por impago`)**.
   - **Hito 3 (Reposición Urgente tras Cobro)**: En el instante en que una factura de un CUPS cortado pasa a estado `PAGADA`, alerta prioritaria y generación en 1 clic del XML CNMC **`E2` (`Solicitud de Reposición`)** dentro de las 24h legales.

---

### Prioridad 2: Centro Proactivo de Alertas Operativas y Monitorización de Salud

#### Objetivo de Negocio
Evitar paradas silenciosas en la ingesta de datos (FTP/Scraping), caducidades de contraseñas en portales de distribuidoras, vencimientos de plazos CNMC o emisión de facturas con margen negativo por lecturas anómalas.

#### Alcance Funcional y Técnico
1. **Motor de Alertas Multicanal (Campana en Topbar + Email SMTP + Bot de Telegram/Webhook)**:
   - **Alerta de Credenciales de Distribuidoras**: Disparo inmediato cuando `scraping_worker.js` detecta las etiquetas `[AVISO_CADUCIDAD]` (ej. aviso de caducidad de contraseña de 90 días en Endesa e-distribución) o `[ALERTA_CREDENCIALES]` (usuario bloqueado o contraseña expirada en UFD, I-DE o CIDE).
   - **Alerta de Desincronización (`Watchdog SLA`)**: Aviso automático si `webLastSyncAt` o `ftpLastSyncAt` de cualquier distribuidora con contratos activos supera las **36 horas** sin actualizarse.
   - **Alerta de Vencimiento de Reclamaciones (`R1 Paso 03`)**: Aviso diario de expedientes `R1` en estado `Pte. Info (Paso 03)` cuya `FechaLimiteEnvio` venza en menos de **48 horas** para evitar el rechazo por caducidad (`Paso 06` motivo `29`).
   - **Auditoría Pre-Facturación de Margen Negativo o Anomalías F1**: Alerta en la bandeja de borradores de `/invoices` cuando una factura `F1` presenta consumo estimado desproporcionado, excesos de reactiva/potencia anómalos o un margen bruto comercial negativo ($\text{Ingresos Cliente} < \text{Coste F1} + \text{Coste Energía Pool/PPA}$).

---

### Prioridad 3: Enlace Contable Directo (Generador de Asientos para ERP Financiero)

#### Objetivo de Negocio
Eliminar la contabilización manual en gestoría o departamento financiero exportando directamente el diario de asientos contables cuadrado al céntimo para **Sage, A3ERP, Odoo, Holded o ContaPlus**.

#### Alcance Funcional y Técnico
1. **Parametrización de Subcuentas Contables (`/settings/accounting`)**:
   - Configuración de longitud de subcuenta (8, 9 o 10 dígitos) y prefijos estándar del Plan General Contable (PGC):
     - `430xxxx`: Clientes por NIF/Contrato.
     - `7000001` / `7000002`: Ventas de Energía Activa / Término de Potencia y ATR repercutido.
     - `4750001`: Hacienda Pública, acreedora por Impuesto Especial sobre la Electricidad (Modelo 560).
     - `477xxxx`: Hacienda Pública, IVA/IGIC/IPSI repercutido (según tipo impositivo 21%, 10%, 5%, 0%, 3%, 7%).
     - `4380001`: Anticipos / Saldo de **Bolsillo Solar** pendiente de compensar (pasivo circulante post-IVA).
     - `400xxxx` / `600xxxx`: Proveedores Distribuidoras (facturas `F1` de peajes y cargos recibidas).
     - `623xxxx` / `410xxxx` / `4751xxx`: Gastos de comisiones de canales externos, acreedores comerciales y retenciones de IRPF practicadas.
     - `4009xxx` / `6009xxx`: Provisión mensual de **Energía Pendiente de Facturar REE** (derivada del módulo `/gestion/energia-pendiente`).
2. **Exportador de Diario de Ventas, Compras F1 y Comisiones**:
   - Descarga en 1 clic por rango de fechas en formatos compatibles con importación directa (`Suenlace.dat` A3, `Diario.csv` Sage/Odoo/Holded) marcando las facturas como `CONTABILIZADA` para evitar duplicidades.

---

### Prioridad 4: Facturación Electrónica `Facturae 3.2.2` (FACe / AAPP) y Cumplimiento `Veri*factu` (AEAT)

#### Objetivo de Negocio
Permitir la licitación y facturación a Administraciones Públicas (ayuntamientos, colegios, organismos públicos) mediante el estándar oficial `Facturae 3.2.2` y blindar el motor de facturación frente al reglamento antifraude **Veri\*factu** de la AEAT.

#### Alcance Funcional y Técnico
1. **Generador `Facturae 3.2.2` con Códigos DIR3 (FACe)**:
   - Campos opcionales en `Customer` / `SupplyPoint` para suministros de Sector Público:
     - `dir3OficinaContable` (`Oficina Contable`)
     - `dir3OrganoGestor` (`Órgano Gestor`)
     - `dir3UnidadTramitadora` (`Unidad Tramitadora`)
   - Generación del XML oficial `Facturae 3.2.2` incluyendo el desglose regulado de electricidad (potencia por periodos `P1–P6`, energía activa, ATR, Impuesto Eléctrico sobre base `TPA + TEA + TER`, alquiler de contador y descuentos de autoconsumo) y firma electrónica XAdES-EPES (`.xsig`).
2. **Encadenamiento Criptográfico `Veri*factu` y Código QR Tributario**:
   - Al promover una factura a estado definitivo (`Fase 5` en `InternalBillingEngine`), cálculo del hash `SHA-256` encadenado con la huella de la factura inmediatamente anterior de la misma serie (`previousInvoiceHash`).
   - Impresión automática del **Código QR oficial de la AEAT** y la leyenda *"Factura verificable en la sede electrónica de la AEAT / VERI\*FACTU"* en la plantilla PDF (`invoicePdfTemplate.ts`).

---

### Prioridad 5: Optimizador Matemático de Potencias (`P1–P6`) y Reactiva en Cotizador y Renovaciones

#### Objetivo de Negocio
Aportar una herramienta diferencial de venta consultiva y fidelización que calcule automáticamente las potencias óptimas a contratar en tarifas `3.0TD` y `6.XTD` usando los datos reales ya almacenados en el ERP (`F1Invoice` y `LoadCurve`).

#### Alcance Funcional y Técnico
1. **Motor de Simulación de Potencia Óptima (`PowerOptimizerEngine`)**:
   - Lectura de los últimos 12 meses de maxímetros cuarto-horarios (`LoadCurve`) o demandas máximas registradas en los XML `F1` (`PotenciaMaxDemanda` por periodo `P1..P6`).
   - Algoritmo de optimización sujeto a la restricción regulatoria de envolvente creciente de la CNMC ($P_1 \le P_2 \le P_3 \le P_4 \le P_5 \le P_6$):
     - Minimiza la función de coste anual total:
       $$\text{Coste Total Potencia} = \sum_{p=1}^{6} \left( P_p \times \text{Precio Fijo}_p \times 365 + \text{Penalización Excesos}_p(P_p) \right)$$
     - Donde $\text{Penalización Excesos}_p(P_p)$ aplica tanto la fórmula de cuarto-horaria por maxímetro ($K_p \times T_{ep} \times \sqrt{\sum (P_{\text{dem}} - P_{\text{cont}})^2}$) en contadores tipo 1/2/3 como la penalización por maxímetro mensual ($2 \times (P_{\text{max}} - 1.05 \times P_{\text{cont}})$) en contadores tipo 4/5.
2. **Detección de Penalizaciones de Energía Reactiva ($\cos \varphi < 0.95$ / Capacitiva)**:
   - Cálculo automático de la batería de condensadores recomendada (`kVAr`) y su *payback* en meses cuando el cliente sufre recargos recurrentes por energía reactiva inductiva en `P1..P5` o capacitiva en `P6`.
3. **Integración Comercial Directa (`1-Click M1`)**:
   - Inclusión de una página comparativa de **"Ahorro por Optimización de Potencia"** en el PDF de la oferta comercial (`/pricing`) y botón directo en la ficha del contrato para lanzar la solicitud de modificación contractual **`M1`** a distribuidora con las nuevas potencias óptimas propuestas.

---

### Prioridad 6: Automatización 100% Desatendida de Descarga e Ingesta Mensual SIPS CNMC en Google Cloud (Día 5 de cada mes)

#### Objetivo de Negocio
Eliminar por completo cualquier intervención manual en local (`Z:\AED\SIPS\BD_AEDEN_SIPS`) para actualizar el censo nacional SIPS de la CNMC, haciendo que la propia infraestructura de Google Cloud descargue mensualmente los `.zip` oficiales desde la CNMC y los inyecte de forma automática y clusterizada en Google BigQuery (véase detalle completo en [`docs/SIPS.md`](./SIPS.md)).

#### Alcance Funcional y Técnico
1. **Unificación de Descargador CNMC + Ingesta en un Único Cloud Run Job (`sips-auto-sync-mensual`)**:
   - Integrar la lógica de `0_descargador_masivo_cnmc.py` (`OAuth1` + autenticación con certificado digital mutuo `certificado_aeden.pem` contra `https://api.cnmc.gob.es/ficheros/v1/consultar?idProcedimiento=2&nifEmpresa=B10915544&estado=DISPONIBLE`) dentro del propio Job en la nube (`custom-cycling-496811-q2`, región `europe-southwest1` Madrid).
   - Almacenar de forma cifrada el certificado `certificado_aeden.pem` y las claves `CLIENT_KEY` / `CLIENT_SECRET` en **Google Secret Manager** (sin exponer ficheros sensibles en carpetas locales).
2. **Programación Mensual Automática (`Google Cloud Scheduler` — Día 5 de cada mes)**:
   - Configurar un disparador cron en **Cloud Scheduler** (ej. día `5` de cada mes a las `03:00 AM` hora Madrid, con reintento automático los días `6` y `7` si la CNMC aún no ha publicado el fichero `DISPONIBLE` de ese mes).
   - El Cloud Run Job descarga directamente a alta velocidad (red troncal de Google Cloud) los ficheros `PS_ELECTRICIDAD` y `CONSUMOS_ELECTRICIDAD`, los guarda como respaldo en `gs://bucket-sips-aeden/archivos_crudos/` y los vuelca atómicamente en BigQuery (`sips_nacional.datos_ps` y `sips_nacional.datos_consumos`) activando `clustering_fields=["cups"]` para mantener el coste de consultas en ~0 €/mes.
3. **Notificación de Éxito al ERP**:
   - Al finalizar la carga mensual en BigQuery, el Job envía un webhook a nuestro ERP (`/api/sips/webhook-sync`) registrando la nueva versión del mes publicada por la CNMC y lanzando en segundo plano la actualización de `sipsRawData` de nuestra cartera activa.

---

## 3. Resumen de Priorización Sugerida

| Fase | Módulo | Impacto Principal | Complejidad Estimada |
| :--- | :--- | :--- | :--- |
| **Fase 1** | **Centro Proactivo de Alertas Operativas** (Scraping, Credenciales, `R1 Paso 03`, Margen F1) | Seguridad operativa inmediata y 0 caídas silenciosas | Baja - Media |
| **Fase 2** | **Motor SIPS Propio (Frontend `Consulta de CUPS` + API Drop-In Ingebau + Cron Mensual Día 5 en GCP)** (ver [`docs/SIPS.md`](./SIPS.md)) | Independencia total de proveedores externos, CSV/JSON idéntico a Ingebau y actualización sola en la nube | Media |
| **Fase 3** | **Tesorería SEPA (`pain.008` / `pain.002`) + Ciclo Impagos y Cortes (`B1_03` / `E2`)** | Liquidez en caja, automatización bancaria y control de morosidad | Media - Alta |
| **Fase 4** | **Enlace Contable Directo (Exportador Diario PGC para Sage / A3 / Odoo)** | Ahorro de horas administrativas y cierre contable mensual instantáneo | Media |
| **Fase 5** | **Optimizador Automático de Potencias (`P1–P6`) y Reactiva** | Argumento comercial de alto valor en captación B2B y renovaciones | Media |
| **Fase 6** | **Facturación Electrónica `Facturae 3.2.2` (FACe) + `Veri*factu` AEAT** | Acceso a licitaciones públicas (AAPP) y cumplimiento normativo AEAT | Media - Alta |
