// Fichero con los códigos oficiales de las tablas maestras de la CNMC para Proceso R1 (V3.0)
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

// Tabla 61 - Tipos de Documentación Aportada (<TipoDocAportado>)
export const TIPOS_DOCUMENTACION_CNMC: CnmcCode[] = [
  { codigo: "04", descripcion: "04 - Reclamación" },
  { codigo: "06", descripcion: "06 - Facturas" },
  { codigo: "07", descripcion: "07 - Otra documentación del cliente" },
  { codigo: "08", descripcion: "08 - Otros" },
  { codigo: "01", descripcion: "01 - CIE consumo" },
  { codigo: "02", descripcion: "02 - Acta de Puesta en Marcha" },
  { codigo: "03", descripcion: "03 - Acta de Inspección" },
  { codigo: "05", descripcion: "05 - Respuesta a reclamación" },
  { codigo: "09", descripcion: "09 - Acuerdo reparto" },
  { codigo: "10", descripcion: "10 - CIE generación" },
  { codigo: "11", descripcion: "11 - Declaración puntos de recarga VE acceso público" },
  { codigo: "12", descripcion: "12 - Fichero de coeficientes de reparto" },
  { codigo: "13", descripcion: "13 - Certificado suelo urbanizado" },
];

// Tabla 81 - Tipo de Reclamación o Petición
export const MOTIVOS_R1: Record<string, string> = {
  "01": "Atención personal",
  "02": "Facturación y medida",
  "03": "Contratación",
  "04": "Gestión de acometidas",
  "05": "Calidad de suministro",
  "06": "Situación de instalaciones",
  "07": "Atención reglamentaria",
};

// Tabla 82 - Subtipo de Reclamación o Petición (incluye códigos vigentes + históricos en BD)
export const SUBMOTIVOS_R1: Record<string, string> = {
  "001": "Atención incorrecta",
  "002": "Privacidad de los datos",
  "003": "Incidencia en equipos de medida",
  "004": "Daños originados por equipo de medida",
  "005": "Contador en factura no corresponde con instalado",
  "006": "Contratos ATR que no se facturan",
  "007": "CUPS no pertenece a comercializadora o no vigente en periodo",
  "008": "Disconformidad con conceptos facturados",
  "009": "Disconformidad con lectura facturada",
  "010": "Disconformidad en factura anomalía / fraude",
  "011": "Reclamación factura pago duplicado",
  "012": "Refacturación no recibida",
  "013": "Disconformidad con cambio de suministrador",
  "014": "Requerimiento de fianza / depósito de garantía",
  "015": "Retraso corte de suministro",
  "016": "Retraso en plazo aceptación (histórico)",
  "017": "Retraso en plazo activación (histórico)",
  "018": "Disconformidad con criterios económicos / cobros",
  "019": "Disconformidad con criterios técnicos / obra ejecutada",
  "020": "Calidad de onda",
  "021": "Calidad suministro con petición de indemnización",
  "022": "Calidad suministro sin petición de indemnización",
  "023": "Retraso en pago indemnización",
  "024": "Daños a terceros por instalaciones",
  "025": "Impacto ambiental instalaciones",
  "026": "Reclamaciones sobre instalaciones",
  "027": "Disconformidad descuento servicio individual",
  "028": "Ejecución indebida de corte",
  "029": "Retraso en la atención a reclamaciones",
  "030": "Retraso plazo de contestación nuevos suministros",
  "031": "Retraso plazo de ejecución nuevo suministro",
  "032": "Retraso reenganche tras corte",
  "034": "Disconformidad con conceptos de contratación ATR-Peaje",
  "035": "Disconformidad rechazo solicitud ATR-Peaje",
  "036": "Petición de refacturación aportando lectura",
  "037": "Fichero XML incorrecto",
  "038": "Privacidad de los datos (petición)",
  "039": "Solicitud de certificado / informe de calidad",
  "040": "Solicitud de duplicado de factura",
  "041": "Solicitud de actuación sobre instalaciones",
  "042": "Solicitud de descargo",
  "043": "Petición de precintado / desprecintado de equipos",
  "044": "Peticiones con origen en campañas de telegestión",
  "045": "Actualización dirección punto de suministro",
  "046": "Certificado de lectura",
  "047": "Solicitud recálculo CCH sin modificación cierre ATR",
  "048": "Petición información adicional rechazo",
  "049": "Falta fichero medida",
  "055": "Disconformidad sobre importe facturado autoconsumo",
  "056": "Petición desglose importe a facturar autoconsumo",
  "057": "Disconformidad con expediente de anomalía y fraude (sin factura)",
  "058": "Retraso en plazo aceptación cambio de comercializador",
  "059": "Retraso en plazo activación cambio de comercializador",
  "060": "Retraso en plazo aceptación modificación contractual",
  "061": "Retraso en plazo activación modificación contractual",
  "062": "Retraso en plazo aceptación alta de nuevo suministro",
  "063": "Retraso en plazo activación alta de nuevo suministro",
  "064": "Retraso en plazo aceptación de baja de suministro",
  "065": "Retraso en plazo activación baja de suministro",
  "066": "Información/validación sobre datos del contrato ATR/Peaje",
  "067": "Verificación de contador",
  "069": "Copia F1 en PDF",
  "070": "Retraso atención reclamaciones no sujetas a atención reglamentaria",
  "071": "Retraso en plazo aceptación desistimiento",
  "072": "Retraso en plazo activación desistimiento",
  "073": "Parámetros de comunicación",
  "074": "Retraso plazo aceptación anulación",
  "075": "Disconformidad con autoconsumo facturado",
  "076": "Consulta seguimiento autoconsumo",
  "077": "Retraso plazo activación unidireccional autoconsumo",
  "078": "Retraso plazo activación baja unidireccional distribuidora",
  "079": "Solicitud contrato de acceso",
  "080": "Retraso en plazo aceptación reposición",
  "081": "Retraso en plazo activación reposición",
  // Históricos previos en BD
  "103": "Autoconsumo / Excedentes (histórico)",
};

