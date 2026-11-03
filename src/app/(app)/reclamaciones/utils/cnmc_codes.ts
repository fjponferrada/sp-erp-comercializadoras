// Fichero con los códigos oficiales de las tablas maestras de la CNMC para Proceso R1
export interface CnmcCode { codigo: string; descripcion: string; }

export const CNMC_DROPDOWN_OPTIONS: Record<string, CnmcCode[]> = {
  // Tabla 87 - Atención incorrecta
  "TIPO ATENCION INCORRECTA": [
    { codigo: "01", descripcion: "01 - Por personal de canales de atención" },
    { codigo: "02", descripcion: "02 - Por operarios de equipos de medida" },
    { codigo: "03", descripcion: "03 - Por operarios de nuevos suministros" },
    { codigo: "04", descripcion: "04 - Por operarios de inspección" },
    { codigo: "05", descripcion: "05 - Por operaciones" },
    { codigo: "06", descripcion: "06 - Por operarios de lecturas" },
  ],
  // Tabla 79 - Parámetros contratación
  "CONCEPTO CONTRATACION": [
    { codigo: "01", descripcion: "01 - Potencia Contratada" },
    { codigo: "02", descripcion: "02 - Titular" },
    { codigo: "03", descripcion: "03 - Tarifa de acceso" },
    { codigo: "04", descripcion: "04 - Propiedad del equipo de medida" },
    { codigo: "05", descripcion: "05 - Fecha de activación" },
    { codigo: "06", descripcion: "06 - Tipo de contrato" },
    { codigo: "07", descripcion: "07 - Modo control-potencia" },
    { codigo: "08", descripcion: "08 - Periodicidad facturación" },
    { codigo: "09", descripcion: "09 - Dirección Punto de Suministro" },
    { codigo: "10", descripcion: "10 - Tipo Autoconsumo" },
    { codigo: "11", descripcion: "11 - Tipo Subsección" },
    { codigo: "12", descripcion: "12 - Colectivo" },
    { codigo: "13", descripcion: "13 - Tipo Cups" },
    { codigo: "14", descripcion: "14 - SSAA" },
    { codigo: "15", descripcion: "15 - Único contrato" },
    { codigo: "16", descripcion: "16 - Acuerdo de reparto/ Fichero coeficientes" },
  ],
  // Tabla 140 - Motivo consulta
  "MOTIVO CONSULTA": [
    { codigo: "01", descripcion: "01 - Contratación" },
    { codigo: "02", descripcion: "02 - Conexiones" },
    { codigo: "03", descripcion: "03 - Verificación del equipo" },
  ],
  // Tabla 86 - Tipos de Incidencia en equipos de medida
  "CODIGO INCIDENCIA": [
    { codigo: "01", descripcion: "01 - Comprobación" },
    { codigo: "02", descripcion: "02 - Verificación con patrón" },
    { codigo: "03", descripcion: "03 - Contador robado/ Sin contador" },
    { codigo: "04", descripcion: "04 - Contador averiado: parado, pantalla apagada/falla, sigue contando sin nada conectado en domicilio, quemado, error conexionado, suministro sin tensión." },
    { codigo: "05", descripcion: "05 - Incidencias ICP" },
    { codigo: "06", descripcion: "06 - Contador desprogramado: DH o reloj desprogramado (sólo marca en punta o en valle o las muestra cambiadas, dígitos contador no se corresponde con factura." },
    { codigo: "07", descripcion: "07 - Incidencia en el equipo de telemedida" },
  ],
  // Tabla 77 - Tipos de conceptos facturados (vigentes)
  "TIPO CONCEPTO FACTURADO": [
    { codigo: "01", descripcion: "01 - Potencia" },
    { codigo: "02", descripcion: "02 - Reactiva" },
    { codigo: "03", descripcion: "03 - Penalización ICP" },
    { codigo: "04", descripcion: "04 - Alquiler de equipo de medida" },
    { codigo: "05", descripcion: "05 - Impuestos" },
    { codigo: "06", descripcion: "06 - Excesos de potencia" },
    { codigo: "08", descripcion: "08 - Depósito de garantía" },
    { codigo: "09", descripcion: "09 - Verificación de equipos de medida" },
    { codigo: "10", descripcion: "10 - Derechos de corte y reconexión" },
    { codigo: "11", descripcion: "11 - Abono por calidad de suministro" },
    { codigo: "12", descripcion: "12 - Abono por calidad individual" },
    { codigo: "13", descripcion: "13 - Coste de reposición" },
    { codigo: "14", descripcion: "14 - Refacturaciones regulatorias" },
    { codigo: "16", descripcion: "16 - Derechos de acceso" },
    { codigo: "17", descripcion: "17 - Derechos de extensión" },
    { codigo: "18", descripcion: "18 - Derechos de enganche" },
    { codigo: "19", descripcion: "19 - Derechos de actuación en equipo de medida" },
    { codigo: "20", descripcion: "20 - Derechos de supervisión" },
    { codigo: "21", descripcion: "21 - Tarifa" },
    { codigo: "22", descripcion: "22 - Impuesto Eléctrico" },
    { codigo: "23", descripcion: "23 - Desglose Suplemento Territorial" },
    { codigo: "24", descripcion: "24 - Pago por uso de la red autoconsumo" },
    { codigo: "26", descripcion: "26 - Retardo en activación autoconsumo" },
    { codigo: "27", descripcion: "27 - Descuento retardo activación autoconsumo superior al valor económico de la energía horaria consumida de la red" },
  ],
  // Tabla 139 - Tipo de disconformidad de autoconsumo facturado
  "TIPO DISCONFORME AUTOCONSUMO": [
    { codigo: "01", descripcion: "01 - Tipo Autoconsumo" },
    { codigo: "02", descripcion: "02 - Tipo subsección" },
    { codigo: "03", descripcion: "03 - Colectivo" },
    { codigo: "04", descripcion: "04 - Tipo CUPS" },
    { codigo: "05", descripcion: "05 - SSAA" },
    { codigo: "06", descripcion: "06 - Único contrato" },
    { codigo: "07", descripcion: "07 - Generación Neta Beta aplicada" },
  ],
};
