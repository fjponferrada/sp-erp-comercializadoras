import { XMLParser } from 'fast-xml-parser';

export interface ParsedSwitchingData {
  codigoSolicitud?: string;
  nifCliente?: string;
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
  motivosRechazo?: any;
  actuacionCampo?: boolean;
  codigoComercializadora?: string;
  codigoReclamacion?: string;
  tipoReclamacion?: string;
  subtipoReclamacion?: string;
  // Campos F1
  numeroFactura?: string;
  fechaEmision?: Date;
  fechaInicio?: Date;
  fechaFin?: Date;
  baseImponible?: number;
  totalPeajes?: number;
  totalCargos?: number;
  saldoFactura?: number;
  // Campos Autoconsumo
  cau?: string;
  tipoAutoconsumo?: string;
  cauSubtype?: string;
  cauCollective?: string;
  cil?: string;
  generatorTechnology?: string;
  installedPowerGen?: number;
  installationType?: string;
  meteringScheme?: string;
  // Campos Reposición (E2)
  codigoDeSolicitudRef?: string;
  tipoDeReposicion?: string;
  fechaPrevistaAccion?: Date;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // Crucial para normalizar <ns2:Cabecera> a Cabecera
  parseTagValue: true,
  trimValues: true,
  numberParseOptions: {
    hex: true,
    leadingZeros: false, // Evita que "01" se convierta en 1 matemático
  }
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
  
  const nifCliente = findKeyRecursively(root, 'NIF') || findKeyRecursively(root, 'CIF') || findKeyRecursively(root, 'Documento');

  // R1 Specific fields
  let tipoReclamacion = undefined;
  let subtipoReclamacion = undefined;
  if (procesoBase === 'R1') {
    const datosSolicitud = findKeyRecursively(root, 'DatosSolicitud') || findKeyRecursively(root, 'DatosDeLaSolicitud');
    tipoReclamacion = findKeyRecursively(datosSolicitud || root, 'Tipo');
    subtipoReclamacion = findKeyRecursively(datosSolicitud || root, 'Subtipo');
  }

  const result: ParsedSwitchingData = {
    codigoSolicitud: finalCodigoSolicitud ? String(finalCodigoSolicitud) : undefined,
    fechaSolicitud: isNaN(fechaSolicitudDate?.getTime() as number) ? undefined : fechaSolicitudDate,
    proceso,
    procesoBase,
    paso,
    cups: cups ? String(cups) : undefined,
    codigoComercializadora,
    codigoReclamacion: codigoReclamacion ? String(codigoReclamacion) : undefined,
    nifCliente: nifCliente ? String(nifCliente).toUpperCase().trim() : undefined,
    tipoReclamacion: tipoReclamacion ? String(tipoReclamacion) : undefined,
    subtipoReclamacion: subtipoReclamacion ? String(subtipoReclamacion) : undefined,
  };