// Tabla 80 - Resultado de la Reclamación (Paso 05)
export const RESULTADOS_R1: Record<string, string> = {
  "01": "Procedente / Favorable",
  "02": "Improcedente / Desfavorable",
  "03": "No gestionable",
  "04": "Mal tipificada",
  "05": "Duplicada",
};

// Tabla 84 - Tipo de Comunicación Intermedia (Paso 03)
export const TIPOS_COMUNICACION_R1: Record<string, string> = {
  "01": "Solicitud de información adicional",
  "02": "Comunicación de estado intermedia",
  "03": "Comunicación de retipificación",
  "04": "Solicitud de información para retipificar",
};

// Tabla 27 - Motivos de Rechazo aplicables a R1 (y comunes ATR)
export const MOTIVOS_RECHAZO_CNMC: Record<string, string> = {
  "01": "No existe Punto de Suministro asociado al CUPS",
  "02": "Inexistencia de Contrato de ATR previo en vigor",
  "03": "NIF-CIF no coincide con el del Contrato en vigor",
  "11": "Comercializadora incorrecta",
  "20": "Instalación no disponible o ampliación en trámite",
  "28": "Rechazo por anormalidad / expediente abierto",
  "70": "Comercializador inhabilitado",
  "72": "Contrato en baja",
  "84": "Reclamación duplicada",
  "85": "Falta campo obligatorio",
  "86": "Código de Expediente de Acometida erróneo",
  "87": "Factura inexistente",
  "88": "Factura no telegestionada",
  "99": "Otros motivos de rechazo",
  "D9": "Incumplimiento de validaciones de esquema / formato",
  "E9": "Solicitud no anulable (proceso ya cerrado o rechazado)",
};

export function normalizeTipoR1(tipo?: string | null): string | null {
  if (!tipo) return null;
  const clean = String(tipo).trim();
  if (!clean || clean.toLowerCase() === 'genérica' || clean === '-') return null;
  if (/^\d+$/.test(clean)) return clean.padStart(2, '0');
  return clean;
}

export function normalizeSubtipoR1(subtipo?: string | null): string | null {
  if (!subtipo) return null;
  const clean = String(subtipo).trim();
  if (!clean || clean === '-') return null;
  // Ignore distributor internal IDs (>4 digits like '120371840') mistakenly stored as subtipo
  if (/^\d{5,}$/.test(clean)) return null;
  if (/^\d{1,3}$/.test(clean)) return clean.padStart(3, '0');
  return clean;
}

export function getTipoR1Label(tipo?: string | null): string {
  const norm = normalizeTipoR1(tipo);
  if (!norm) return 'Genérica';
  return MOTIVOS_R1[norm] ? `${norm} · ${MOTIVOS_R1[norm]}` : norm;
}

export function getSubtipoR1Label(subtipo?: string | null): string {
  const norm = normalizeSubtipoR1(subtipo);
  if (!norm) return '-';
  return SUBMOTIVOS_R1[norm] ? `${norm} · ${SUBMOTIVOS_R1[norm]}` : norm;
}
