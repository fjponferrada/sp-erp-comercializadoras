# SP Energía ERP - Documentación de Tareas Programadas Nativas (Windows Task Scheduler)

Este documento detalla todas las tareas automatizadas configuradas a nivel de sistema operativo en el servidor Windows. Estas tareas son fundamentales para mantener sincronizada la base de datos, importar ficheros de distribuidoras y lanzar procesos pesados fuera del hilo principal de la web.

## Tareas de Scraping (Automático y Persistente)

El sistema de Scraping para recuperar archivos F1 de las distribuidoras se divide en varias piezas para asegurar que siempre haya un motor gráfico activo:

### 1. `AED_Worker_Persistent`
- **Descripción**: Mantiene encendido el Worker local de Node.js que controla el `undetected_chromedriver`.
- **Desencadenador (Trigger)**: Se ejecuta automáticamente *Al iniciar sesión* el usuario Administrator.
- **Acción (Action)**: Ejecuta directamente `C:\Scrapping\run_worker.bat`.
- **Importancia**: Crítico. Sin esto, el sistema no puede saltarse los antibots de las eléctricas.

### 2. `SPEnergia_Cron_RestartWorker`
- **Descripción**: Tarea de mantenimiento preventivo. Se encarga de matar cualquier proceso Node colgado y reiniciar el Worker para que esté fresco.
- **Desencadenador (Trigger)**: Diariamente a las `05:59`, `11:59`, `17:59` y `23:59`.
- **Acción (Action)**: Ejecuta PowerShell oculto que hace `Stop-Process` y relanza la tarea `AED_Worker_Persistent`.
- **Importancia**: Garantiza que el Worker no acumule memoria ni se quede bloqueado a largo plazo.

### 3. `SPEnergia_Cron_TriggerScraping`
- **Descripción**: Llama a la API del ERP (`/api/cron/trigger-scraping`) para meter el trabajo de Scraping en la cola de la base de datos.
- **Desencadenador (Trigger)**: Diariamente a las `00:00`, `06:00`, `12:00` y `18:00`.
- **Acción (Action)**: Petición HTTP POST.

---

## Tareas del Core de Negocio (Endpoints CRON)

Las siguientes tareas se encargan de automatizar la facturación, los correos y los análisis de mercado, llamando a la API de Next.js (`/api/cron/`):

### 4. `SPEnergia_Cron_ActivateRenewals`
- **Descripción**: Comprueba diariamente los contratos que vencen y aplica la lógica de Renovación Automática enviando notificaciones.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `01:00` (01:00, 07:00, 13:00, 19:00).

### 5. `SPEnergia_Cron_UpdatePortfolio`
- **Descripción**: Genera el modelo de previsiones de demanda (portfolio de clientes) multiplicando los CCH por los perfiles climáticos.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `02:00` (02:00, 08:00, 14:00, 20:00).

### 6. `SPEnergia_Cron_SyncEsios` *(Legacy)*
- **Descripción**: Descargaba los precios de OMIE desde ESIOS. **Actualmente desactivado** ya que se usa el Importador nativo COMPODEM.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `02:00`.

### 7. `SPEnergia_Cron_FtpSync`
- **Descripción**: Se conecta al servidor FTP del ERP, escanea los archivos XML subidos, los parsea e inserta los datos crudos en la base de datos.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `03:00` (03:00, 09:00, 15:00, 21:00).

### 8. `SPEnergia_Cron_AggregateHistory`
- **Descripción**: Coge los datos crudos recién importados por `FtpSync` o por Scraping, y calcula las agregaciones horarias y facturación de la base de datos central.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `04:00` (04:00, 10:00, 16:00, 22:00).

### 9. `SPEnergia_Cron_TrainForecast`
- **Descripción**: Entrena la IA (modelo Random Forest / LSTM) con los datos consolidados para afinar las previsiones de compra de energía del día siguiente.
- **Desencadenador (Trigger)**: Cada 6 horas empezando a las `05:00` (05:00, 11:00, 17:00, 23:00).

---

## Flujo de Trabajo Secuencial

Todas las tareas se han escalonado para no colisionar ni sobrecargar la base de datos:
1. **00:00** -> Se pone en cola el Scraping.
2. **01:00** -> Renovaciones de contratos.
3. **02:00** -> Actualización de portfolio.
4. **03:00** -> Se baja y parsea todo el FTP.
5. **04:00** -> Se consolidan los datos de Consumo.
6. **05:00** -> Se entrena la previsión con la foto final de todos los consumos del día.

*(Este bloque completo se repite cíclicamente cada 6 horas).*
