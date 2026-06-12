import { XMLParser } from 'fast-xml-parser';

export interface ParsedSwitchingData {
  codigoSolicitud?: string;
  fechaSolicitud?: Date;
  proceso: string;
  procesoBase: string;
  paso?: string;
  cups?: string;
  estadoAR?: string;
  fechaAR?: Date;
  fechaPrevActivacion?: Date;
  fechaActivacionAlta?: Date;
  fechaActivacionBaja?: Date;
  observaciones?: string;
  codigoComercializadora?: string;
  codigoReclamacion?: string;
  // Campos F1
  numeroFactura?: string;
  fechaEmision?: Date;
  fechaInicio?: Date;
  fechaFin?: Date;
  baseImponible?: number;
  totalPeajes?: number;
  totalCargos?: number;
  saldoFactura?: number;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // Crucial para normalizar <ns2:Cabecera> a Cabecera
  parseTagValue: true,
  trimValues: true,
});

/**
 * Función auxiliar para navegar un objeto de forma segura
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Busca de forma recursiva una clave en un objeto anidado.
 * Útil porque la estructura bajo <Mensaje> varía por tipo.
 */
function findKeyRecursively(obj: any, targetKey: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (targetKey in obj) return obj[targetKey];

  for (const key of Object.keys(obj)) {
    const found = findKeyRecursively(obj[key], targetKey);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function parseSwitchingXml(xmlString: string): ParsedSwitchingData {
  const jsonObj = parser.parse(xmlString);

  // La raíz puede llamarse MensajeAceptacion..., MensajeRechazo..., MensajeC101...
  // Lo más seguro es buscar el primer nodo hijo de jsonObj
  const rootKey = Object.keys(jsonObj).find(k => k !== '?xml');
  const root = rootKey ? jsonObj[rootKey] : jsonObj;

  // 1. Extraer Cabecera Universal (o sus variantes R1, Q1)
  const cabecera = findKeyRecursively(root, 'Cabecera') || findKeyRecursively(root, 'CabeceraReclamacion') || findKeyRecursively(root, 'CabeceraQ1');
  
  const codigoSolicitud = cabecera?.CodigoDeSolicitud || cabecera?.CodigoSolicitud;
  const codigoPaso = cabecera?.CodigoDePaso || cabecera?.CodigoPaso;
  const codigoProceso = cabecera?.CodigoDelProceso || cabecera?.CodigoProceso;
  const cups = cabecera?.CUPS;
  
  // Extraer el código de reclamación si existe en el proceso (R1)
  const codigoReclamacion = findKeyRecursively(root, 'CodigoReclamacionDistribuidora') || findKeyRecursively(root, 'CodigoReclamacion') || findKeyRecursively(root, 'CodigoDeReclamacion');
  
  const fallbackCodigoSolicitud = findKeyRecursively(root, 'CodigoSolicitudReclamacion') || codigoReclamacion;
  const finalCodigoSolicitud = cabecera?.CodigoDeSolicitud || cabecera?.CodigoSolicitud || fallbackCodigoSolicitud;
  
  let fechaSolicitudDate: Date | undefined = undefined;
  if (cabecera?.FechaSolicitud) {
    fechaSolicitudDate = new Date(cabecera.FechaSolicitud);
  }

  // 2. Determinar Proceso y Base
  const proceso = codigoProceso ? String(codigoProceso) : 'DESC';
  const paso = codigoPaso ? String(codigoPaso).padStart(2, '0') : undefined;
  let procesoBase = proceso.substring(0, 2); // ej: C1, M1, A3
  if (!procesoBase) procesoBase = 'DESC';

  // Extraer el Código REE de la Comercializadora
  // Dependiendo del Paso, la comercializadora es el Remitente (enviados) o el Destinatario (recibidos)
  const remitente = cabecera?.Remitente?.CodigoRE || cabecera?.Remitente || cabecera?.CodigoREEEmpresaEmisora;
  const destinatario = cabecera?.Destinatario?.CodigoRE || cabecera?.Destinatario || cabecera?.CodigoREEEmpresaDestino;
  let codigoComercializadora = undefined;
  
  const isEnviado = paso === '01' || paso === '03';
  if (isEnviado) {
    codigoComercializadora = typeof remitente === 'string' ? remitente : String(remitente);
  } else {
    codigoComercializadora = typeof destinatario === 'string' ? destinatario : String(destinatario);
  }
  
  if (codigoComercializadora === 'undefined') codigoComercializadora = undefined;

  const result: ParsedSwitchingData = {
    codigoSolicitud: finalCodigoSolicitud ? String(finalCodigoSolicitud) : undefined,
    fechaSolicitud: isNaN(fechaSolicitudDate?.getTime() as number) ? undefined : fechaSolicitudDate,
    proceso,
    procesoBase,
    paso,
    cups: cups ? String(cups) : undefined,
    codigoComercializadora,
    codigoReclamacion: codigoReclamacion ? String(codigoReclamacion) : undefined,
  };

  // 3. Lógica Específica por "Paso"
  if (paso === '02') {
    // Aceptación
    result.estadoAR = 'ACEPTADO';
    const fechaAceptacion = findKeyRecursively(root, 'FechaAceptacion') || findKeyRecursively(root, 'FechaAR');
    if (fechaAceptacion) {
      result.fechaAR = new Date(fechaAceptacion);
    }
    const fechaPrevista = findKeyRecursively(root, 'FechaPrevistaAccion') || findKeyRecursively(root, 'FechaActivacionPrevista');
    if (fechaPrevista) {
      result.fechaPrevActivacion = new Date(fechaPrevista);
    }
    const observaciones = findKeyRecursively(root, 'Comentarios');
    if (observaciones) {
      result.observaciones = String(observaciones);
    }

  } else if (paso === '04') {
    // Rechazo
    result.estadoAR = 'RECHAZADO';
    const fechaRechazo = findKeyRecursively(root, 'FechaRechazo') || findKeyRecursively(root, 'FechaAR');
    if (fechaRechazo) {
      result.fechaAR = new Date(fechaRechazo);
    }
    // El motivo de rechazo suele venir en <MotivosRechazo><Motivo><CodigoMotivo> y <Descripcion>
    const motivosRechazo = findKeyRecursively(root, 'MotivosRechazo');
    if (motivosRechazo) {
      // Extraer un array de motivos o texto directo
      result.observaciones = JSON.stringify(motivosRechazo);
    }

  } else if (paso === '05') {
    // Activación (Alta, Cambio, Reposición...)
    // Buscar la fecha de activación, suele estar bajo <DatosActivacion><Fecha>
    const datosActivacion = findKeyRecursively(root, 'DatosActivacion') || findKeyRecursively(root, 'ActivacionCambiodeComercializadorConCambios');
    const fechaActivacion = findKeyRecursively(datosActivacion || root, 'Fecha') || findKeyRecursively(root, 'FechaActivacion');
    if (fechaActivacion) {
      result.fechaActivacionAlta = new Date(fechaActivacion);
    }

  } else if (paso === '11' || paso === '06') {
    // Baja
    // Buscar la fecha de finalización, suele ser <FechaFinalizacion> o <FechaBaja> o <FechaCese>
    const fechaFinalizacion = findKeyRecursively(root, 'FechaActivacionPrevista') || findKeyRecursively(root, 'FechaActivacion') || findKeyRecursively(root, 'FechaFinalizacion') || findKeyRecursively(root, 'FechaBaja') || findKeyRecursively(root, 'FechaCese') || findKeyRecursively(root, 'Fecha');
    if (fechaFinalizacion) {
      result.fechaActivacionBaja = new Date(fechaFinalizacion);
    }
  } else if (procesoBase === 'F1' && (paso === '01' || paso === '02')) {
    // Extracción de datos de factura de peaje
    const datosGenFactura = findKeyRecursively(root, 'DatosGeneralesFactura');
    const datosFacturaATR = findKeyRecursively(root, 'DatosFacturaATR');
    const periodo = datosFacturaATR?.Periodo;
    const iva = findKeyRecursively(root, 'IVA');
    const potencia = findKeyRecursively(root, 'Potencia');
    const energia = findKeyRecursively(root, 'EnergiaActiva');
    const cargos = findKeyRecursively(root, 'Cargos');

    if (datosGenFactura) {
      if (datosGenFactura.CodigoFiscalFactura) result.numeroFactura = String(datosGenFactura.CodigoFiscalFactura);
      if (datosGenFactura.FechaFactura) result.fechaEmision = new Date(datosGenFactura.FechaFactura);
      if (datosGenFactura.ImporteTotalFactura !== undefined) result.saldoFactura = Number(datosGenFactura.ImporteTotalFactura);
    }
    if (periodo) {
      if (periodo.FechaDesdeFactura) result.fechaInicio = new Date(periodo.FechaDesdeFactura);
      if (periodo.FechaHastaFactura) result.fechaFin = new Date(periodo.FechaHastaFactura);
    }
    if (iva && iva.BaseImponible !== undefined) {
      result.baseImponible = Number(iva.BaseImponible);
    }
    
    let p = 0;
    let e = 0;
    if (potencia && potencia.ImporteTotalTerminoPotencia !== undefined) {
      p = Number(potencia.ImporteTotalTerminoPotencia);
    }
    if (energia && energia.ImporteTotalEnergiaActiva !== undefined) {
      e = Number(energia.ImporteTotalEnergiaActiva);
    }
    result.totalPeajes = p + e;

    if (cargos && cargos.TotalImporteCargos !== undefined) {
      result.totalCargos = Number(cargos.TotalImporteCargos);
    }
  }

  // Extraer comentarios genéricos (muy útil en procesos R1 como paso 03 y 05)
  if (!result.observaciones) {
    const comentariosGen = findKeyRecursively(root, 'Comentarios');
    if (comentariosGen) {
      result.observaciones = String(comentariosGen);
    }
  }

  return result;
}