  // 3. Lógica Específica por "Paso"
  if (paso === '02') {
    // Puede ser Aceptación o Rechazo
    const isRechazo = findKeyRecursively(root, 'Rechazo') || findKeyRecursively(root, 'MotivosRechazo');
    if (isRechazo) {
      result.estadoAR = 'RECHAZADO';
      const fechaRechazo = findKeyRecursively(root, 'FechaRechazo') || findKeyRecursively(root, 'FechaAR');
      if (fechaRechazo) result.fechaAR = new Date(fechaRechazo);
      const motivosRechazo = findKeyRecursively(root, 'MotivosRechazo');
      if (motivosRechazo) {
        result.motivosRechazo = motivosRechazo;
      }
    } else {
      result.estadoAR = 'ACEPTADO';
      const fechaAceptacion = findKeyRecursively(root, 'FechaAceptacion') || findKeyRecursively(root, 'FechaAR');
      if (fechaAceptacion) {
        result.fechaAR = new Date(fechaAceptacion);
      }
      const fechaPrevista = findKeyRecursively(root, 'FechaPrevistaAccion') || findKeyRecursively(root, 'FechaActivacionPrevista');
      if (fechaPrevista) {
        result.fechaPrevActivacion = new Date(fechaPrevista);
      }
    }
    
    // Check for ActuacionCampo (C2 acceptance might inform if it really requires field work)
    const actuacionCampo = findKeyRecursively(root, 'ActuacionCampo') || findKeyRecursively(root, 'ConActuacionCampo') || findKeyRecursively(root, 'RequiereActuacionCampo');
    if (actuacionCampo !== undefined) {
      const val = String(actuacionCampo).trim().toUpperCase();
      if (val === 'S' || val === 'TRUE' || val === '1') {
        result.actuacionCampo = true;
      } else if (val === 'N' || val === 'FALSE' || val === '0') {
        result.actuacionCampo = false;
      }
    }

    const observaciones = findKeyRecursively(root, 'Comentarios');
    if (observaciones) {
      result.observaciones = String(observaciones);
    }

  } else if (paso === '04') {
    // Rechazo explícito
    result.estadoAR = 'RECHAZADO';
    const causas = root.RechazoPeticion?.MotivosRechazo || root.RechazoReclamacion?.MotivosRechazo || root.RechazoReposicion?.MotivosRechazo || root.RechazoReposicionReceptor?.MotivosRechazo || root.MotivosRechazo;
    if (causas) {
      if (Array.isArray(causas.MotivoRechazo)) {
        result.motivosRechazo = causas.MotivoRechazo.map((m: any) => String(m.CodigoMotivoRechazo || m));
      } else if (causas.MotivoRechazo) {
        result.motivosRechazo = [String(causas.MotivoRechazo.CodigoMotivoRechazo || causas.MotivoRechazo)];
      }
    }
  } else if (proceso === 'E2') {
    // Proceso E2: Reposición
    if (paso === '14') {
      const solicitud = findKeyRecursively(root, 'SolicitudReposicion');
      if (solicitud) {
        if (solicitud.CodigoDeSolicitudRef) result.codigoDeSolicitudRef = String(solicitud.CodigoDeSolicitudRef);
        if (solicitud.TipoDeReposicion) result.tipoDeReposicion = String(solicitud.TipoDeReposicion);
        if (solicitud.FechaPrevistaAccion) result.fechaPrevistaAccion = new Date(solicitud.FechaPrevistaAccion);
      }
    } else if (paso === '15') {
      // AceptacionReposicionReceptor / RechazoReposicionReceptor
      if (root.AceptacionReposicionReceptor) {
        result.estadoAR = 'ACEPTADO';
        result.fechaAR = new Date(root.AceptacionReposicionReceptor.FechaAceptacion || result.fechaSolicitud || new Date());
      } else if (root.RechazoReposicionReceptor) {
        result.estadoAR = 'RECHAZADO';
        result.fechaAR = new Date(root.RechazoReposicionReceptor.FechaRechazo || result.fechaSolicitud || new Date());
        const causas = root.RechazoReposicionReceptor.MotivosRechazo;
        if (causas) {
          if (Array.isArray(causas.MotivoRechazo)) {
            result.motivosRechazo = causas.MotivoRechazo.map((m: any) => String(m.CodigoMotivoRechazo || m));
          } else if (causas.MotivoRechazo) {
            result.motivosRechazo = [String(causas.MotivoRechazo.CodigoMotivoRechazo || causas.MotivoRechazo)];
          }
        }
      }
    } else if (paso === '01') {
      const solicitud = findKeyRecursively(root, 'SolicitudReposicion');
      if (solicitud) {
        if (solicitud.CodigoDeSolicitudRef) result.codigoDeSolicitudRef = String(solicitud.CodigoDeSolicitudRef);
        if (solicitud.TipoDeReposicion) result.tipoDeReposicion = String(solicitud.TipoDeReposicion);
      }
    } else if (paso === '05' || paso === '06') {
      // Activación o Baja por Reposición
      const fechaActivacion = findKeyRecursively(root, 'FechaActivacion') || findKeyRecursively(root, 'FechaActivacionBaja') || findKeyRecursively(root, 'FechaFinalizacion');
      if (fechaActivacion) {
        result.fechaActivacionAlta = new Date(fechaActivacion);
      }
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

  // Extracción global de Autoconsumo (relevante en M2_05, D1_01, etc.)
  const autoconsumo = findKeyRecursively(root, 'Autoconsumo') || findKeyRecursively(root, 'ModificacionAutoconsumo');
  if (autoconsumo) {
    const cau = findKeyRecursively(autoconsumo, 'CAU');
    const tipoAutoconsumo = findKeyRecursively(autoconsumo, 'TipoAutoconsumo');
    const tipoSubseccion = findKeyRecursively(autoconsumo, 'TipoSubseccion');
    const colectivo = findKeyRecursively(autoconsumo, 'Colectivo');
    const cil = findKeyRecursively(autoconsumo, 'CIL');
    const tecGenerador = findKeyRecursively(autoconsumo, 'TecGenerador');
    const potInstaladaGen = findKeyRecursively(autoconsumo, 'PotInstaladaGen');
    const tipoInstalacion = findKeyRecursively(autoconsumo, 'TipoInstalacion');
    const esquemaMedida = findKeyRecursively(autoconsumo, 'EsquemaMedida');
    const tipoCups = findKeyRecursively(autoconsumo, 'TipoCUPS');
    
    if (tipoCups) (result as any).tipoCups = String(tipoCups).padStart(2, '0');
    if (cau) result.cau = String(cau);
    if (tipoAutoconsumo) result.tipoAutoconsumo = String(tipoAutoconsumo);
    if (tipoSubseccion) result.cauSubtype = String(tipoSubseccion);
    if (colectivo) result.cauCollective = String(colectivo);
    if (cil) result.cil = String(cil);
    if (tecGenerador) result.generatorTechnology = String(tecGenerador);
    if (potInstaladaGen) result.installedPowerGen = Number(potInstaladaGen);
    if (tipoInstalacion) result.installationType = String(tipoInstalacion);
    if (esquemaMedida) result.meteringScheme = String(esquemaMedida);
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
