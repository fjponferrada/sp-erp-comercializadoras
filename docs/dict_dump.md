# diccionario_canales.xlsx

| Campo Airtable | Descripción / Uso en el CRM | Importado a Base de Datos |
| --- | --- | --- |
| Nombre | nombre del canal comercial | No |
| % Comisión Fijo | no aplica a este crm | No |
| % Comisión Variable | no aplica a este crm | No |
| GEN_CONTRATO_AUTO | no aplica a este crm | No |
| DIAS_RENOV_MAX | no aplica a este crm | No |
| Código Canal | código del canal comercial | No |
| Supervisor Canal | no aplica a este crm | No |
| Email Supervisor | email del rsponsable del canal comercial | No |
| Email Administracion | email de administracion del canal comercial | No |
| Email Gerente | no aplica a este crm | No |
| Email AtCliente | no aplica a este crm | No |
| LEADS | leasd asociados a este canal | No |
| COMERCIALES | comerciales asociados a este canal | No |
| PRODUCTOS | productos que son visibles para este canal | No |


# diccionario_clientes.xlsx

| Nombre Airtable | Descripción / Significado | Campo Equivalente PostgreSQL |
| --- | --- | --- |
| CIF | nif del titular del contrato o los contratos firmados con comercializadora | client.vatNumber |
| CONSUMO_CONTRATOS_ACTIVOS | Pendiente de definir por el usuario | client.airtableData (JSON) |
| CONTRATOS | Pendiente de definir por el usuario | client.airtableData (JSON) |
| CP SOC | codigo postal del titular del contrato o los contratos firmados con comercializadora | client.billingPostalCode |
| DOMICILIO SOC | domicilio del titular del contrato o los contratos firmados con comercializadora | client.billingAddress |
| EMAIL | email del titular del contrato o los contratos firmados con comercializadora | client.contactEmail |
| EMAIL comercial | email de los comerciales que puedan visualizar este cliente | client.visibilityCommercialEmail |
| EMAIL contacto | email2 del titular del contrato o los contratos firmados con comercializadora | client.airtableData (JSON) |
| EMAIL contacto 2 | email3 del titular del contrato o los contratos firmados con comercializadora | client.airtableData (JSON) |
| EMAIL contacto 3 | email4 del titular del contrato o los contratos firmados con comercializadora | client.airtableData (JSON) |
| EMAIL factura | email5 del titular del contrato o los contratos firmados con comercializadora | client.airtableData (JSON) |
| EMAIL gerente | Dirección de correo electrónico del geretne de la comercializadora | client.airtableData (JSON) |
| EMAIL sup canal | email del supervisor de los canales que puedan visualizar este cliente | client.visibilitySupervisorEmail |
| Nombre completo | nombre completo del titular del contrato o los contratos firmados con comercializadora | client.airtableData (JSON) |
| NOMBRERAZON SOCIAL | nombre completo sin apellidos del titular del contrato o los contratos firmados con comercializadora | client.businessName |
| NUM_CONTRATOS_ACTIVOS | Pendiente de definir por el usuario | client.airtableData (JSON) |
| POBLACION SOC | población del titular del contrato o los contratos firmados con comercializadora | client.billingCity |
| Primer Apellido | primer apellido del titular del contrato o los contratos firmados con comercializadora | client.firstName |
| PROVINCIA SOC | provincia del titular del contrato o los contratos firmados con comercializadora | client.billingProvince |
| Segundo Apellido | segundo apellido del titular del contrato o los contratos firmados con comercializadora | client.lastName |
| TLF | teléfono del titular del contrato o los contratos firmados con comercializadora | client.contactPhone |
| USUARIOS LINK | Pendiente de definir por el usuario | client.airtableData (JSON) |


# diccionario_contratos.xlsx

