// Campos obligatorios por Subtipo según "CNMC - E - R1 Campos Min 2024.05.16.xlsx" (Electricidad V3.0)
export const SUBTIPO_REQUIREMENTS: Record<string, string[]> = {
  "001": ["FECHA INCIDENTE", "TIPO ATENCION INCORRECTA"],
  "003": ["CODIGO INCIDENCIA"],
  "004": ["FECHA INCIDENTE", "IMPORTE RECLAMADO"],
  "007": ["NUM FACTURA ATR"],
  "008": ["NUM FACTURA ATR", "TIPO CONCEPTO FACTURADO"],
  "009": ["NUM FACTURA ATR"],
  "010": ["NUM FACTURA ATR"],
  "011": ["NUM FACTURA ATR"],
  "012": ["NUM FACTURA ATR"],
  "013": ["CODIGO SOLICITUD"],
  "014": ["IBAN"],
  "015": ["CODIGO SOLICITUD"],
  "018": ["SOL. NUEVO SUMINISTRO"],
  "019": ["SOL. NUEVO SUMINISTRO"],
  "020": ["FECHA DESDE", "FECHA HASTA"],
  "021": ["FECHA DESDE", "FECHA HASTA", "IMPORTE RECLAMADO"],
  "022": ["FECHA DESDE", "FECHA HASTA"],
  "023": ["COD SOLICITUD RECLAMACION ANTERIOR"],
  "024": ["FECHA DESDE", "FECHA HASTA", "UBICACION INCIDENCIA"],
  "025": ["FECHA DESDE", "FECHA HASTA", "UBICACION INCIDENCIA"],
  "026": ["UBICACION INCIDENCIA"],
  "029": ["COD SOLICITUD RECLAMACION ANTERIOR"],
  "030": ["SOL. NUEVO SUMINISTRO"],
  "031": ["SOL. NUEVO SUMINISTRO"],
  "032": ["CODIGO SOLICITUD"],
  "034": ["CODIGO SOLICITUD", "CONCEPTO CONTRATACION"],
  "035": ["CODIGO SOLICITUD"],
  "036": ["NUM FACTURA ATR", "LECTURA", "FECHA LECTURA"],
  "039": ["FECHA DESDE", "FECHA HASTA"],
  "040": ["NUM FACTURA ATR"],
  "041": ["UBICACION INCIDENCIA"],
  "046": ["FECHA DESDE", "FECHA HASTA"],
  "047": ["NUM FACTURA ATR"],
  "048": ["CODIGO SOLICITUD"],
  "049": ["FECHA DESDE", "FECHA HASTA"],
  "057": ["NUMERO EXPEDIENTE FRAUDE"],
  "058": ["CODIGO SOLICITUD"],
  "059": ["CODIGO SOLICITUD"],
  "060": ["CODIGO SOLICITUD"],
  "061": ["CODIGO SOLICITUD"],
  "062": ["CODIGO SOLICITUD"],
  "063": ["CODIGO SOLICITUD"],
  "064": ["CODIGO SOLICITUD"],
  "065": ["CODIGO SOLICITUD"],
  "066": ["CODIGO SOLICITUD", "CONCEPTO CONTRATACION"],
  "069": ["NUM FACTURA ATR"],
  "070": ["COD SOLICITUD RECLAMACION ANTERIOR"],
  "071": ["CODIGO SOLICITUD"],
  "072": ["CODIGO SOLICITUD"],
  "074": ["CODIGO SOLICITUD", "COD SOLICITUD RECLAMACION ANTERIOR"],
  "075": ["NUM FACTURA ATR", "TIPO DISCONFORME AUTOCONSUMO"],
  "076": ["MOTIVO CONSULTA"],
  "077": ["CODIGO SOLICITUD", "CAU"],
  "078": ["CODIGO SOLICITUD"],
  "080": ["CODIGO SOLICITUD"],
  "081": ["CODIGO SOLICITUD"],
};

// Campos opcionales que el usuario puede aportar en ciertos subtipos (ej. 079 Solicitud contrato de acceso)
export const SUBTIPO_OPTIONAL_FIELDS: Record<string, string[]> = {
  "079": ["CODIGO SOLICITUD"],
};

// Subtipos donde la CNMC NO exige <CUPS> en <CabeceraReclamacion> (o donde es opcional)
export const SUBTIPOS_SIN_CUPS = new Set([
  "018", "019", "024", "025", "026", "030", "031", "041", "070",
]);

export function isCupsOptionalForSubtipo(subtipo: string, extraFields?: Record<string, any>): boolean {
  if (!subtipo) return false;
  if (SUBTIPOS_SIN_CUPS.has(subtipo) || subtipo === "001") return true;
  // En 076 (Consulta seguimiento autoconsumo), si MotivoConsulta = '02' (Conexiones), se identifica por NumExpedienteAcometida sin CUPS obligatorio
  if (subtipo === "076" && extraFields?.["MOTIVO CONSULTA"] === "02") return true;
  return false;
}

export function getRequiredFieldsForSubtipo(subtipo: string, extraFields?: Record<string, any>): string[] {
  const base = SUBTIPO_REQUIREMENTS[subtipo] ? [...SUBTIPO_REQUIREMENTS[subtipo]] : [];
  if (subtipo === "076" && extraFields?.["MOTIVO CONSULTA"] === "02") {
    if (!base.includes("SOL. NUEVO SUMINISTRO")) {
      base.push("SOL. NUEVO SUMINISTRO");
    }
  }
  return base;
}

export function getOptionalFieldsForSubtipo(subtipo: string): string[] {
  return SUBTIPO_OPTIONAL_FIELDS[subtipo] ? [...SUBTIPO_OPTIONAL_FIELDS[subtipo]] : [];
}

// Subtipos donde el nodo <Cliente> es opcional según "CNMC - E - R1 Campos Min 2024.05.16.xlsx"
export const SUBTIPOS_CLIENTE_OPCIONAL = new Set([
  "007", "015", "018", "019", "020", "024", "025", "026",
  "030", "031", "034", "035", "039", "041", "043", "044",
  "047", "058", "059", "060", "061", "062", "063", "064",
  "065", "066", "069", "070", "071", "072", "074", "076",
  "077", "078", "080", "081",
]);
