# SP Energía — ERP Integral para Comercializadoras Eléctricas

Plataforma SaaS multi-sociedad y multi-marca (**Comercializadora `Company` → Marca `Brand` → Canal `Channel`**) diseñada para cubrir extremo a extremo la operativa comercial, técnica, mayorista, fiscal y regulatoria de una comercializadora de electricidad en el mercado español (CNMC / REE / OMIE / MITECO / AEAT).

- **Stack tecnológico:** Next.js 16 (App Router, Turbopack, Server Components & Server Actions), TypeScript, PostgreSQL + Prisma ORM v7, NextAuth v5, Cloudflare R2, Google Cloud Run + BigQuery (SIPS Nacional), DocuSign y Resend.
- **Entorno de Producción:** `https://ultra.sp-energia.com`

---

## Módulos Principales en Producción

1. **Dashboard Ejecutivo y Telemetría Operativa (`/`, Regla 280):** Renderizado SSR exclusivo para dirección y backoffice (`resolveDashboardAccess`), 6 KPIs ejecutivos deduplicados, alertas accionables en tiempo real (*Preaviso Fuga Paso 11*, *Warnings Switching ATR*, *F1 Pte. Facturar*, *Reclamaciones R1 / Paso 03*, *Rechazos*), renovaciones pendientes (`<= 90d` sin contratos ya renovados), telemetría real de pipelines y evolución económica mensual en `Europe/Madrid` con líneas base `0` sincronizadas.
2. **CRM Comercial, SIPS Propio y Contratación (`/consulta-cups`, `/leads`, `/contratos`, `/renovaciones`, `/bajas`):** Consulta SIPS en tiempo real sobre BigQuery, flujos separados **Crear Oferta** vs **Alta Luz**, validadores matemáticos (`NIF/NIE/CIF`, `IBAN MOD-97`, `CUPS Módulo-529`), aislamiento multipunto RBAC, expediente documental unificado anti-SSRF, retención **CRM Winback** y facturación contable independiente de penalizaciones (`PenaltyInvoice`).
3. **Motor de Facturación Interna y Auditoría F1 (`/facturacion/interna`, `/facturas`, `/ficheros-f1`):** Cruce cuarto-horario `F1 XML + LoadCurve` en `Europe/Madrid`, autoconsumo RD 244/2019 y **Bolsillo Solar**, abonos en cascada (`AR`/`A`/`S`), PDF oficial con etiquetado anual CNMC y QR del Comparador CNMC (`BOE-A-2022-16989`), paridad canónica de ~235 campos con Ingebau y exportación Excel de 65 columnas.
4. **Switching CNMC V3.0 y Scraping Desatendido (`/eventos-switching/*`, `/switching-warnings`, `/reclamaciones`, `/distribuidoras`):** Generación e ingesta XSD estricta (`A3`, `C1`, `C2`, `M1`, `B1`, `T1`, `D1`, `E1`, `E2`, `J1`, `R1`) y sincronización automática FTP + Web Scraping *headless* multi-distribuidora.
5. **Compras de Energía, Pricing Forward e IA (`/pricing`, `/compras/*`, `/gestion/energia-pendiente`):** Cotizador forward con PPAs físicos/financieros, curvas OMIE/COMPODEM/Factor `K`, predicción de demanda IA y conciliación horaria de **Energía Pendiente de Liquidar REE (`A1..C8`)**.
6. **Impuestos y Regulación (`/impuestos/*`, `/regulacion/cnmc`, `/regulacion/miteco`):** Liquidación de **Impuesto Eléctrico (Modelo 560)**, **Tasa Municipal 1,5%** (8.203 municipios INE) y generadores oficiales `SI_CODAGE`, `TM_CODAGE`, `CIR/DE/007/25`, `ESCILA` (`ISO-8859-1`) y `DAFNE / FNEE`.

---

## Índice de Documentación Oficial (`docs/`)

- [`docs/BUSINESS_RULES_UTF8.md`](./docs/BUSINESS_RULES_UTF8.md) / [`docs/BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md) — **Compendio maestro de Reglas de Negocio (Reglas 1 a 280)**.
- [`docs/CRM_VENTAS_GUIDE.md`](./docs/CRM_VENTAS_GUIDE.md) — Guía técnica y funcional de CRM Ventas, Dashboard, Contratos y Visibilidad RBAC.
- [`docs/USERS_AND_ROLES.md`](./docs/USERS_AND_ROLES.md) — Arquitectura de Usuarios, Roles, Seguridad Multi-Marca y Accesos.
- [`docs/BILLING_ENGINE.md`](./docs/BILLING_ENGINE.md) & [`docs/guia-facturacion.md`](./docs/guia-facturacion.md) — Motor de Facturación Interna, Paridad Ingebau y Auditoría F1.
- [`docs/GUIA_BAJAS_Y_PENALIZACIONES.md`](./docs/GUIA_BAJAS_Y_PENALIZACIONES.md) — Bajas, Alerta Paso 11, CRM Winback y Facturas de Penalización.
- [`docs/guia_referencia_switching.md`](./docs/guia_referencia_switching.md) & [`docs/MANUAL_RECLAMACIONES.md`](./docs/MANUAL_RECLAMACIONES.md) — Procesos SCTD CNMC V3.0 y Reclamaciones `R1`.
- [`docs/SCRAPING_DISTRIBUIDORAS.md`](./docs/SCRAPING_DISTRIBUIDORAS.md) & [`docs/GUIA_CCH_Y_IMPORTACION.md`](./docs/GUIA_CCH_Y_IMPORTACION.md) — Sincronización FTP/Web Scraping e ingesta de curvas CCH.
- [`docs/SIPS.md`](./docs/SIPS.md) — Infraestructura SIPS Nacional en Google Cloud Run + BigQuery.
- [`docs/PRICING_ENGINE_DOCS.md`](./docs/PRICING_ENGINE_DOCS.md), [`docs/GUIA_PPAS_Y_MERCADOS.md`](./docs/GUIA_PPAS_Y_MERCADOS.md), [`docs/OMIE_GUIDE.md`](./docs/OMIE_GUIDE.md) & [`docs/COMPODEM_GUIDE.md`](./docs/COMPODEM_GUIDE.md) — Pricing y Mercados Mayoristas.
- [`docs/GUIA_ENERGIA_PENDIENTE_REE.md`](./docs/GUIA_ENERGIA_PENDIENTE_REE.md) — Conciliación de Energía Pendiente frente a REE (`REGANECU`).
- [`docs/GUIA_IMPUESTOS.md`](./docs/GUIA_IMPUESTOS.md) & [`docs/GUIA_REGULACION.md`](./docs/GUIA_REGULACION.md) — Modelo 560, Tasa Municipal 1,5%, CNMC y MITECO.
- [`docs/GUIA_COMISIONES.md`](./docs/GUIA_COMISIONES.md) & [`docs/GUIA_CONFIGURACION.md`](./docs/GUIA_CONFIGURACION.md) — Motor de Comisiones y Configuración Multi-Sociedad.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — Estado consolidado y Hoja de Ruta Evolutiva.

---

## Desarrollo Local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000` en el navegador. Para verificar tipos antes de desplegar:

```bash
npx tsc --noEmit
```