| Nombre Airtable | Descripción / Significado | Campo Equivalente PostgreSQL |
| --- | --- | --- |
| ¿Facturas papel? | SI o NO quiere las facturas por correo postal además de por e-mail | client.paperInvoice |
| Abonar | Pendiente de definir por el usuario | contract.abonar |
| Actualizar consumo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Adicional Instalación | texto adicional al domicilio del punto de suministro no especificado en campo anteriores | supplyPoint.addressAddition |
| Adicional Titular | texto adicional al domicilio del titular no especificado en campo anteriores | client.billingAddressAddition |
| AjustePen | Pendiente de definir por el usuario | contract.ajustePen |
| ALTA (from CONTRATO PREVIO) | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| ALTA COMERCIALIZADORA | Fecha clave: Transiciona el estado del contrato a Activo automáticamente | contract.activationDate |
| Año firma | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| APELLIDOS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Apellidos Contacto | apellidos del representante  / apoderado de la empresa | contract.airtableData (JSON) |
| ATR COMER | Pendiente de definir por el usuario | contract.aTRCOMER |
| Autoconsumo | tipo autoconsumo legalizado en distribuidora | contract.autoconsumo |
| AUTOCONSUMO FIJO / INDEX | F si el cliente quiere que se le pague un precio fijo por sus excedentes fotovoltaicos o I si quiere que se le paguen a precio de mercado variable | contract.airtableData (JSON) |
| B2B | Si el cliente es autónomo o empresa, se marca este checkbox | contract.airtableData (JSON) |
| BAJA COMERCIALIZADORA | Fecha clave: Transiciona el estado del contrato a Finalizado automáticamente | contract.terminationDate |
| BAJA POR M1 R E1 | Pendiente de definir por el usuario | contract.bAJAPORM1RE1 |
| Bajas Glide | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| BIMENSUAL | checkbox que marcamos manualmente cuando la toma de lectura por parte de distribuidora se realiza de forma bimensual y no mensual | contract.bIMENSUAL |
| BIPen | Pendiente de definir por el usuario | contract.bIPen |
| BOLSILLO SOLAR | SI o NO se asocia cups al bolsillo solar del cif | contract.bOLSILLOSOLAR |
| Borrador contrato | pdf del borrador de contrato generado, que también se aloja en tabla contratos | contract.airtableData (JSON) |
| BUSCADOR | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CA (from PROV LINK) | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CALCULO MES ALTA | Pendiente de definir por el usuario | contract.cALCULOMESALTA |
| CALCULO MES BAJA | Pendiente de definir por el usuario | contract.cALCULOMESBAJA |
| Calle Instalación | calle del punto de suministro | supplyPoint.street |
| Calle Titular | calle del titular del contrato | client.billingStreet |
| CANAL | canal comercial a través del cual se ha captado el contrato | contract.airtableData (JSON) |
| CAPTACION CLIENTE | Modo de captación del cliente | contract.cAPTACIONCLIENTE |
| Certificado IBAN | documento que certifica titularidad del iban por parte del titular | client.iban |
| CG | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CG BOLSILLO SOLAR | coste de gestión por activar bolsillo solar en el cups | contract.airtableData (JSON) |
| CIE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CIERRE | Pendiente de definir por el usuario | contract.cIERRE |
| CIF | nif titular del punto de suministro | client.vatNumber |
| CIF link | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CNAE | código cnae del punto de suministro, según actividad allí desarrollada | supplyPoint.cnae |
| COD REE DISTRI LINK | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Código Canal | codigo del canal a través del cual se ha captado el contrato | contract.airtableData (JSON) |
| Código comercial | código del comercial a través del cual se ha captado el contrato, cada comercial está vinculado a un canal | contract.airtableData (JSON) |
| Código CUPS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Código Postal Instalación | codigo postal del punto de suministro | contract.airtableData (JSON) |
| CODIGO REE DISTRIBUIDORA | código distribuidora a efectos de switching | contract.airtableData (JSON) |
| Código Tarifa | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Comentario AED | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Comercial | comercial a través del cual se ha captado el contrato, cada comercial está vinculado a un canal | contract.airtableData (JSON) |
| COMISION | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| COMISION (from COMISIONES) | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| COMISION 50% | Pendiente de definir por el usuario | contract.cOMISION50 |
| COMISION FINAL | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Comisión Revisable | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| COMISION SI BAJA HOY | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| COMISION VARIABLE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| COMISION_ACTIVA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| COMISION_ESTIMADA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| COMISIONES | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CONSUMO ANUAL | consumo anual total estimado en MWh | supplyPoint.annualConsumption |
| CONSUMO ANUAL KWH | Consumo anual total estimado | lead.estimatedMWh |
| CONSUMO COMISION | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CONSUMO_REAL/ESTIMADO | Pendiente de definir por el usuario | contract.cONSUMOREALESTIMADO |
| CONTRATO | Código único de contrato | contract.contractCode |
| Contrato .PDF | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Contrato enviado | Control de automatización (Make): Indica si el contrato ya se envió a Docusign | contract.airtableData (JSON) |
| Contrato firmado | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CONTRATO_PREVIO | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CONTRATO2 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CONTROLSAGE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Copia de CIF link | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Copia de FACTURAS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CP SOC | codigo postal del titular del punto de suministro | client.billingPostalCode |
| CP_CONT | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| CUPS | Código Universal del Punto de Suministro | supplyPoint.cups |
| DECOMISION | Pendiente de definir por el usuario | contract.dECOMISION |
| DECOMISION 50% | Pendiente de definir por el usuario | contract.dECOMISION50 |
| Demanda Abril | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Agosto | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Diciembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Enero | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Julio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Junio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Marzo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Noviembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Octubre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda BC Septiembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda Febrero | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Abril | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Agosto | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Diciembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Enero | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Febrero | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Julio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Junio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Marzo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Mayo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Noviembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Octubre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda MANUAL Septiembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Demanda Mayo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DEMANDA REAL/PREVISTA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DerechosExtension | Pendiente de definir por el usuario | contract.derechosExtension |
| DESCUENTO CIE | Pendiente de definir por el usuario | contract.dESCUENTOCIE |
| Día Actual | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DIAS CONTRATO | Pendiente de definir por el usuario | contract.dIASCONTRATO |
| DIAS FACTURADOS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DIAS PAGO | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DIAS VIDA CLIENTE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DIAS_RENOV_MAX | Pendiente de definir por el usuario | contract.dIASRENOVMAX |
| DISTRIBUIDORA | distribuidora asociada al cups, la que distribuye la energía hasta allí | contract.airtableData (JSON) |
| DNI Apoderado | dni del apoderado/representante legal de la empresa titular del contrato (pdf o jpg) | client.fileRepresentativeId |
| DNI/NIF Titular | dni del titular del contrato (pdf o jpg) | contract.airtableData (JSON) |
| DOMICILIO PS | domicilio del punto de suministro | contract.airtableData (JSON) |
| DOMICILIO PS COMPLETO | domicilio completo del punto de suministro | contract.airtableData (JSON) |
| DOMICILIO SOC | domicilio del titular del contrato | client.billingAddress |
| Domicilio Titular Completo | domicilio completo del titular del contrato | contract.airtableData (JSON) |
| DOMICILIO_CONT | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DSV Index (from PRODUCTOS) | coste desvío de producto indexado | contract.airtableData (JSON) |
| DURACION | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| DURACION SVA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| EFACTURA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| EMAIL | Dirección de correo electrónico | client.contactEmail |
| Email Admin Canal | Dirección de correo electrónico | contract.airtableData (JSON) |
| Email AtCliente | Dirección de correo electrónico | contract.airtableData (JSON) |
| EMAIL COMER | Dirección de correo electrónico | contract.airtableData (JSON) |
| Email Comercial | Dirección de correo electrónico | No migrar (roles) |
| Email Contacto | Email de comunicación | client.contactEmail / lead.email |
| Email Contacto 2 | Dirección de correo electrónico | contract.airtableData (JSON) |
| Email Contacto 3 | Dirección de correo electrónico | contract.airtableData (JSON) |
| EMAIL FACTURA | Dirección de correo electrónico | contract.airtableData (JSON) |
| Email Gerente | Dirección de correo electrónico | contract.airtableData (JSON) |
| Email Sup Canal | Dirección de correo electrónico | contract.airtableData (JSON) |
| EMAIL_4 | Dirección de correo electrónico | contract.airtableData (JSON) |
| EMPRESA | código de la comercializadora | contract.airtableData (JSON) |
| EN CALIDAD DE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| ENERGIA FACTURADA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Energía Pte Mes -1 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Energía Pte Mes -2 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Energía Pte Mes 0 Hasta FIN MES | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Energía Pte Mes 0 Hasta HOY | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Enlace Wp | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Envío de factura | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| EQUIPO DISTRIB | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Estado | Estado del registro (Activo, Baja, etc) | contract.status / lead.status |
| ESTADO (from CONTRATO PREVIO) | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Abril | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Agosto | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Dic | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Ene | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Feb | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Julio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Junio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Abril | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Agosto | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Diciembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Enero | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Febrero | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Julio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Junio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Marzo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Mayo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Noviembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Octubre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes MANUAL Septiembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Marzo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Mayo | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Noviembre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Octubre | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Excedentes Sept | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Factura en papel | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| FACTURA SI / NO | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| FacturarPen | Pendiente de definir por el usuario | contract.facturarPen |
| FACTURAS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| FACTURAS 2 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| FC | Pendiente de definir por el usuario | contract.fC |
| Fecha Aceptación | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha Activación | Campo de fecha/timestamp | contract.activationDate |
| Fecha Actual | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha Borrador | fecha en la que se genera el contrato en tabla contratos en estado borrador y se genera pdf para enviar al cliente | contract.airtableData (JSON) |
| Fecha firma | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha firma contrato | Fecha clave: Transiciona el estado del contrato a Aceptado | contract.airtableData (JSON) |
| Fecha Incidencia | Campo de fecha/timestamp | contract.fechaIncidencia |
| FECHA INICIO SVA | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha Prevista Activación | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha Proceso | Campo de fecha/timestamp | contract.fechaProceso |
| Fecha Rechazo | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha Registro | fecha en la que se registra el lead | contract.airtableData (JSON) |
| Fecha Renovación Calculada | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha Solicitud | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha Vencimiento Calculada | Campo de fecha/timestamp | contract.fechaVencimientoCalculada |
| FECHA_BAJA_ESTIMADA | Campo de fecha/timestamp | contract.airtableData (JSON) |
| Fecha_prevista | Campo de fecha/timestamp | contract.fechaprevista |
| FECHA_RENOV_PREVISTA | Campo de fecha/timestamp | contract.airtableData (JSON) |
| FechaFacturaPenalizacion | Campo de fecha/timestamp | contract.fechaFacturaPenalizacion |
| Fee Excedentes (from PRODUCTOS) | fee €/MWh que se descuenta de precio omie a la hora de pagar excedentes fotovoltaicos si el cliente quiere precio indexado variable | contract.airtableData (JSON) |
| Fee Index (from PRODUCTOS) | fee que el cliente pagará soobre el precio de mercado de la energía si contrata suministro con producto indexado | contract.airtableData (JSON) |
| FEE Index Personalizado | fee indexado cuando se introduce manualmente al generar el contrato y no esstá predefinido para un producto concreto | contract.airtableData (JSON) |
| FEE_P | Pendiente de definir por el usuario | contract.fEEP |
| Field 198 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| FIJO / INDEX | F si cliente quiere suministro con producto de precio fijo o I indexado | contract.airtableData (JSON) |
| Fin Mes -1 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Fin Mes -2 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Fin Mes 0 | Pendiente de definir por el usuario | contract.finMes0 |
| Firma manuscrita | si el cliente no quiere envío por docusign o similar | contract.airtableData (JSON) |
| Firma_Man_Renov | Pendiente de definir por el usuario | contract.firmaManRenov |
| Forma de pago | pago por domiciliación o transferencia bancaria | contract.airtableData (JSON) |
| From field: ALTA_CONTRATO_ACTUAL | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| From field: Contrato Original | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| GAS INCLUIDO | Pendiente de definir por el usuario | contract.gASINCLUIDO |
| Generar Anexo M1 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Generar Borrador | Trigger: Botón/Checkbox que dispara el webhook de Make para generar el contrato | contract.airtableData (JSON) |
| Hora Actual | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| HORAS_USO_DIARIOS | Pendiente de definir por el usuario | contract.hORASUSODIARIOS |
| IBAN | Número de cuenta bancaria | client.iban |
| ID | Pendiente de definir por el usuario | contract.iD |
| ID Google Drive PDF | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Inicio Mes -1 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Inicio Mes -2 | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Inicio Mes 0 | Pendiente de definir por el usuario | contract.inicioMes0 |
| INICIO PROCESO | Pendiente de definir por el usuario | contract.iNICIOPROCESO |
| INICIO_PERMANENCIA | fecha de inicio del compromiso minimo de permanencia del contrato | contract.permanenceStartDate |
| INSTALACIONES_LINK | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| IP | Pendiente de definir por el usuario | contract.iP |
| IP P1 | €/kW/año que se incrementa la potencia en periodo P1 sobre el precio BOE regulado en caso de productos personalizados donde el usuario puede introducir el margen que quiera | contract.airtableData (JSON) |
| IP P2 | mismo pero para período P2 | contract.airtableData (JSON) |
| IP P3 | mismo pero p3 | contract.airtableData (JSON) |
| IP P4 | mismo pero p4 | contract.airtableData (JSON) |
| IP P5 | mismo pero p5 | contract.airtableData (JSON) |
| IP P6 | mismo pero p6 | contract.airtableData (JSON) |
| IVAPen | Pendiente de definir por el usuario | contract.iVAPen |
| LEADS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| LEADS copy | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| LINK TIPOS TARIFA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| M1 Activado | Pendiente de definir por el usuario | contract.m1Activado |
| M1 Rechazado | Pendiente de definir por el usuario | contract.m1Rechazado |
| M1N_SOLICITADO | Pendiente de definir por el usuario | contract.m1NSOLICITADO |
| M1S_SOLICITADO | Pendiente de definir por el usuario | contract.m1SSOLICITADO |
| Mail Activacion Enviado | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Mail Bienvenida Enviado | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| MANDATO DOBLE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| MARCA | código de la marca de la comercializadora, puede haber varias marcas dentro de un mismo cif de comercializadora | contract.airtableData (JSON) |
| Mensaje Distribuidora | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Mes Actual | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| MES ALTA | Pendiente de definir por el usuario | contract.mESALTA |
| MES BAJA | Pendiente de definir por el usuario | contract.mESBAJA |
| Meses Permanencia | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Min Actual | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Modalidad Autoconsumo (from Producto) | fijo o indexado para pago de excedentes | contract.airtableData (JSON) |
| Modalidad de contrato | fijo o indexado para venta de energía a cliente | contract.airtableData (JSON) |
| MODIFICACIONES | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| N Solicitud | Pendiente de definir por el usuario | contract.nSolicitud |
| NIF Contacto | nif del apoderado o representante de la empresa en caso de cliente persona juridica | client.contactVat |
| Nº CIE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Nombre completo Titular | Nombre o Razón social del cliente | client.businessName / lead.businessName |
| Nombre Contacto | nombre del apoderado o representante de la empresa en caso de cliente persona juridica sin incluir apellidos | client.contactName |
| Nombre Distribuidora | nombre distribuidora que distribuye energia al cups | contract.airtableData (JSON) |
| Nombre Instalación | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Nombre Wp | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| NOMBRE Y APELLIDOS | nombre y apellidos del apoderado o representante | client.contactName |
| NOMBRERAZON SOCIAL | nombre sin apellidos de persona física o razon oscial en caso de personas juridicas | client.businessName |
| Número Instalación | campo número de la dirección dl punto de suministro | supplyPoint.streetNumber |
| Número Titular | campo número de la dirección del titular del contrato, domicilio social | client.billingNumber |
| NumFacturaPenalizacion | Pendiente de definir por el usuario | contract.numFacturaPenalizacion |
| Observaciones | observaciones introducidas manualmente por backoffice en el contrato para seguimiento | contract.internalComments |
| OCULTAR_RENOVACION | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| ODOO | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| OWNERS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| P1C | POTENCIA CONTRATADA  A LA GENERACION ED CONTRATO EN PERÍODO P1 | supplyPoint.p1c |
| P1C W | Datos de potencia o precios por periodo | Ignorado (Fórmula) |
| P1E (from PRODUCTOS) | precio de energía en período p1 | contract.airtableData (JSON) |
| P1P | PRECIO POTENCIA A LA GENERACIÓN DE CONTRATO EN PERIODO P1 | supplyPoint.p1p / contract.customP1P |
| P1P (from PRODUCTOS) | PRECIO POTENCIA DEL PRODUCTO A DÍA DE HOY EN PERIODO P1 | contract.airtableData (JSON) |
| P1PM | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy copy copy copy | Datos de potencia o precios por periodo | contract.airtableData (JSON) |
| P2C | POTENCIA CONTRATADA  A LA GENERACION ED CONTRATO EN PERÍODO P2 | supplyPoint.p2c |
| P2C W | Datos de potencia o precios por periodo | Ignorado (Fórmula) |
| P2E (from PRODUCTOS) | idem que p1 pero para este período | contract.airtableData (JSON) |
| P2P | PRECIO POTENCIA A LA GENERACIÓN DE CONTRATO EN PERIODO P2 | contract.airtableData (JSON) |
| P2P (from PRODUCTOS) | PRECIO POTENCIA DEL PRODUCTO A DÍA DE HOY EN PERIODO P2 | contract.airtableData (JSON) |
| P3C | POTENCIA CONTRATADA  A LA GENERACION ED CONTRATO EN PERÍODO P3 | supplyPoint.p3c |
| P3C W | Pendiente de definir por el usuario | Ignorado (Fórmula) |
| P3E (from PRODUCTOS) | idem que p1 pero para este período | contract.airtableData (JSON) |
| P3P | PRECIO POTENCIA A LA GENERACIÓN DE CONTRATO EN PERIODO P3 | contract.airtableData (JSON) |
| P3P (from PRODUCTOS) | PRECIO POTENCIA DEL PRODUCTO A DÍA DE HOY EN PERIODO P3 | contract.airtableData (JSON) |
| P4C | POTENCIA CONTRATADA  A LA GENERACION ED CONTRATO EN PERÍODO P4 | supplyPoint.p4c |
| P4C W | Pendiente de definir por el usuario | Ignorado (Fórmula) |
| P4E (from PRODUCTOS) | idem que p1 pero para este período | contract.airtableData (JSON) |
| P4P | PRECIO POTENCIA A LA GENERACIÓN DE CONTRATO EN PERIODO P4 | contract.airtableData (JSON) |
| P4P (from PRODUCTOS) | PRECIO POTENCIA DEL PRODUCTO A DÍA DE HOY EN PERIODO P4 | contract.airtableData (JSON) |
| P5C | POTENCIA CONTRATADA  A LA GENERACION ED CONTRATO EN PERÍODO P5 | supplyPoint.p5c |
| P5C W | Pendiente de definir por el usuario | Ignorado (Fórmula) |
| P5E (from PRODUCTOS) | idem que p1 pero para este período | contract.airtableData (JSON) |
| P5P | PRECIO POTENCIA A LA GENERACIÓN DE CONTRATO EN PERIODO P5 | contract.airtableData (JSON) |
| P5P (from PRODUCTOS) | PRECIO POTENCIA DEL PRODUCTO A DÍA DE HOY EN PERIODO P5 | contract.airtableData (JSON) |
| P6C | POTENCIA CONTRATADA  A LA GENERACION ED CONTRATO EN PERÍODO P6 | supplyPoint.p6c |
| P6C W copy | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| P6E (from PRODUCTOS) | idem que p1 pero para este período | contract.airtableData (JSON) |
| P6P | PRECIO POTENCIA A LA GENERACIÓN DE CONTRATO EN PERIODO P6 | contract.airtableData (JSON) |
| P6P (from PRODUCTOS) | PRECIO POTENCIA DEL PRODUCTO A DÍA DE HOY EN PERIODO P6 | contract.airtableData (JSON) |
| País Titular | país del titular del contrato | contract.airtableData (JSON) |
| PDF Anexo firmado | FICHERO PDF DEL ANEXO FIRMADO POR EL CLIENTE | contract.airtableData (JSON) |
| PDF Borrador Verificado | Control de automatización: Confirmación de borrador de contrato correcto | contract.airtableData (JSON) |
| PDF Contrato firmado | FICHERO PDF DEL CONTRATO FIRMADO POR EL CLIENTE | contract.airtableData (JSON) |
| PDF Contrato Verificado | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| PEN 2.0TD RESID | Pendiente de definir por el usuario | contract.pEN20TDRESID |
| PEN 2.0TD RESID HOY | Pendiente de definir por el usuario | contract.pEN20TDRESIDHOY |
| PEN NO RESID | Pendiente de definir por el usuario | contract.pENNORESID |
| PENALIZACION | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| PENALIZACION ESTIMADA | Pendiente de definir por el usuario | contract.pENALIZACIONESTIMADA |
| Penalizacion Facturada | Pendiente de definir por el usuario | contract.penalizacionFacturada |
| PENALIZACION_HOY | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Peticion_cliente_c2 | Pendiente de definir por el usuario | contract.peticionclientec2 |
| PExc | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| PExc (from PRODUCTOS) | precio excednte del producto aplicado al lead | contract.airtableData (JSON) |
| PLUS | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Población Instalación | población del punto de suministro | supplyPoint.city |
| POBLACION SOC | población del titular del contrato | client.billingCity |
| POBLACION_CONT | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| POTENCIA BOE | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| POTENCIAS DISTRI | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Precio (from SERVICIOS) | precio del servicio asignado al lead | contract.airtableData (JSON) |
| Primer Apellido | primer apellido del titular del contrato si es persona física | client.firstName |
| Producto | producto seleccionado para el lead | contract.airtableData (JSON) |
| Producto y Servicio | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| PRODUCTO_RENOVACION | Pendiente de definir por el usuario | contract.pRODUCTORENOVACION |
| ProductoLINK | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| PROV LINK | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Provincia Instalación | provincia del punto de suministro | supplyPoint.province |
| PROVINCIA SOC | provincia del titular del contrato | client.billingProvince |
| PROVINCIA_CONT | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| PROYECCION_ANUAL | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Record ID | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| ref_cat | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| RENOVACION | Pendiente de definir por el usuario | contract.rENOVACION |
| RENOVACION_SOLICITADA | Pendiente de definir por el usuario | contract.rENOVACIONSOLICITADA |
| RENOVACION_TRAMITADA | Pendiente de definir por el usuario | contract.rENOVACIONTRAMITADA |
| Renovar | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| RETRASO | Pendiente de definir por el usuario | contract.rETRASO |
| Segundo Apellido | segundo apellido del titular del contrato si es persona física | client.lastName |
| Servicio | servicio asignado al lead | contract.airtableData (JSON) |
| SERVICIO_RENOVACION | Pendiente de definir por el usuario | contract.sERVICIORENOVACION |
| SIN COMISION | Pendiente de definir por el usuario | contract.sINCOMISION |
| SIN DECOMISION | Pendiente de definir por el usuario | contract.sINDECOMISION |
| SIN PENALIZACION | Pendiente de definir por el usuario | contract.sINPENALIZACION |
| Softr Tlfn | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| SUSPENDIDO | Pendiente de definir por el usuario | contract.sUSPENDIDO |
| SVA AÑADIDO TERA | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| SWIFT | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Tarifa | Tarifa de acceso (ej. 2.0TD) | supplyPoint.tariff |
| Teléfono Contacto | teléfoo de contacto del titular del contrato | contract.airtableData (JSON) |
| Telegestion | Pendiente de definir por el usuario | contract.telegestion |
| Tipo | código del tipo de tramitación a realizar si se firma el contrato: R, A3, C1, C2, M1, … | contract.tipo |
| Tipo de firma | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Tipo de numeración Instalación | tipo de numeración del punto de suministro, por ejemplo NUM, KM, S/N, etc | contract.airtableData (JSON) |
| Tipo de numeración Titular | tipo de numeración de la dirección del titular del contrato, por ejemplo NUM, KM, S/N, etc | contract.airtableData (JSON) |
| Tipo de persona | F física o J jurídica | client.clientType |
| Tipo de producto | fijo, index, etc… según seleccione el usuario al crear el lead | contract.airtableData (JSON) |
| Tipo de producto (from Producto) | fijo, index, etc… del producto seleccionado para generar contrato | contract.airtableData (JSON) |
| Tipo de vía Instalación | tipo de vía de la dirección del punto de suministro: calle, avenida, etc… | supplyPoint.streetType |
| Tipo de vía Titular | tipo de vía de la dirección del titular del contrato: calle, avenida, etc… | client.billingStreetType |
| Tipo Identificador | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Tipo Sol Admin | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| TIpo_c2 | si el tipo es M1, aquí se indica si se trata de modificación administrativa (S), técnica (N) o ambas (A) | contract.tIpoc2 |
| Tipo_de_cliente | F persona física o J persona jurídica | contract.airtableData (JSON) |
| Tipo_entrada | Pendiente de definir por el usuario | contract.tipoentrada |
| TIPO_ENVIO_FACTURA_RENOV | Pendiente de definir por el usuario | contract.tIPOENVIOFACTURARENOV |
| Tipo_Sop | enlaza tipo con tipo_c2para tener visión completa del tipode tramitación realizada con el contrato | contract.airtableData (JSON) |
| TipoPM | Pendiente de definir por el usuario | contract.tipoPM |
| TLF | teléfoo de contacto del titular del contrato | client.contactPhone |
| TLF COMER | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| TLF_2 | teléfoo de contacto del titular del contrato | client.contactPhone2 |
| TLF_3 | teléfoo de contacto del titular del contrato | client.contactPhone3 |
| Tramitación a realizar | tipo de tramitación a realizar si se firma el contrato: alta nueva, cambio de comercializadora, modificación, etc… | contract.tramitationType |
| Tramitación LINK | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| Tramitar | Pendiente de definir por el usuario | contract.airtableData (JSON) |
| transferencia | Pendiente de definir por el usuario | contract.transferencia |
| ULT DIA A FACTURAR | Pendiente de definir por el usuario | contract.uLTDIAAFACTURAR |
| ULT DIA FACT | Pendiente de definir por el usuario | contract.uLTDIAFACT |
| ULTIMO DIA FACTURADO | Pendiente de definir por el usuario | contract.uLTIMODIAFACTURADO |
| UN PRECIO | Pendiente de definir por el usuario | contract.uNPRECIO |
| Version | Pendiente de definir por el usuario | contract.version |


