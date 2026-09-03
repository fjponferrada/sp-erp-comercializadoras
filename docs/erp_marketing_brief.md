# Briefing de Producto: SP ERP Comercializadoras (SaaS)

Este documento está diseñado para proporcionar al equipo de desarrollo web y marketing una visión global y detallada de lo que hace el software ERP. El objetivo es que puedan extraer los beneficios clave, funcionalidades y propuestas de valor para estructurar la nueva **Landing Page de captación de clientes** (pequeñas comercializadoras eléctricas).

---

## 1. ¿Qué es SP ERP Comercializadoras?

Es un **ERP (Enterprise Resource Planning) de última generación diseñado específicamente para el sector eléctrico español**. Está construido con una arquitectura moderna en la nube (Serverless) y preparado para funcionar bajo dos modelos de comercialización:
1. **Modelo SaaS (Software as a Service) multi-tenant:** Alojado y mantenido por nosotros.
2. **Venta Directa (On-Premise / Servidor Propio):** Licencia de pago único sin cuotas mensuales recurrentes, donde el cliente asume el alojamiento y mantenimiento en su propia infraestructura.

**Público objetivo:** Pequeñas y medianas comercializadoras eléctricas independientes que no tienen la capacidad tecnológica para desarrollar su propio ERP desde cero o que están pagando licencias muy costosas por software obsoleto.

**Propuesta de valor principal:** Automatización extrema y libertad tecnológica. El software se encarga de conectar con las distribuidoras, descargar consumos, cruzar datos de mercado (OMIE/ESIOS), facturar de forma automatizada y liquidar comisiones, cumpliendo la regulación de la CNMC. Todo esto permitiendo a la comercializadora elegir si delega la infraestructura o si adquiere el código fuente para una independencia total.

---

## 2. Módulos y Funcionalidades Clave (Features para la Landing)

La landing page debería destacar los siguientes "Súper Poderes" o Módulos del ERP:

### ⚡ 1. Motor de Facturación y Consumos Inteligente (Billing Engine)
- **Scraping y Descarga Automática:** Se conecta automáticamente por FTP/SFTP a las grandes distribuidoras (Endesa, Iberdrola, UFD, CIDE, etc.) para descargar los ficheros XML de facturación (F1) y las Curvas de Carga Horaria (CCH).
- **Reparación de CCH:** Si la distribuidora envía datos de consumo incompletos, la Inteligencia Artificial del ERP rellena y repara los huecos basándose en los perfiles estándar de Red Eléctrica (REE).
- **Facturación de Autoconsumo:** Soporte nativo para instalaciones de placas solares. Calcula automáticamente la compensación de excedentes (RD 244/2019) y cuenta con un sistema de **"Bolsillo Solar"** (Batería Virtual) para guardar el crédito sobrante para futuras facturas.

### 📈 2. Pricing, Mercados y Predicción con IA
- **Integración OMIE y ESIOS en Tiempo Real:** Cálculo preciso hora a hora de los costes de energía, peajes, cargos y desvíos.
- **Gestión de Riesgos y PPAs:** Capacidad para mezclar precios indexados de mercado (Pool) con contratos bilaterales de compra de energía a largo plazo (PPAs).
- **Previsión de Demanda con Machine Learning:** Utiliza modelos predictivos (Árboles de Decisión y SDA) que tienen en cuenta la temperatura y la estacionalidad para pronosticar cuánta energía consumirá la cartera de clientes, ayudando a la comercializadora a comprar mejor la energía.

### 🏢 3. CRM Específico de Energía y Redes Comerciales
- **Multi-Nivel:** Perfiles independientes para la Comercializadora (Backoffice), el Canal (Distribuidor maestro) y el Comercial de calle.
- **Ciclo de Vida del Contrato:** Historial de versiones del contrato (cambios de titular, subidas de potencia, renovaciones). Avisos automáticos 90 días antes del vencimiento para retener al cliente.
- **Liquidación de Comisiones Automatizada:** Se acabaron los Excels. El sistema calcula automáticamente la comisión inicial y realiza ajustes (true-up / retrocesos) si el cliente se da de baja antes de tiempo o consume menos de lo esperado.

### 🏛️ 4. Automatización Regulatoria (CNMC y SIPS)
- **Generación de Ficheros CNMC:** El ERP genera de forma transparente los XML de solicitud de cambio de comercializador (Switching: A3, M1, C2, etc.) y los mete en un ZIP listos para enviar.
- **Gestor de Eventos y Avisos:** Panel de control para gestionar bajas no deseadas (Traspasos a COR), facturación ATR y reclamaciones de la distribuidora.
- **Cálculo de Impuestos Complejos:** Calcula automáticamente el Impuesto Eléctrico (IE), las financiaciones del Bono Social, y las problemáticas Tasas Municipales del 1,5% cruzando los CUPS por código postal.

---

## 3. Ventajas Técnicas Competitivas (Por qué somos mejores)

Esta sección es ideal para dar confianza sobre la robustez tecnológica del producto:

* **SaaS o Adquisición Total:** Una sola instancia del software puede albergar diferentes "marcas" o comercializadoras de forma aislada. El cliente elige si prefiere pagar una cuota y delegar el servidor (SaaS), o pagar una licencia única y alojarlo en sus propios servidores con total independencia y seguridad de sus datos.
* **Arquitectura Serverless (Vercel & Postgres):** Diseñado para escalar automáticamente a 0 o al infinito, lo que significa tiempos de respuesta ultra-rápidos (<10ms) y sin cuelgues durante los picos de facturación de principio de mes.
* **Interfaz Moderna e Intuitiva:** A diferencia de los clásicos ERPs del sector eléctrico (que parecen hojas de Excel de los años 90), SP ERP cuenta con un diseño limpio, moderno, *Dark Mode* y componentes altamente interactivos.

---

## 4. Estructura Sugerida para la Landing Page

Para el desarrollador/diseñador de la web, se sugiere el siguiente esqueleto (*Wireframe conceptual*):

1. **Hero Section:**
   * **Titular:** El ERP en la nube para Comercializadoras Eléctricas Independientes.
   * **Subtítulo:** Automatiza tu facturación, conecta con OMIE/ESIOS, gestiona tus canales de ventas y céntrate en crecer, sin preocuparte por la tecnología.
   * **Call to Action (CTA):** "Solicitar Demo" o "Hablar con Ventas".
2. **Sección "Problema vs Solución":**
   * *El problema:* Excels interminables, errores humanos en la liquidación de comisiones, desconexión de los cambios regulatorios (CNMC).
   * *La solución:* Un entorno único e integrado.
3. **Features Core (Grid de 4 o 6 columnas):**
   * Billing automático, CRM Multi-Canal, Batería Virtual (Bolsillo Solar), Predicción IA.
4. **Dashboard Preview:**
   * Mostrar un mockup del software real (modo oscuro, gráficos limpios) para impresionar visualmente.
5. **Trust & Security:**
   * Mención a la arquitectura Serverless, backups diarios, actualización regulatoria constante.
6. **Footer / Contacto:**
   * Formulario de lead qualification.