# diccionario_facturas.xlsx

| Nombre Airtable | Descripción / Significado | Campo Equivalente PostgreSQL |
| --- | --- | --- |
| Subtotal 1 | (IA) Base imponible de la factura (antes de IVA y otros conceptos) | invoice.subtotal1 |
| Subtotal 2 | (IA) Base imponible de la factura (antes de IVA) | invoice.subtotal2 |
| Subtotal Otros Concepto | (IA) Base imponible de la factura (antes de IVA) | invoice.subtotalOtrosConcepto |
| Importe Bono Social | (IA) Financiación del Bono Social Eléctrico aplicado al cliente | invoice.importeBonoSocial |
| Importe Bono Social CORR | (IA) Financiación del Bono Social Eléctrico aplicado al cliente aplicando corrección para facturas tipo abono | invoice.importeBonoSocialCORR |
| Importe IVA | (IA) Importe correspondiente al Impuesto sobre el Valor Añadido (21%, 10% o 5% según legislación vigente) | invoice.importeIVA |
| Importe IVA 10 | (IA) Importe correspondiente al Impuesto sobre el Valor Añadido (solo IVA aplicado al 10%) | invoice.importeIVA10 |
| Importe IVA 21 | (IA) Importe correspondiente al Impuesto sobre el Valor Añadido (solo IVA aplicado al 21%) | invoice.importeIVA21 |
| Importe IVA 5 | (IA) Importe correspondiente al Impuesto sobre el Valor Añadido (solo IVA aplicado al 5%) | invoice.importeIVA5 |
| Importe Aplicable Compensacion Excedentes | (IA) Importe descontado al cliente por la compensación de excedentes (limitado por el valor de la energía consumida) | invoice.importeAplicableCompensacionExcedentes |
| Importe Potencia Factura | (IA) Importe total facturado por el término fijo de potencia (suma de todos los periodos) | invoice.importePotenciaFactura |
| Importe Potencia ATR | (IA) Importe total facturado por el término fijo de potencia sin incluir margen comercializadora, solo peajes y cargos regulados (suma de todos los periodos) | invoice.importePotenciaATR |
| Importe Energia Factura | (IA) Importe total facturado por el término variable de energía consumida (suma de periodos) | invoice.importeEnergiaFactura |
| Importe Energia sin Margen | (IA) Importe total facturado por el término variable de energía consumida sin incluir margen comercial, solo coste comercializadora (suma de periodos) | invoice.importeEnergiasinMargen |
| Importe Energia ATR | (IA) Importe total facturado por peajes y cargos regulados por el término variable de energía consumida (suma de periodos) | invoice.importeEnergiaATR |
| BaseImponibleF1 | base imponible del f1 (factura) emitida por distribuidora a partir de la cual se ha calculado factura emitida a cliente | invoice.baseImponibleF1 |
| Base Imponible 0 | base imponible sujeta a iva 0% | invoice.baseImponible0 |
| Base Imponible 10 | base imponible sujeta a iva 10% | invoice.baseImponible10 |
| Base Imponible 21 | base imponible sujeta a iva 21% | invoice.baseImponible21 |
| Base Imponible 5 | base imponible sujeta a iva 5% | invoice.baseImponible5 |
| Base Imponible IVA | base imponible sujeta a iva total | invoice.baseImponibleIVA |
| Base Imponible IVA CORR | base imponible sujeta a iva total corregida cuando se trata de facturas tipo abono, pues el proveedor no pone correctamente el signo (aplica esto a todos los campos que pone CORR) | invoice.baseImponibleIVACORR |
| BI Subtotal 1 CORR | calculo parcial de base imponible corregida en tipo abono | invoice.bISubtotal1CORR |
| Fecha Cobro | Campo de fecha/timestamp | invoice.fechaCobro |
| FechaFtra_NumFtra | Campo de fecha/timestamp | invoice.fechaFtraNumFtra |
| Codigo Contrato | código del contrato existnte entre titular del cups y distribuidora (contrato atr) | invoice.codigoContrato |
| CUPS | Código Universal del Punto de Suministro | supplyPoint.cups |
| Contrato | contrato asociado a la factura emitida | invoice.contrato |
| Contrato2 | contrato asociado a la factura emitida | invoice.contrato2 |
| Alquiler Equipo de Medida | coste alquiler equipo de medida repercutido por distribuidora y facturado ac liente | invoice.alquilerEquipodeMedida |
| Codigo Factura Rectificada Anulada | cuando se trate de factura rectificativa, aquí se indica la factura previa que se está anulando/abonando | invoice.codigoFacturaRectificadaAnulada |
| Excedentes P1 Autoconsumo | Datos de potencia o precios por periodo | invoice.excedentesP1Autoconsumo |
| Excedentes P2 Autoconsumo | Datos de potencia o precios por periodo | invoice.excedentesP2Autoconsumo |
| Importe AE P1 | Datos de potencia o precios por periodo | invoice.importeAEP1 |
| Importe AE P2 | Datos de potencia o precios por periodo | invoice.importeAEP2 |
| Importe Exceso PM P1 | Datos de potencia o precios por periodo | invoice.importeExcesoPMP1 |
| Importe Exceso PM P2 | Datos de potencia o precios por periodo | invoice.importeExcesoPMP2 |
| Importe PM P1 | Datos de potencia o precios por periodo | invoice.importePMP1 |
| Importe PM P2 | Datos de potencia o precios por periodo | invoice.importePMP2 |
| Importe Ponderado ATR Energia P1 | Datos de potencia o precios por periodo | invoice.importePonderadoATREnergiaP1 |
| Importe Ponderado ATR Energia P2 | Datos de potencia o precios por periodo | invoice.importePonderadoATREnergiaP2 |
| Importe Ponderado ATR Potencia P1 | Datos de potencia o precios por periodo | invoice.importePonderadoATRPotenciaP1 |
| Importe Ponderado ATR Potencia P2 | Datos de potencia o precios por periodo | invoice.importePonderadoATRPotenciaP2 |
| Importe Ponderado Cargos Energia P1 | Datos de potencia o precios por periodo | invoice.importePonderadoCargosEnergiaP1 |
| Importe Ponderado Cargos Energia P2 | Datos de potencia o precios por periodo | invoice.importePonderadoCargosEnergiaP2 |
| Importe Ponderado Cargos Potencia P1 | Datos de potencia o precios por periodo | invoice.importePonderadoCargosPotenciaP1 |
| Importe Ponderado Cargos Potencia P2 | Datos de potencia o precios por periodo | invoice.importePonderadoCargosPotenciaP2 |
| Importe Ponderado Peajes Energia P1 | Datos de potencia o precios por periodo | invoice.importePonderadoPeajesEnergiaP1 |
| Importe Ponderado Peajes Energia P2 | Datos de potencia o precios por periodo | invoice.importePonderadoPeajesEnergiaP2 |
| Importe Ponderado Peajes Potencia P1 | Datos de potencia o precios por periodo | invoice.importePonderadoPeajesPotenciaP1 |
| Importe Ponderado Peajes Potencia P2 | Datos de potencia o precios por periodo | invoice.importePonderadoPeajesPotenciaP2 |
| Importe R1 P1 | Datos de potencia o precios por periodo | invoice.importeR1P1 |
| Importe R1 P2 | Datos de potencia o precios por periodo | invoice.importeR1P2 |
| Lectura Desde AE P1 | Datos de potencia o precios por periodo | invoice.lecturaDesdeAEP1 |
| Lectura Desde AE P2 | Datos de potencia o precios por periodo | invoice.lecturaDesdeAEP2 |
| Lectura Desde R1 P1 | Datos de potencia o precios por periodo | invoice.lecturaDesdeR1P1 |
| Lectura Desde R1 P2 | Datos de potencia o precios por periodo | invoice.lecturaDesdeR1P2 |
| Lectura Hasta AE P1 | Datos de potencia o precios por periodo | invoice.lecturaHastaAEP1 |
| Lectura Hasta AE P2 | Datos de potencia o precios por periodo | invoice.lecturaHastaAEP2 |
| Lectura Hasta R1 P1 | Datos de potencia o precios por periodo | invoice.lecturaHastaR1P1 |
| Lectura Hasta R1 P2 | Datos de potencia o precios por periodo | invoice.lecturaHastaR1P2 |
| P1 Potencia Contratada | Datos de potencia o precios por periodo | invoice.p1PotenciaContratada |
| P1 Potencia Max Demanda | Datos de potencia o precios por periodo | invoice.p1PotenciaMaxDemanda |
| P1EM | Datos de potencia o precios por periodo | invoice.p1EM |
| P1PM | Datos de potencia o precios por periodo | invoice.p1PM |
| P2 Potencia Contratada | Datos de potencia o precios por periodo | invoice.p2PotenciaContratada |
| P2 Potencia Max Demanda | Datos de potencia o precios por periodo | invoice.p2PotenciaMaxDemanda |
| P2EM | Datos de potencia o precios por periodo | invoice.p2EM |
| P2P | Datos de potencia o precios por periodo | invoice.p2P |
| P2PM | Datos de potencia o precios por periodo | invoice.p2PM |
| Potencia a Facturar P1 | Datos de potencia o precios por periodo | invoice.potenciaaFacturarP1 |
| Potencia a Facturar P2 | Datos de potencia o precios por periodo | invoice.potenciaaFacturarP2 |
| Precio Ponderado ATR Energia P1 | Datos de potencia o precios por periodo | invoice.precioPonderadoATREnergiaP1 |
| Precio Ponderado ATR Energia P2 | Datos de potencia o precios por periodo | invoice.precioPonderadoATREnergiaP2 |
| Precio Ponderado ATR Potencia P1 | Datos de potencia o precios por periodo | invoice.precioPonderadoATRPotenciaP1 |
| Precio Ponderado ATR Potencia P2 | Datos de potencia o precios por periodo | invoice.precioPonderadoATRPotenciaP2 |
| Precio Ponderado Cargos Energia P1 | Datos de potencia o precios por periodo | invoice.precioPonderadoCargosEnergiaP1 |
| Precio Ponderado Cargos Energia P2 | Datos de potencia o precios por periodo | invoice.precioPonderadoCargosEnergiaP2 |
| Precio Ponderado Cargos Potencia P1 | Datos de potencia o precios por periodo | invoice.precioPonderadoCargosPotenciaP1 |
| Precio Ponderado Cargos Potencia P2 | Datos de potencia o precios por periodo | invoice.precioPonderadoCargosPotenciaP2 |
| Precio Ponderado Peajes Energia P1 | Datos de potencia o precios por periodo | invoice.precioPonderadoPeajesEnergiaP1 |
| Precio Ponderado Peajes Energia P2 | Datos de potencia o precios por periodo | invoice.precioPonderadoPeajesEnergiaP2 |
| Precio Ponderado Peajes Potencia P1 | Datos de potencia o precios por periodo | invoice.precioPonderadoPeajesPotenciaP1 |
| Precio Ponderado Peajes Potencia P2 | Datos de potencia o precios por periodo | invoice.precioPonderadoPeajesPotenciaP2 |
| Descuento Bolsillo Solar | descuento aplciado a la factura sobre el total por tener saldo en la batería virtual / bolsillo solar | invoice.descuentoBolsilloSolar |
| Dias | diastotales facturados en el ciclo | invoice.dias |
| Dias CORR | diastotales facturados en el ciclo aplicando corrección para facturas tipo abono | invoice.diasCORR |
| DOMICILIO PS COMPLETO | dirección completa del punto de suministro | invoice.dOMICILIOPSCOMPLETO |
| Email AtCliente | Dirección de correo electrónico | invoice.emailAtCliente |
| Email Comercial (from Contrato) | Dirección de correo electrónico | invoice.airtableData (JSON) |
| Email Contacto 2 | Dirección de correo electrónico | invoice.emailContacto2 |
| Email Contacto 3 | Dirección de correo electrónico | invoice.emailContacto3 |
| Email Emisora | Dirección de correo electrónico | invoice.emailEmisora |
| Email Gerente (from Contrato) | Dirección de correo electrónico | invoice.airtableData (JSON) |
| Email Sup Canal (from Contrato) | Dirección de correo electrónico | invoice.airtableData (JSON) |
| DOMICILIO PS | dirección del punto de suministro | invoice.dOMICILIOPS |
| DOMICILIO SOC | dirección del titular del contrato | invoice.dOMICILIOSOC |
| Domicilio Titular | dirección del titular del contrato | invoice.domicilioTitular |
| E-mail envío de la factura | email al que debe enviarse la factura | invoice.eMailEnvODeLaFactura |
| Email Contacto | Email de comunicación | invoice.emailContacto |
| P1 Energia Activa Consumida | energía activa consumida en p1 | invoice.p1EnergiaActivaConsumida |
| P2 Energia Activa Consumida | energía activa consumida en p2 | invoice.p2EnergiaActivaConsumida |
| P3 Energia Activa Consumida | energía activa consumida en p3 | invoice.p3EnergiaActivaConsumida |
| P4 Energia Activa Consumida | energía activa consumida en p4 | invoice.p4EnergiaActivaConsumida |
| P5 Energia Activa Consumida | energía activa consumida en p5 | invoice.p5EnergiaActivaConsumida |
| P6 Energia Activa Consumida | energía activa consumida en p6 | invoice.p6EnergiaActivaConsumida |
| P1 Energia Reactiva Consumida | energía reactiva consumida en p1 | invoice.p1EnergiaReactivaConsumida |
| P2 Energia Reactiva Consumida | energía reactiva consumida en p2 | invoice.p2EnergiaReactivaConsumida |
| P3 Energia Reactiva Consumida | energía reactiva consumida en p3 | invoice.p3EnergiaReactivaConsumida |
| P4 Energia Reactiva Consumida | energía reactiva consumida en p4 | invoice.p4EnergiaReactivaConsumida |
| P5 Energia Reactiva Consumida | energía reactiva consumida en p5 | invoice.p5EnergiaReactivaConsumida |
| P6 Energia Reactiva Consumida | energía reactiva consumida en p6 | invoice.p6EnergiaReactivaConsumida |
| Reactiva Total Consumida | energía reactiva total consumida según distribuidora en suma de todos los períodos | invoice.reactivaTotalConsumida |
| Fecha Factura | Fecha de emisión | invoice.issueDate |
| Fecha factura rectificada | Fecha de emisión de la factura que se rectifica en caso de que se trate de rectificativa | invoice.fechaFacturaRectificada |
| Fecha Fin Contrato | fecha en que finaliza el contrato asociado a la factura emitida | invoice.fechaFinContrato |
| Hasta(EA) | fecha final del ciclo facturado a efectos de energía consumida | invoice.hastaEA |
| Hasta | fecha final del ciclo facturado a efectos de potencia contratada | invoice.hasta |
| Desde(EA) | fecha inicial del ciclo facturado a efectos de energía consumida | invoice.desdeEA |
| Desde | fecha inicial del ciclo facturado a efectos de potencia contratada | invoice.desde |
| BaseImponibleF1 CORR | idem pero corregido en caso de abono | invoice.baseImponibleF1CORR |
| Importe Excedentes Autoconsumo | importe en euros de los excedentes a facturar si el cups tiene instalación fotovoltaica | invoice.importeExcedentesAutoconsumo |
| Total | Importe total a pagar | invoice.totalAmount |
| Total CORR | Importe total a pagar aplicando corrección en caso de rectificativa | invoice.totalCORR |
| P1C | kW potencia contratada facturdos en período p1 | supplyPoint.p1c |
| P2C | kW potencia contratada facturdos en período p2 | supplyPoint.p2c |
| P3C | kW potencia contratada facturdos en período p3 | supplyPoint.p3c |
| P4C | kW potencia contratada facturdos en período p4 | supplyPoint.p4c |
| P5C | kW potencia contratada facturdos en período p5 | supplyPoint.p5c |
| P6C | kW potencia contratada facturdos en período p6 | supplyPoint.p6c |
| Energía Total Consumida | kWh consumidos en el periodo | invoice.totalMWh |
| Cantidad Energía Total Consumida CORR | kWh consumidos en el periodo aplicando corrección en tipo abono | invoice.cantidadEnergATotalConsumidaCORR |
| Excedentes Autoconsumo a facturar | kWh excedentes a facturar si el cups tiene instalación fotovoltaica | invoice.excedentesAutoconsumoafacturar |
| NOMBRE COMPLETO | nombre completo del titular del contrato al que se factura | invoice.nOMBRECOMPLETO |
| Nombre Completo Titular | nombre completo del titular del contrato al que se factura | invoice.nombreCompletoTitular |
| DISTRIBUIDORA | nombre distribuidora asociada al cups facturado | invoice.dISTRIBUIDORA |
| NOMBRE/RAZON SOCIAL | nombre sin apellidos o razón social del titular del contrato al que se factura | invoice.nOMBRERAZONSOCIAL |
| IBAN | Número de cuenta bancaria | client.iban |
| Numero Factura | Número identificador de la factura | invoice.invoiceNumber |
| PDF | pdf con la factura del cliente | invoice.pDF |
| Importe Total Excesos ATR | penalizacióna plicada por distribuidora por los excesos de potencia demandada sobre contratada | invoice.importeTotalExcesosATR |
| Aviso Transf Pago Ftra | Pendiente de definir por el usuario | invoice.avisoTransfPagoFtra |
| Base 560 | Pendiente de definir por el usuario | invoice.base560 |
| Base Imponible Ayuntamiento | Pendiente de definir por el usuario | invoice.baseImponibleAyuntamiento |
| Base Imponible Tasa Municipal | Pendiente de definir por el usuario | invoice.baseImponibleTasaMunicipal |
| BOLSILLO SOLAR | Pendiente de definir por el usuario | invoice.bOLSILLOSOLAR |
| BUSCADOR | Pendiente de definir por el usuario | invoice.bUSCADOR |
| CALCULO MES-AÑO | Pendiente de definir por el usuario | invoice.cALCULOMESAO |
| CANAL | canala sociado al contrato facturado | invoice.cANAL |
| Carga Bolsillo Solar | importe en euros que se carga en bolsillo solar por no poderse aplicar en esta factura como descuento | invoice.cargaBolsilloSolar |
| CG | Pendiente de definir por el usuario | invoice.cG |
| CGM | Pendiente de definir por el usuario | invoice.cGM |
| CIF | cif receptor fatura | invoice.cIF |
| CIF Emisora | cif emisor factura, comercializadora | invoice.cIFEmisora |
| Ciudad | Pendiente de definir por el usuario | invoice.ciudad |
| Clase Factura | Pendiente de definir por el usuario | invoice.claseFactura |
| CNAE | cnae del cups | supplyPoint.cnae |
| Codigo Fiscal | codigo fiscal del f1 (factura) emitido por distribuidora y a partir del cual se emite factura al cliente | invoice.codigoFiscal |
| Codigo REE | codigo red eléctrica de distirbuidora asociada al cups | invoice.codigoREE |
| Comercializadora | Pendiente de definir por el usuario | invoice.comercializadora |
| Comision Costes de Gestion | Pendiente de definir por el usuario | invoice.comisionCostesdeGestion |
| Comision Gap Autoconsumo | Pendiente de definir por el usuario | invoice.comisionGapAutoconsumo |
| Comision Importe Excedentario | Pendiente de definir por el usuario | invoice.comisionImporteExcedentario |
| Comision Potencia Canal | Pendiente de definir por el usuario | invoice.comisionPotenciaCanal |
| Comision Precio Energia | Pendiente de definir por el usuario | invoice.comisionPrecioEnergia |
| Comision Precio Fijo Energia | Pendiente de definir por el usuario | invoice.comisionPrecioFijoEnergia |
| Comision Semiindexado Anual | Pendiente de definir por el usuario | invoice.comisionSemiindexadoAnual |
| Comision Total | Pendiente de definir por el usuario | invoice.comisionTotal |
| Comision Volumen Energia | Pendiente de definir por el usuario | invoice.comisionVolumenEnergia |
| Comunicar | Pendiente de definir por el usuario | invoice.comunicar |
| Concepto Repercutible | Pendiente de definir por el usuario | invoice.conceptoRepercutible |
| Concepto Repercutible 1 | Pendiente de definir por el usuario | invoice.conceptoRepercutible1 |
| Concepto Repercutible 1 Numero | Pendiente de definir por el usuario | invoice.conceptoRepercutible1Numero |
| Concepto Repercutible 2 | Pendiente de definir por el usuario | invoice.conceptoRepercutible2 |
| Concepto Repercutible 2 Numero | Pendiente de definir por el usuario | invoice.conceptoRepercutible2Numero |
| Concepto Repercutible 3 | Pendiente de definir por el usuario | invoice.conceptoRepercutible3 |
| Concepto Repercutible 3 Numero | Pendiente de definir por el usuario | invoice.conceptoRepercutible3Numero |
| Concepto SVA | Pendiente de definir por el usuario | invoice.conceptoSVA |
| Correo postal enviado | Pendiente de definir por el usuario | invoice.correopostalenviado |
| Costes de Gestión | Pendiente de definir por el usuario | invoice.costesDeGestiN |
| Costes de Gestion Bolsillo Solar | Pendiente de definir por el usuario | invoice.costesdeGestionBolsilloSolar |
| CP Emisora | codigo postal de emisor factura | invoice.cPEmisora |
| CP PS | codigo postal punto de suministro | invoice.cPPS |
| CP SOC | codigo postal titular del contrato | invoice.cPSOC |
| Cuota Importe Impuesto CORR | Pendiente de definir por el usuario | invoice.cuotaImporteImpuestoCORR |
| Derechos Garantía | Pendiente de definir por el usuario | invoice.derechosGarantA |
| Desde(ER) | fecha inicio ciclo facturado a efectos de energia reactiva | invoice.desdeER |
| Desde(P) | fecha inicio ciclo facturado a efectos de potencia | invoice.desdeP |
| DIAS PAGO | Pendiente de definir por el usuario | invoice.dIASPAGO |
| Días SVA | Pendiente de definir por el usuario | invoice.dAsSVA |
| Direccion Emisora | dirección fiscal de emisor factura, comercializadora | invoice.direccionEmisora |
| Disponibilidad Lectura | Pendiente de definir por el usuario | invoice.disponibilidadLectura |
| DSV | Pendiente de definir por el usuario | invoice.dSV |
| DSVM | Pendiente de definir por el usuario | invoice.dSVM |
| Duracion | Pendiente de definir por el usuario | invoice.duracion |
| Empresa Emisora | empresa emisora factura, comercializadora | invoice.empresaEmisora |
| Envío de factura (from Contrato) | Pendiente de definir por el usuario | invoice.airtableData (JSON) |
| Estado CONTRATO | Pendiente de definir por el usuario | invoice.estadoCONTRATO |
| Exc/Total | Pendiente de definir por el usuario | invoice.excTotal |
| Excedentes P3 Autoconsumo | Pendiente de definir por el usuario | invoice.excedentesP3Autoconsumo |
| Excedentes P4 Autoconsumo | Pendiente de definir por el usuario | invoice.excedentesP4Autoconsumo |
| Excedentes P5 Autoconsumo | Pendiente de definir por el usuario | invoice.excedentesP5Autoconsumo |
| Excedentes P6 Autoconsumo | Pendiente de definir por el usuario | invoice.excedentesP6Autoconsumo |
| FACTURA RECTIFICADA | Pendiente de definir por el usuario | invoice.fACTURARECTIFICADA |
| Facturado | Pendiente de definir por el usuario | invoice.facturado |
| FEE | fee aplicado en caso de contato indexado | invoice.fEE |
| FEEM | Pendiente de definir por el usuario | invoice.fEEM |
| FIJO / INDEX | producto fijo o indexado facturado | invoice.fIJOINDEX |
| Forma envío de la factura (from Código Contrato) | Pendiente de definir por el usuario | invoice.airtableData (JSON) |
| From field: FACTURA RECTIFICADA | Pendiente de definir por el usuario | invoice.fromFieldFACTURARECTIFICADA |
| GAP AUTOCONSUMO | Pendiente de definir por el usuario | invoice.gAPAUTOCONSUMO |
| GAS INCLUIDO | Pendiente de definir por el usuario | invoice.gASINCLUIDO |
| Hasta(ER) | fecha fin ciclo facturado a efectos de energia reactiva | invoice.hastaER |
| Hasta(P) | fecha fin ciclo facturado a efectos de potencia | invoice.hastaP |
| ID Google Drive PDF | Pendiente de definir por el usuario | invoice.iDGoogleDrivePDF |
| ID Google Drive XML | Pendiente de definir por el usuario | invoice.iDGoogleDriveXML |
| IE Odoo | Pendiente de definir por el usuario | invoice.iEOdoo |
| Importe AE P3 | Pendiente de definir por el usuario | invoice.importeAEP3 |
| Importe AE P4 | Pendiente de definir por el usuario | invoice.importeAEP4 |
| Importe AE P5 | Pendiente de definir por el usuario | invoice.importeAEP5 |
| Importe AE P6 | Pendiente de definir por el usuario | invoice.importeAEP6 |
| Importe Ahorro Cargos | Pendiente de definir por el usuario | invoice.importeAhorroCargos |
| Importe Ajuste Gas | Pendiente de definir por el usuario | invoice.importeAjusteGas |
| Importe almacenado Bolsillo Solar | Pendiente de definir por el usuario | invoice.importealmacenadoBolsilloSolar |
| Importe Cargo Energia Total | Pendiente de definir por el usuario | invoice.importeCargoEnergiaTotal |
| Importe Cargo Potencia Total | Pendiente de definir por el usuario | invoice.importeCargoPotenciaTotal |
| Importe Concepto Repercutible 1 | Pendiente de definir por el usuario | invoice.importeConceptoRepercutible1 |
| Importe Concepto Repercutible 2 | Pendiente de definir por el usuario | invoice.importeConceptoRepercutible2 |
| Importe Concepto Repercutible 3 | Pendiente de definir por el usuario | invoice.importeConceptoRepercutible3 |
| Importe Devolución | Pendiente de definir por el usuario | invoice.importeDevoluciN |
| Importe Excedentes Autoconsumo Aplicado | Pendiente de definir por el usuario | invoice.importeExcedentesAutoconsumoAplicado |
| Importe Exceso PM P3 | Pendiente de definir por el usuario | invoice.importeExcesoPMP3 |
| Importe Exceso PM P4 | Pendiente de definir por el usuario | invoice.importeExcesoPMP4 |
| Importe Exceso PM P5 | Pendiente de definir por el usuario | invoice.importeExcesoPMP5 |
| Importe Exceso PM P6 | Pendiente de definir por el usuario | invoice.importeExcesoPMP6 |
| Importe factura rectificada | Pendiente de definir por el usuario | invoice.importeFacturaRectificada |
| Importe Impuesto | Pendiente de definir por el usuario | invoice.importeImpuesto |
| Importe Impuesto CORR | Pendiente de definir por el usuario | invoice.importeImpuestoCORR |
| Importe Indemnización | Pendiente de definir por el usuario | invoice.importeIndemnizaciN |
| Importe Peajes AE | Pendiente de definir por el usuario | invoice.importePeajesAE |
| Importe Peajes PM | Pendiente de definir por el usuario | invoice.importePeajesPM |
| Importe Penalizaciones | Pendiente de definir por el usuario | invoice.importePenalizaciones |
| Importe PM P3 | Pendiente de definir por el usuario | invoice.importePMP3 |
| Importe PM P4 | Pendiente de definir por el usuario | invoice.importePMP4 |
| Importe PM P5 | Pendiente de definir por el usuario | invoice.importePMP5 |
| Importe PM P6 | Pendiente de definir por el usuario | invoice.importePMP6 |
| Importe Ponderado ATR Energia P3 | Pendiente de definir por el usuario | invoice.importePonderadoATREnergiaP3 |
| Importe Ponderado ATR Energia P4 | Pendiente de definir por el usuario | invoice.importePonderadoATREnergiaP4 |
| Importe Ponderado ATR Energia P5 | Pendiente de definir por el usuario | invoice.importePonderadoATREnergiaP5 |
| Importe Ponderado ATR Energia P6 | Pendiente de definir por el usuario | invoice.importePonderadoATREnergiaP6 |
| Importe Ponderado ATR Potencia P3 | Pendiente de definir por el usuario | invoice.importePonderadoATRPotenciaP3 |
| Importe Ponderado ATR Potencia P4 | Pendiente de definir por el usuario | invoice.importePonderadoATRPotenciaP4 |
| Importe Ponderado ATR Potencia P5 | Pendiente de definir por el usuario | invoice.importePonderadoATRPotenciaP5 |
| Importe Ponderado ATR Potencia P6 | Pendiente de definir por el usuario | invoice.importePonderadoATRPotenciaP6 |
| Importe Ponderado Cargos Energia | Pendiente de definir por el usuario | invoice.importePonderadoCargosEnergia |
| Importe Ponderado Cargos Energia P3 | Pendiente de definir por el usuario | invoice.importePonderadoCargosEnergiaP3 |
| Importe Ponderado Cargos Energia P4 | Pendiente de definir por el usuario | invoice.importePonderadoCargosEnergiaP4 |
| Importe Ponderado Cargos Energia P5 | Pendiente de definir por el usuario | invoice.importePonderadoCargosEnergiaP5 |
| Importe Ponderado Cargos Energia P6 | Pendiente de definir por el usuario | invoice.importePonderadoCargosEnergiaP6 |
| Importe Ponderado Cargos Potencia | Pendiente de definir por el usuario | invoice.importePonderadoCargosPotencia |
| Importe Ponderado Cargos Potencia P3 | Pendiente de definir por el usuario | invoice.importePonderadoCargosPotenciaP3 |
| Importe Ponderado Cargos Potencia P4 | Pendiente de definir por el usuario | invoice.importePonderadoCargosPotenciaP4 |
| Importe Ponderado Cargos Potencia P5 | Pendiente de definir por el usuario | invoice.importePonderadoCargosPotenciaP5 |
| Importe Ponderado Cargos Potencia P6 | Pendiente de definir por el usuario | invoice.importePonderadoCargosPotenciaP6 |
| Importe Ponderado Peajes Energia | Pendiente de definir por el usuario | invoice.importePonderadoPeajesEnergia |
| Importe Ponderado Peajes Energia P3 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesEnergiaP3 |
| Importe Ponderado Peajes Energia P4 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesEnergiaP4 |
| Importe Ponderado Peajes Energia P5 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesEnergiaP5 |
| Importe Ponderado Peajes Energia P6 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesEnergiaP6 |
| Importe Ponderado Peajes Potencia | Pendiente de definir por el usuario | invoice.importePonderadoPeajesPotencia |
| Importe Ponderado Peajes Potencia P3 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesPotenciaP3 |
| Importe Ponderado Peajes Potencia P4 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesPotenciaP4 |
| Importe Ponderado Peajes Potencia P5 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesPotenciaP5 |
| Importe Ponderado Peajes Potencia P6 | Pendiente de definir por el usuario | invoice.importePonderadoPeajesPotenciaP6 |
| Importe R1 P3 | Pendiente de definir por el usuario | invoice.importeR1P3 |
| Importe R1 P4 | Pendiente de definir por el usuario | invoice.importeR1P4 |
| Importe R1 P5 | Pendiente de definir por el usuario | invoice.importeR1P5 |
| Importe R1 P6 | Pendiente de definir por el usuario | invoice.importeR1P6 |
| Importe Total AE ATR | Pendiente de definir por el usuario | invoice.importeTotalAEATR |
| Importe Total Coberturas | Pendiente de definir por el usuario | invoice.importeTotalCoberturas |
| Importe Total Excesos ATR F1 | Pendiente de definir por el usuario | invoice.importeTotalExcesosATRF1 |
| Importe Total PM ATR | Pendiente de definir por el usuario | invoice.importeTotalPMATR |
| Importe Total R ATR | Pendiente de definir por el usuario | invoice.importeTotalRATR |
| Impuesto (%) | Pendiente de definir por el usuario | invoice.impuesto |
| Inicio Bolsillo Solar | Pendiente de definir por el usuario | invoice.inicioBolsilloSolar |
| INSTALACIONES | Pendiente de definir por el usuario | invoice.iNSTALACIONES |
| Lectura Desde AE P3 | Pendiente de definir por el usuario | invoice.lecturaDesdeAEP3 |
| Lectura Desde AE P4 | Pendiente de definir por el usuario | invoice.lecturaDesdeAEP4 |
| Lectura Desde AE P5 | Pendiente de definir por el usuario | invoice.lecturaDesdeAEP5 |
| Lectura Desde AE P6 | Pendiente de definir por el usuario | invoice.lecturaDesdeAEP6 |
| Lectura Desde R1 P3 | Pendiente de definir por el usuario | invoice.lecturaDesdeR1P3 |
| Lectura Desde R1 P4 | Pendiente de definir por el usuario | invoice.lecturaDesdeR1P4 |
| Lectura Desde R1 P5 | Pendiente de definir por el usuario | invoice.lecturaDesdeR1P5 |
| Lectura Desde R1 P6 | Pendiente de definir por el usuario | invoice.lecturaDesdeR1P6 |
| Lectura Hasta AE P3 | Pendiente de definir por el usuario | invoice.lecturaHastaAEP3 |
| Lectura Hasta AE P4 | Pendiente de definir por el usuario | invoice.lecturaHastaAEP4 |
| Lectura Hasta AE P5 | Pendiente de definir por el usuario | invoice.lecturaHastaAEP5 |
| Lectura Hasta AE P6 | Pendiente de definir por el usuario | invoice.lecturaHastaAEP6 |
| Lectura Hasta R1 P3 | Pendiente de definir por el usuario | invoice.lecturaHastaR1P3 |
| Lectura Hasta R1 P4 | Pendiente de definir por el usuario | invoice.lecturaHastaR1P4 |
| Lectura Hasta R1 P5 | Pendiente de definir por el usuario | invoice.lecturaHastaR1P5 |
| Lectura Hasta R1 P6 | Pendiente de definir por el usuario | invoice.lecturaHastaR1P6 |
| Mail enviado | Pendiente de definir por el usuario | invoice.mailenviado |
| MARCA | Pendiente de definir por el usuario | invoice.mARCA |
| Margen Energia | Pendiente de definir por el usuario | invoice.margenEnergia |
| Margen Estimado | Pendiente de definir por el usuario | invoice.margenEstimado |
| Margen Excesos | Pendiente de definir por el usuario | invoice.margenExcesos |
| Margen Factura | Pendiente de definir por el usuario | invoice.margenFactura |
| MARGEN FACTURA CORR | margen calculado por proveedor de facturacion para la factura emitida total | invoice.mARGENFACTURACORR |
| MARGEN FACTURA DASHBOARD | Pendiente de definir por el usuario | invoice.mARGENFACTURADASHBOARD |
| MARGEN FTRA RECTIFICADA | Pendiente de definir por el usuario | invoice.mARGENFTRARECTIFICADA |
| Margen Potencia | Pendiente de definir por el usuario | invoice.margenPotencia |
| Margen Rel Ingebau | Pendiente de definir por el usuario | invoice.margenRelIngebau |
| MES-AÑO | Pendiente de definir por el usuario | invoice.mESAO |
| Minimo Importe IE Superado | Pendiente de definir por el usuario | invoice.minimoImporteIESuperado |
| Modo Control Potencia | Pendiente de definir por el usuario | invoice.modoControlPotencia |
| Mostrar_Web | Pendiente de definir por el usuario | invoice.mostrarWeb |
| Motivo Factura | Pendiente de definir por el usuario | invoice.motivoFactura |
| Nombre Producto (from Contrato) | Pendiente de definir por el usuario | invoice.airtableData (JSON) |
| Numero Dias Alquiler 1 | Pendiente de definir por el usuario | invoice.numeroDiasAlquiler1 |
| Numero Dias Alquiler 2 | Pendiente de definir por el usuario | invoice.numeroDiasAlquiler2 |
| Numero Dias Alquiler 3 | Pendiente de definir por el usuario | invoice.numeroDiasAlquiler3 |
| Numero Dias Alquiler 4 | Pendiente de definir por el usuario | invoice.numeroDiasAlquiler4 |
| Numero Factura .pdf | Pendiente de definir por el usuario | invoice.airtableData (JSON) |
| Numero Factura .xml | Pendiente de definir por el usuario | invoice.airtableData (JSON) |
| Numero factura rectificada | Pendiente de definir por el usuario | invoice.numeroFacturaRectificada |
| Numero Serie | Pendiente de definir por el usuario | invoice.numeroSerie |
| OMIE Promedio MAH | Pendiente de definir por el usuario | invoice.oMIEPromedioMAH |
| output_pdf | Pendiente de definir por el usuario | invoice.outputPdf |
| P3 Potencia Contratada | Pendiente de definir por el usuario | invoice.p3PotenciaContratada |
| P3 Potencia Max Demanda | Pendiente de definir por el usuario | invoice.p3PotenciaMaxDemanda |
| P3EM | Pendiente de definir por el usuario | invoice.p3EM |
| P3P | Pendiente de definir por el usuario | invoice.p3P |
| P3PM | Pendiente de definir por el usuario | invoice.p3PM |
| P4 Potencia Contratada | Pendiente de definir por el usuario | invoice.p4PotenciaContratada |
| P4 Potencia Max Demanda | Pendiente de definir por el usuario | invoice.p4PotenciaMaxDemanda |
| P4EM | Pendiente de definir por el usuario | invoice.p4EM |
| P4P | Pendiente de definir por el usuario | invoice.p4P |
| P4PM | Pendiente de definir por el usuario | invoice.p4PM |
| P5 Potencia Contratada | Pendiente de definir por el usuario | invoice.p5PotenciaContratada |
| P5 Potencia Max Demanda | Pendiente de definir por el usuario | invoice.p5PotenciaMaxDemanda |
| P5EM | Pendiente de definir por el usuario | invoice.p5EM |
| P5P | Pendiente de definir por el usuario | invoice.p5P |
| P5PM | Pendiente de definir por el usuario | invoice.p5PM |
| P6 Potencia Contratada | Pendiente de definir por el usuario | invoice.p6PotenciaContratada |
| P6 Potencia Max Demanda | Pendiente de definir por el usuario | invoice.p6PotenciaMaxDemanda |
| P6EM | Pendiente de definir por el usuario | invoice.p6EM |
| P6P | Pendiente de definir por el usuario | invoice.p6P |
| P6PM | Pendiente de definir por el usuario | invoice.p6PM |
| PATH | Pendiente de definir por el usuario | invoice.pATH |
| pdf_co_output | Pendiente de definir por el usuario | invoice.pdfCoOutput |
| Penalizacion No ICP | Pendiente de definir por el usuario | invoice.penalizacionNoICP |
| PEX | Pendiente de definir por el usuario | invoice.pEX |
| POBLACION PS | población del punto de suministro | invoice.pOBLACIONPS |
| POBLACION SOC | población del punto de titular de contrato | invoice.pOBLACIONSOC |
| Porcentaje Perdidas | Pendiente de definir por el usuario | invoice.porcentajePerdidas |
| Porcetaje Reduccion Cargos | Pendiente de definir por el usuario | invoice.porcetajeReduccionCargos |
| Potencia a Facturar P3 | Pendiente de definir por el usuario | invoice.potenciaaFacturarP3 |
| Potencia a Facturar P4 | Pendiente de definir por el usuario | invoice.potenciaaFacturarP4 |
| Potencia a Facturar P5 | Pendiente de definir por el usuario | invoice.potenciaaFacturarP5 |
| Potencia a Facturar P6 | Pendiente de definir por el usuario | invoice.potenciaaFacturarP6 |
| POTENCIA BOE | Pendiente de definir por el usuario | invoice.pOTENCIABOE |
| POTENCIAS DISTRI | Pendiente de definir por el usuario | invoice.pOTENCIASDISTRI |
| Precio Concepto Repercutible 1 | Pendiente de definir por el usuario | invoice.precioConceptoRepercutible1 |
| Precio Concepto Repercutible 2 | Pendiente de definir por el usuario | invoice.precioConceptoRepercutible2 |
| Precio Concepto Repercutible 3 | Pendiente de definir por el usuario | invoice.precioConceptoRepercutible3 |
| Precio Dia Alquiler 1 | Pendiente de definir por el usuario | invoice.precioDiaAlquiler1 |
| Precio Dia Alquiler 2 | Pendiente de definir por el usuario | invoice.precioDiaAlquiler2 |
| Precio Dia Alquiler 3 | Pendiente de definir por el usuario | invoice.precioDiaAlquiler3 |
| Precio Dia Alquiler 4 | Pendiente de definir por el usuario | invoice.precioDiaAlquiler4 |
| Precio Mix | Pendiente de definir por el usuario | invoice.precioMix |
| Precio Ponderado ATR Energia P3 | Pendiente de definir por el usuario | invoice.precioPonderadoATREnergiaP3 |
| Precio Ponderado ATR Energia P4 | Pendiente de definir por el usuario | invoice.precioPonderadoATREnergiaP4 |
| Precio Ponderado ATR Energia P5 | Pendiente de definir por el usuario | invoice.precioPonderadoATREnergiaP5 |
| Precio Ponderado ATR Energia P6 | Pendiente de definir por el usuario | invoice.precioPonderadoATREnergiaP6 |
| Precio Ponderado ATR Potencia P3 | Pendiente de definir por el usuario | invoice.precioPonderadoATRPotenciaP3 |
| Precio Ponderado ATR Potencia P4 | Pendiente de definir por el usuario | invoice.precioPonderadoATRPotenciaP4 |
| Precio Ponderado ATR Potencia P5 | Pendiente de definir por el usuario | invoice.precioPonderadoATRPotenciaP5 |
| Precio Ponderado ATR Potencia P6 | Pendiente de definir por el usuario | invoice.precioPonderadoATRPotenciaP6 |
| Precio Ponderado Cargos Energia P3 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosEnergiaP3 |
| Precio Ponderado Cargos Energia P4 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosEnergiaP4 |
| Precio Ponderado Cargos Energia P5 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosEnergiaP5 |
| Precio Ponderado Cargos Energia P6 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosEnergiaP6 |
| Precio Ponderado Cargos Potencia P3 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosPotenciaP3 |
| Precio Ponderado Cargos Potencia P4 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosPotenciaP4 |
| Precio Ponderado Cargos Potencia P5 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosPotenciaP5 |
| Precio Ponderado Cargos Potencia P6 | Pendiente de definir por el usuario | invoice.precioPonderadoCargosPotenciaP6 |
| Precio Ponderado Peajes Energia P3 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesEnergiaP3 |
| Precio Ponderado Peajes Energia P4 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesEnergiaP4 |
| Precio Ponderado Peajes Energia P5 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesEnergiaP5 |
| Precio Ponderado Peajes Energia P6 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesEnergiaP6 |
| Precio Ponderado Peajes Potencia P3 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesPotenciaP3 |
| Precio Ponderado Peajes Potencia P4 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesPotenciaP4 |
| Precio Ponderado Peajes Potencia P5 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesPotenciaP5 |
| Precio Ponderado Peajes Potencia P6 | Pendiente de definir por el usuario | invoice.precioPonderadoPeajesPotenciaP6 |
| Precio unitario SVA | Pendiente de definir por el usuario | invoice.precioUnitarioSVA |
| Propiedad Excedentes | Pendiente de definir por el usuario | invoice.propiedadExcedentes |
| Provincia | Pendiente de definir por el usuario | invoice.provincia |
| PROVINCIA PS | provincia del punto de suministro | invoice.pROVINCIAPS |
| PROVINCIA SOC | provincia del titular del contrato | invoice.pROVINCIASOC |
| RecargoInfAnio | Pendiente de definir por el usuario | invoice.recargoInfAnio |
| Recordatorio Vto. Ftra. | Pendiente de definir por el usuario | invoice.recordatorioVtoFtra |
| SISTEMA ELECTRICO | Pendiente de definir por el usuario | invoice.sISTEMAELECTRICO |
| SUBIDA_FACE | Pendiente de definir por el usuario | invoice.sUBIDAFACE |
| Suplemento Territorial | Pendiente de definir por el usuario | invoice.suplementoTerritorial |
| Tarifa ATR | Pendiente de definir por el usuario | invoice.tarifaATR |
| Tasa Municipal | Pendiente de definir por el usuario | invoice.tasaMunicipal |
| Tasa Municipal Form | Pendiente de definir por el usuario | invoice.tasaMunicipalForm |
| Telefono | Pendiente de definir por el usuario | invoice.telefono |
| Telefono Contacto | Pendiente de definir por el usuario | invoice.telefonoContacto |
| Telefono Emisora | Pendiente de definir por el usuario | invoice.telefonoEmisora |
| Tipo Aparato | Pendiente de definir por el usuario | invoice.tipoAparato |
| Tipo Autoconsumo | Pendiente de definir por el usuario | invoice.tipoAutoconsumo |
| Tipo Autoconsumo Distribuidora | Pendiente de definir por el usuario | invoice.tipoAutoconsumoDistribuidora |
| Tipo de cliente | Pendiente de definir por el usuario | invoice.tipoDeCliente |
| Tipo DHEdM | Pendiente de definir por el usuario | invoice.tipoDHEdM |
| Tipo Producto | Pendiente de definir por el usuario | invoice.tipoProducto |
| Total sin Descuento | Pendiente de definir por el usuario | invoice.totalsinDescuento |
| Total Softr | Pendiente de definir por el usuario | invoice.totalSoftr |
| Total SVA | Pendiente de definir por el usuario | invoice.totalSVA |
| TotalImporteCargos | Pendiente de definir por el usuario | invoice.totalImporteCargos |
| TotalImportePeajes | Pendiente de definir por el usuario | invoice.totalImportePeajes |
| Uds Concept Repercutible 1 | Pendiente de definir por el usuario | invoice.udsConceptRepercutible1 |
| Uds Concept Repercutible 2 | Pendiente de definir por el usuario | invoice.udsConceptRepercutible2 |
| Uds Concept Repercutible 3 | Pendiente de definir por el usuario | invoice.udsConceptRepercutible3 |
| UN PRECIO | Pendiente de definir por el usuario | invoice.uNPRECIO |
| Unidades Mix | Pendiente de definir por el usuario | invoice.unidadesMix |
| P1P | Potencia contratada P1 | invoice.p1P |
| P1 Precio Energia Reactiva | precio aplciado a energía reactiva consumida y repercutible según distribuidora en período p1 | invoice.p1PrecioEnergiaReactiva |
| P2 Precio Energia Reactiva | precio aplciado a energía reactiva consumida y repercutible según distribuidora en período p2 | invoice.p2PrecioEnergiaReactiva |
| P3 Precio Energia Reactiva | precio aplciado a energía reactiva consumida y repercutible según distribuidora en período p3 | invoice.p3PrecioEnergiaReactiva |
| P4 Precio Energia Reactiva | precio aplciado a energía reactiva consumida y repercutible según distribuidora en período p4 | invoice.p4PrecioEnergiaReactiva |
| P5 Precio Energia Reactiva | precio aplciado a energía reactiva consumida y repercutible según distribuidora en período p5 | invoice.p5PrecioEnergiaReactiva |
| P6 Precio Energia Reactiva | precio aplciado a energía reactiva consumida y repercutible según distribuidora en período p6 | invoice.p6PrecioEnergiaReactiva |
| PExcedentes | precio aplicado a los excedentes de autoconsumo si han existido | invoice.pExcedentes |
| P1E | Precio energía P1 | invoice.p1E |
| P2E | Precio energía P2 | invoice.p2E |
| P3E | Precio energía P3 | invoice.p3E |
| P4E | Precio energía P4 | invoice.p4E |
| P5E | Precio energía P5 | invoice.p5E |
| P6E | Precio energía P6 | invoice.p6E |
| Primer Apellido | primer apellido del titular del contrato al que se factura | invoice.primerApellido |
| Procedencia Hasta | procedencia de la lectura del final  del ciclo facturado: telegestión, visual, estimada, …. Según haya comunicado distribuidora | invoice.procedenciaHasta |
| Procedencia Desde | procedencia de la lectura del inicio del ciclo facturado: telegestión, visual, estimada, …. Según haya comunicado distribuidora | invoice.procedenciaDesde |
| Segundo Apellido | segundo apellido del titular del contrato al que se factura | invoice.segundoApellido |
| Tipo Factura | tipo de factura: normal, abono, rectificativa, regularizadora… (viene determinado por el f1 remitido por distribuidora) | invoice.tipoFactura |
| IVA | tipo de IVA aplicado en factura | invoice.iVA |
| XML | xml con la factura electrónica del cliente | invoice.xML |


# diccionario_instalaciones.xlsx

| Nombre Airtable | Descripción / Significado | Campo Equivalente PostgreSQL |
| --- | --- | --- |
| _Baja Mas Reciente | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| _Conteo Contratos con Alta | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| _Conteo Contratos con Baja | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| ALTA COMERCIALIZADORA Compilación (de CONTRATOS_LINK) | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| BAJA COMERCIALIZADORA | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Comercial (de CONTRATOS_LINK) | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CONTRATOS_LINK | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CUPS | Código Universal del Punto de Suministro | supplyPoint.cups |
| DIAS ACTIVO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| DIAS FACTURADOS | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| FACTURADO DESDE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| FACTURAS_LINK | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| HUECO FACTURACION | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| HUECO REVISADO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Nombre completo Titular (de CONTRATOS_LINK) | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| ULT DIA FACTURADO | Pendiente de definir por el usuario | lead.airtableData (JSON) |


# diccionario_leads.xlsx

| Nombre Airtable | Descripción / Significado | Campo Equivalente PostgreSQL |
| --- | --- | --- |
| ¿Asociar a Bolsillo Solar? | Se indica SI o NO para asociar cups a batería virtual del cif del titular, donde se pueden agregar uno o varios cups que se beneficien de descuentos por los saldos que se vayan generando en el bolsillo solar / baetería virtual | lead.airtableData (JSON) |
| ¿Autoconsumo? | SI o NO tiene autoconsumo fotovoltaico el cups | lead.airtableData (JSON) |
| ¿Facturas papel? | SI o NO quiere las facturas por correo postal además de por e-mail | client.paperInvoice |
| % Comisión Fijo | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| % Comisión Variable | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Actualizar SIPS INGEBAU | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Actualizar SIPS Ingebau Script | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Actualizar SIPS Propio Script | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Adicional Instalación | texto adicional al domicilio del punto de suministro no especificado en campo anteriores | supplyPoint.addressAddition |
| Adicional Titular | texto adicional al domicilio del titular no especificado en campo anteriores | client.billingAddressAddition |
| AJUSTE COMISION DURACION POTENCIA | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| AJUSTE CONSUMO COMISION | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| ALTA COMERCIALIZADORA | Fecha clave: Transiciona el estado del contrato a Activo automáticamente | lead.airtableData (JSON) |
| Año firma | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Apellidos Contacto | apellidos del representante  / apoderado de la empresa | lead.airtableData (JSON) |
| ATR COMER | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Autoconsumo | tipo autoconsumo legalizado en distribuidora | lead.airtableData (JSON) |
| AUTOCONSUMO FIJO / INDEX | F si el cliente quiere que se le pague un precio fijo por sus excedentes fotovoltaicos o I si quiere que se le paguen a precio de mercado variable | lead.airtableData (JSON) |
| B2B | Si el cliente es autónomo o empresa, se marca este checkbox | lead.airtableData (JSON) |
| BAJA COMERCIALIZADORA | Fecha clave: Transiciona el estado del contrato a Finalizado automáticamente | lead.airtableData (JSON) |
| BOLSILLO SOLAR | SI o NO se asocia cups al bolsillo solar del cif | lead.airtableData (JSON) |
| BOLSILLO SOLAR (from Productos) | SI o NO se asocia cups al bolsillo solar del cif | lead.airtableData (JSON) |
| Borrador contrato | pdf del borrador de contrato generado, que también se aloja en tabla contratos | lead.airtableData (JSON) |
| Calculo Cod Distri | código distribuidora a efectos de switching | lead.airtableData (JSON) |
| Calle Instalación | calle del punto de suministro | supplyPoint.street |
| Calle Titular | calle del titular del contrato | client.billingStreet |
| Canal | canal comercial a través del cual se ha captado el lead | lead.airtableData (JSON) |
| CAPTACION CLIENTE | Modo de captación del cliente | lead.airtableData (JSON) |
| Certificado IBAN | documento que certifica titularidad del iban por parte del titular | client.iban |
| CG | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CG BOLSILLO SOLAR | coste de gestión por activar bolsillo solar en el cups | lead.airtableData (JSON) |
| CG BOLSILLO SOLAR (from Productos) | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CIE Autoconsumo | certificado de instalacion eletrica de autoconsumo vinculado al cups | supplyPoint.cieSelfConsumption |
| CIE Consumo | certificado de instalacion eletrica del punto de suministro | lead.airtableData (JSON) |
| CIERRE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CNAE | código cnae del punto de suministro, según actividad allí desarrollada | supplyPoint.cnae |
| CNAE SIPS | igual que cnae pero el registrado en sips | supplyPoint.sipsCnae |
| Cod Autoconsumo SIPS | igual que codigo autoconsumo pero el que e descarga desde sips | lead.airtableData (JSON) |
| Código Canal | codigo del canal a través del cual se ha captado el contrato | lead.airtableData (JSON) |
| Código comercial | código del comercial a través del cual se ha captado el contrato, cada comercial está vinculado a un canal | lead.airtableData (JSON) |
| Código Postal Instalación | codigo postal del punto de suministro | lead.airtableData (JSON) |
| Código postal Titular | codigo postal del titular del contrato | lead.airtableData (JSON) |
| CODIGO REE DISTRIBUIDORA | código distribuidora a efectos de switching | lead.airtableData (JSON) |
| Comercial | comercial a través del cual se ha captado el contrato, cada comercial está vinculado a un canal | lead.airtableData (JSON) |
| COMISION | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| COMISION AJUSTADA | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| COMISION ESTIMADA | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| COMISION VARIABLE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CONSUMO ANUAL | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CONSUMO ANUAL KWH | Consumo anual total descargado de sips | lead.estimatedMWh |
| CONTRATO | Código único de contrato | contract.contractCode |
| Contrato firmado | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CONTRATO_SOP | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CONTRATO2 | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CONTRATOS | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CP SIPS | codigo postal del punto de suministro descargado de sips | lead.airtableData (JSON) |
| CP_CONT | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| CUPS2 | cups del punto de suministro | lead.cUPS2 |
| DECOMISION SOBRE AJUSTE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| DESCUENTO CIE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Día Borrador | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| DIAS PAGO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Digitos CUPS | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| DISTRIBUIDORA | distribuidora asociada al cups, la que distribuye la energía hasta allí | lead.airtableData (JSON) |
| DNI Apoderado | dni del apoderado/representante legal de la empresa titular del contrato (pdf o jpg) | client.fileRepresentativeId |
| DNI/NIF Titular | dni del titular del contrato (pdf o jpg) | lead.airtableData (JSON) |
| DOMICILIO PS | domicilio del punto de suministro | lead.airtableData (JSON) |
| DOMICILIO PS COMPLETO | domicilio completo del punto de suministro | lead.airtableData (JSON) |
| DOMICILIO SOC | domicilio del titular del contrato | client.billingAddress |
| DOMICILIO_CONT | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| DSV Index (from PRODUCTOS) | coste desvío de producto indexado | lead.airtableData (JSON) |
| DURACION | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| DURACION SVA | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| EFACTURA | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| EMAIL | Dirección de correo electrónico del titular del contrato, donde quiere que le envíen facturas y cualquier comunicación | client.contactEmail |
| Email Admin Canal | Dirección de correo electrónico | lead.airtableData (JSON) |
| Email AtCliente | Dirección de correo electrónico | lead.airtableData (JSON) |
| EMAIL COMER | Dirección de correo electrónico | lead.airtableData (JSON) |
| Email Comercial | Dirección de correo electrónico | No migrar (roles) |
| Email Contacto | Email de comunicación | client.contactEmail / lead.email |
| EMAIL FACTURA | Dirección de correo electrónico del titular del contrato, donde quiere que le envíen facturas y cualquier comunicación | lead.airtableData (JSON) |
| Email Gerente | Dirección de correo electrónico | lead.airtableData (JSON) |
| Email Sup Canal | Dirección de correo electrónico | lead.airtableData (JSON) |
| EMAIL_4 | Dirección de correo electrónico | lead.airtableData (JSON) |
| EMPRESA | código de la comercializadora | lead.airtableData (JSON) |
| EN CALIDAD DE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Enlace Wp | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Envío de factura | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| EQUIPO DISTRIB | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Error Autoconsumo | Validación SIPS: 0 indica que la modalidad de autoconsumo coincide | lead.airtableData (JSON) |
| Error CNAE | Validación SIPS: 0 indica que el CNAE coincide | lead.errorCNAE |
| Error CP | Validación SIPS: 0 indica que el código postal coincide | lead.errorCP |
| Error NIF apoderado | Campo de control de errores internos de Make | lead.airtableData (JSON) |
| Error Postal | Campo de control de errores internos de Make | lead.errorPostal |
| Error Tarifa | Campo de control de errores internos de Make | lead.airtableData (JSON) |
| Error Tarifa Producto | Campo de control de errores internos de Make | lead.airtableData (JSON) |
| Escrituras | escrituras de la empresa (pdf) en caso de que el titular sea persona juridica | lead.airtableData (JSON) |
| Estado | Estado del registro (Activo, Baja, etc) | contract.status / lead.status |
| Estado Compilación (de CONTRATOS) | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Factura en papel | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| FACTURA SI / NO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| FC | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Fecha Borrador | fecha en la que se genera el contrato en tabla contratos en estado borrador y se genera pdf para enviar al cliente | lead.airtableData (JSON) |
| Fecha Borrador Modificado | Campo de fecha/timestamp | lead.airtableData (JSON) |
| Fecha firma | Campo de fecha/timestamp | lead.airtableData (JSON) |
| Fecha firma contrato | Fecha clave: Transiciona el estado del contrato a Aceptado | lead.airtableData (JSON) |
| FECHA INICIO SVA | Campo de fecha/timestamp | lead.airtableData (JSON) |
| FECHA PREVISTA | Campo de fecha/timestamp | lead.airtableData (JSON) |
| Fecha Registro | fecha en la que se registra el lead | lead.airtableData (JSON) |
| FECHA_BAJA_ESTIMADA | Campo de fecha/timestamp | lead.airtableData (JSON) |
| FECHA_ULT_MOD_SIPS | Campo de fecha/timestamp | lead.airtableData (JSON) |
| Fee Excedentes (from PRODUCTOS) | fee €/MWh que se descuenta de precio omie a la hora de pagar excedentes fotovoltaicos si el cliente quiere precio indexado variable | lead.airtableData (JSON) |
| Fee Index (from PRODUCTOS) | fee que el cliente pagará soobre el precio de mercado de la energía si contrata suministro con producto indexado | lead.airtableData (JSON) |
| FEE Index Personalizado | fee indexado cuando se introduce manualmente al generar el contrato y no esstá predefinido para un producto concreto | lead.airtableData (JSON) |
| FEE_P | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| FIJO / INDEX | F si cliente quiere suministro con producto de precio fijo o I indexado | lead.airtableData (JSON) |
| Firma manuscrita | si el cliente no quiere envío por docusign o similar | lead.airtableData (JSON) |
| Forma de pago | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| GAS INCLUIDO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| GEN_CONTRATO_AUTO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Generar Borrador | Trigger: Botón/Checkbox que dispara el webhook de Make para generar el contrato | lead.airtableData (JSON) |
| Hora Borrador | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| IBAN | Número de cuenta bancaria | client.iban |
| ID | Pendiente de definir por el usuario | lead.iD |
| INICIO PROCESO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| IP | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| IP P1 | €/kW/año que se incrementa la potencia en periodo P1 sobre el precio BOE regulado en caso de productos personalizados donde el usuario puede introducir el margen que quiera | lead.iPP1 |
| IP P2 | mismo pero para período P2 | lead.iPP2 |
| IP P3 | mismo pero p3 | lead.iPP3 |
| IP P4 | mismo pero p4 | lead.iPP4 |
| IP P5 | mismo pero p5 | lead.iPP5 |
| IP P6 | mismo pero p6 | lead.iPP6 |
| MANDATO DOBLE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| MARCA | código de la marca de la comercializadora, puede haber varias marcas dentro de un mismo cif de comercializadora | lead.airtableData (JSON) |
| Mes Borrador | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Meses permanencia (from PRODUCTOS) | meses de compromiso m,ínimo de permanencia del contrato | lead.airtableData (JSON) |
| Min Borrador | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Modalidad Autoconsumo (from Producto) | fijo o indexado para pago de excedentes | lead.airtableData (JSON) |
| Modalidad de contrato | fijo o indexado para venta de energía a cliente | lead.airtableData (JSON) |
| NIF Contacto | nif del apoderado o representante de la empresa en caso de cliente persona juridica | client.contactVat |
| NIF Titular | DNI o CIF del titular | client.vatNumber |
| Nº CIE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Nombre / Razón social Titular | Nombre o Razón social del cliente | client.businessName |
| Nombre Comercial | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Nombre completo Titular | Nombre o Razón social del cliente completo incluyendo apellidos si es persona física | client.businessName / lead.businessName |
| Nombre Contacto | nombre del apoderado o representante de la empresa en caso de cliente persona juridica sin incluir apellidos | client.contactName |
| Nombre Instalación | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Nombre Wp | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| NOMBRE Y APELLIDOS | nombre y apellidos del apoderado o representante | client.contactName |
| Número Instalación | campo número de la dirección dl punto de suministro | supplyPoint.streetNumber |
| Número Titular | campo número de la dirección del titular del contrato, domicilio social | client.billingNumber |
| ODOO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| P1C | potencia contratada kW en período p1 | supplyPoint.p1c |
| P1C SIPS | potencia contratada kW en período p1 descargada de sips | lead.airtableData (JSON) |
| P1E (from PRODUCTOS) | precio de energía en período p1 | lead.airtableData (JSON) |
| P1P | Potencia contratada P1 | supplyPoint.p1p / contract.customP1P |
| P1P (from PRODUCTOS) | precio de potencia en período p1 | lead.airtableData (JSON) |
| P1PM | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P1PM copy copy copy copy copy copy copy copy copy copy copy copy copy copy copy copy | no aplica a nuestro crm | lead.airtableData (JSON) |
| P2C | idem que p1 pero para este período | supplyPoint.p2c |
| P2C SIPS | idem que p1 pero para este período | lead.airtableData (JSON) |
| P2E (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P2P | idem que p1 pero para este período | lead.airtableData (JSON) |
| P2P (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P3C | idem que p1 pero para este período | supplyPoint.p3c |
| P3C SIPS | idem que p1 pero para este período | lead.airtableData (JSON) |
| P3E (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P3P | idem que p1 pero para este período | lead.airtableData (JSON) |
| P3P (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P4C | idem que p1 pero para este período | supplyPoint.p4c |
| P4C SIPS | idem que p1 pero para este período | lead.airtableData (JSON) |
| P4E (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P4P | idem que p1 pero para este período | lead.airtableData (JSON) |
| P4P (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P5C | idem que p1 pero para este período | supplyPoint.p5c |
| P5C SIPS | idem que p1 pero para este período | lead.airtableData (JSON) |
| P5E (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P5P | idem que p1 pero para este período | lead.airtableData (JSON) |
| P5P (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P6C | idem que p1 pero para este período | supplyPoint.p6c |
| P6C SIPS | idem que p1 pero para este período | lead.airtableData (JSON) |
| P6E (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| P6P | idem que p1 pero para este período | lead.airtableData (JSON) |
| P6P (from PRODUCTOS) | idem que p1 pero para este período | lead.airtableData (JSON) |
| País Titular | país del titular del contrato | lead.airtableData (JSON) |
| PC SIPS suma | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| PC suma | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| PDF Contrato firmado | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Peticion_cliente_c2 | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| PExc | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| PExc (from PRODUCTOS) | precio excednte del producto aplicado al lead | lead.airtableData (JSON) |
| PExc Personalizado | precio excednte cuando se incluye a mano en productos personalizados | lead.airtableData (JSON) |
| PLUS | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Población Instalación | población del punto de suministro | supplyPoint.city |
| Población Titular | población del titular del contrato | client.billingCity |
| POBLACION_CONT | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| POTENCIA BOE | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| POTENCIAS DISTRI | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Precio (from SERVICIOS) | precio del servicio asignado al lead | lead.airtableData (JSON) |
| Primer apellido Titular | primer apellido del titular del contrato | lead.airtableData (JSON) |
| Producto | producto seleccionado para el lead | lead.airtableData (JSON) |
| Producto_Sop | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| ProductoLINK | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Provincia Instalación | provincia del punto de suministro | supplyPoint.province |
| Provincia Titular | provincia del titular del contrato | client.billingProvince |
| PROVINCIA_CONT | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Record ID (from CONTRATOS) | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Rehacer Borrador | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Segundo apellido Titular | segundo apellido del titular del contrato persona física | lead.airtableData (JSON) |
| Servicio | servicio asignado al lead | lead.airtableData (JSON) |
| Servicio LINK | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| SIPS OK | Validación SIPS: 1 si es correcto, 0 si falla | lead.sIPSOK |
| SUSPENDIDO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| SWIFT | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Tarifa | Tarifa de acceso (ej. 2.0TD) | supplyPoint.tariff |
| Tarifa Producto | tarifa del producto asociado al lead para generar contrato | lead.airtableData (JSON) |
| Tarifa SIPS | tarifa del cups descargada de sips | lead.airtableData (JSON) |
| Teléfono Contacto | teléfoo de contacto del titular del contrato | lead.airtableData (JSON) |
| TIPO | código del tipo de tramitación a realizar si el contrato se firma: C1, C2, A3, M1… | lead.airtableData (JSON) |
| TIPO C2 | Cuando tipo es M1, S para modificación administrativa, N para técnica o A para ambas | lead.airtableData (JSON) |
| TIPO DE CLIENTE | F persona física o J persona jurídica | client.clientType |
| Tipo de firma | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Tipo de numeración Instalación | tipo de numeración del punto de suministro, por ejemplo NUM, KM, S/N, etc | lead.airtableData (JSON) |
| Tipo de numeración Titular | tipo de numeración de la dirección del titular del contrato, por ejemplo NUM, KM, S/N, etc | lead.airtableData (JSON) |
| Tipo de persona | F física o J jurídica | client.clientType |
| Tipo de producto | fijo, index, etc… según seleccione el usuario al crear el lead | lead.airtableData (JSON) |
| Tipo de producto (from Producto) | fijo, index, etc… del producto seleccionado para generar contrato | lead.airtableData (JSON) |
| Tipo de vía Instalación | tipo de vía de la dirección del punto de suministro: calle, avenida, etc… | supplyPoint.streetType |
| Tipo de vía Titular | tipo de vía de la dirección del titular del contrato: calle, avenida, etc… | client.billingStreetType |
| TIPO ENTRADA | Clasificación interna comercial | lead.airtableData (JSON) |
| TIPOS TRAMITACION copy | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| TLF | teléfoo de contacto del titular del contrato | client.contactPhone |
| TLF COMER | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| TLF_2 | teléfoo de contacto del titular del contrato | client.contactPhone2 |
| TLF_3 | teléfoo de contacto del titular del contrato | client.contactPhone3 |
| Tramitación a realizar | tipo de tramitación a realizar si se firma el contrato: alta nueva, cambio de comercializadora, modificación, etc… | lead.airtableData (JSON) |
| Tramitación LINK | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Tramitación_Sop | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Trigger Duplicar | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Ult Factura | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| UN PRECIO | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| Var PC | Pendiente de definir por el usuario | lead.airtableData (JSON) |
| VERIFICACION_SOLICITADA | Pendiente de definir por el usuario | lead.airtableData (JSON) |


# diccionario_productos.xlsx

| Nombre Airtable | Descripción / Significado | Campo Equivalente PostgreSQL |
| --- | --- | --- |
| Autoconsumo Fijo / Index | F si los excedentes se pagan al cliente a precio fijo o I si se pagan a previo variable de mercado menos un fee de gestión para la comercializadora | product.airtableData (JSON) |
| Bolsillo Solar | SI o NO el producto es autoconsumo con activación de bolsillo solar (batería virtual) por si la compensación de excedenets supera el máximo compensable por normativa, llenar su bolsillo solar con el resto de euros para aplicarle descuentos en los cups que el cif tenga asociados a su bolsillo solar | product.airtableData (JSON) |
| CANALES_LINK | canales comerciales que pueden acceder a este producto | product.airtableData (JSON) |
| CG Bolsillo Solar | (IA) Coste de gestión mensual cobrado al cliente por usar el servicio de Batería Virtual / Bolsillo Solar | product.cgBolsilloSolar |
| CONTRATOS | contratos generados con este producto | product.airtableData (JSON) |
| CONTRATOS 2 | Pendiente de definir por el usuario... | product.airtableData (JSON) |
| DSV Index | coste de desvío a aplciar en producto tipo indexado | product.airtableData (JSON) |
| Disponible CRM | si estaba o no visible en softr | product.airtableData (JSON) |
| FC | coeficiente para cálculo de comisiones, implementaremos nusetro propio sistema en crm sp energia | No se importa (Nuevo motor de comisiones) |
| Fee Excedentes | (IA) Margen de comercialización aplicado sobre la compensación de excedentes, a descontar del precio OMIE | product.feeExcedentes |
| Fee Index | (IA) Margen de comercialización (Fee) sumado al precio de coste indexado (€/MWh) | product.fee |
| Fijo / Index | F si el producto es de precio fijo o I si es indexado a mercado con precio variable por hora | product.airtableData (JSON) |
| GAS INCLUIDO | no aplica a nuestro crm | product.airtableData (JSON) |
| IP | coeficiente para cálculo de comisiones, implementaremos nusetro propio sistema en crm sp energia | No se importa (Nuevo motor de comisiones) |
| LEADS | leads que han sido asociados a este producto | product.airtableData (JSON) |
| LEADS copy | Pendiente de definir por el usuario... | product.airtableData (JSON) |
| Meses permanencia | (IA) Meses de permanencia obligatoria al contratar este producto | product.permanenceMonths |
| Modalidad Autoconsumo | Precio fijo o variable OMIE para el pago de excedentes | product.airtableData (JSON) |
| Nombre (from CANALES_LINK) | no aplica a nuestro crm | No se importa (Ignorado) |
| Nombre Producto | (IA) Nombre comercial del producto para mostrar a clientes y comerciales | product.name |
| OPORTUNIDADES | oportunidades asociadas a este producto, en nuevo crm las oportunidades y los leads se agrupan en la tabla y sección de leads | product.airtableData (JSON) |
| P1E | (IA) Precio de la energía facturada al cliente en el periodo P1E (€/kWh) | product.p1e |
| P1E_Coste_Estimado | no aplica a nuestro crm | product.airtableData (JSON) |
| P1P | (IA) Precio del término de potencia facturado al cliente en el periodo P1P (€/kW/año) | product.p1p |
| P1Pd | no aplica a nuestro crm | product.airtableData (JSON) |
| P2E | (IA) Precio de la energía facturada al cliente en el periodo P2E (€/kWh) | product.p2e |
| P2E_Coste_Estimado | no aplica a nuestro crm | product.airtableData (JSON) |
| P2P | (IA) Precio del término de potencia facturado al cliente en el periodo P2P  (€/kW/año) | product.p2p |
| P2Pd | no aplica a nuestro crm | product.airtableData (JSON) |
| P3E | (IA) Precio de la energía facturada al cliente en el periodo P3E (€/kWh) | product.p3e |
| P3E_Coste_Estimado | no aplica a nuestro crm | product.airtableData (JSON) |
| P3P | (IA) Precio del término de potencia facturado al cliente en el periodo P3P (€/kW/año) | product.p3p |
| P3Pd | no aplica a nuestro crm | product.airtableData (JSON) |
| P4E | (IA) Precio de la energía facturada al cliente en el periodo P4E (€/kWh) | product.p4e |
| P4E_Coste_Estimado | no aplica a nuestro crm | product.airtableData (JSON) |
| P4P | (IA) Precio del término de potencia facturado al cliente en el periodo P4P  (€/kW/año) | product.p4p |
| P4Pd | no aplica a nuestro crm | product.airtableData (JSON) |
| P5E | (IA) Precio de la energía facturada al cliente en el periodo P5E (€/kWh) | product.p5e |
| P5E_Coste_Estimado | no aplica a nuestro crm | product.airtableData (JSON) |
| P5P | (IA) Precio del término de potencia facturado al cliente en el periodo P5P  (€/kW/año) | product.p5p |
| P5Pd | no aplica a nuestro crm | product.airtableData (JSON) |
| P6E | (IA) Precio de la energía facturada al cliente en el periodo P6E (€/kWh) | product.p6e |
| P6E_Coste_Estimado | no aplica a nuestro crm | product.airtableData (JSON) |
| P6P | (IA) Precio del término de potencia facturado al cliente en el periodo P6P  (€/kW/año) | product.p6p |
| P6Pd | no aplica a nuestro crm | product.airtableData (JSON) |
| PExc | (IA) Precio de compensación de excedentes para autoconsumo | product.pexc |
| Tarifa | (IA) Tarifa de acceso ATR compatible con este producto (ej. 2.0TD, 3.0TD) | product.tariff |
| Tipo de producto | (IA) Tipo de producto comercial (Fijo, Indexado) | product.type |
| ¿Autoconsumo? | si el producto es para cups con autoconsumo o no | product.airtableData (JSON) |


# diccionario_usuarios_v2.xlsx

| Campo Airtable | Descripción / Uso en el CRM | Importado a Base de Datos |
| --- | --- | --- |
| Email Link | usuario para acceder a softr, coincide con email del usuario | Sí (Tabla User) |
| Nombre2 | nombre del usuario | Sí (Tabla User) |
| Código | código de comercial en caso de que el usuario sea un comercial | Sí (Tabla User) |
| Email | email del usuario | Sí (Tabla User) |
| Teléfono | teléfono de contacto del usuario | No |
| CANALES LINK | canal al que está asociado el usuario | No |
| Nombre Canal | nombre del canal asociado al usuario | No |
| % Comisión Fijo | no aplica a nuestro crm | No |
| % Comisión Variable | no aplica a nuestro crm | No |
| GEN_CONTRATO_AUTO | no aplica a nuestro crm | No |
| DIAS_RENOV_MAX | no aplica a nuestro crm | No |
| Código canal | código del canal asociado al comercial | No |
| Email Supervisor | no aplica a nuestro crm | No |
| Email Admin Canal | no aplica a nuestro crm | No |
| Email Gerente | no aplica a nuestro crm | No |
| Email AtCliente | no aplica a nuestro crm | No |
| Canales | no aplica a nuestro crm | No |
| Supervisor canal | responsable del canal asociado al usuario | No |
| Supervisor | no aplica a nuestro crm | No |
| LEADS | leads vinculados con este comercial | No |
| CONTRATOS | contratos vinculados con este comercial | No |
| At Cliente | no aplica a nuestro crm | No |
| LEADS copy | no aplica a nuestro crm | No |
| CLIENTES | no aplica a nuestro crm | No |
| NOMBRE COMPLETO | no aplica a nuestro crm | No |


