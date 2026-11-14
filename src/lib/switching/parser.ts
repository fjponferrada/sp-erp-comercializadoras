import { XMLParser } from 'fast-xml-parser';
import { MOTIVOS_RECHAZO_CNMC } from '@/app/(app)/reclamaciones/utils/cnmc_codes';

/**
 * Decodifica de forma segura un XML de CNMC/SCTD tanto si viene en UTF-8 como en ISO-8859-1 / Windows-1252.
 */
export function decodeXmlBuffer(buffer: Buffer | ArrayBuffer | Uint8Array): string {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const header = Buffer.from(u8.subarray(0, Math.min(250, u8.length))).toString('latin1');
  if (/encoding\s*=\s*["']?(?:iso-8859-1|iso8859-1|latin1|windows-1252)["']?/i.test(header)) {
    return new TextDecoder('windows-1252').decode(u8);
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(u8);
  if (utf8.includes('\uFFFD')) {
    return new TextDecoder('windows-1252').decode(u8);
  }
  return utf8;
}

export interface ParsedSwitchingData {
  codigoSolicitud?: string;
  secuencialSolicitud?: string;
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
  // Campos M1 / C1 (Datos Técnicos)
  tarifaATR?: string;
  potenciasContratadas?: number[];
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
  const secuencialRaw = cabecera?.SecuencialDeSolicitud || cabecera?.SecuencialSolicitud;
  const secuencialSolicitud = secuencialRaw !== undefined && secuencialRaw !== null ? String(secuencialRaw).trim().padStart(2, '0') : undefined;
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
  // En R1: enviados = 01, 04, 08 (Remitente); recibidos = 02, 03, 05, 09 (Destinatario).
  // En el resto de procesos Switching: enviados = 01, 03; recibidos = resto.
  const remitente = cabecera?.Remitente?.CodigoRE || cabecera?.Remitente || cabecera?.CodigoREEEmpresaEmisora;
  const destinatario = cabecera?.Destinatario?.CodigoRE || cabecera?.Destinatario || cabecera?.CodigoREEEmpresaDestino;
  let codigoComercializadora = undefined;
  
  const isEnviado = procesoBase === 'R1'
    ? ['01', '04', '08'].includes(paso || '')
    : (paso === '01' || paso === '03');
  if (isEnviado) {
    codigoComercializadora = remitente !== undefined && remitente !== null ? String(remitente) : undefined;
  } else {
    codigoComercializadora = destinatario !== undefined && destinatario !== null ? String(destinatario) : undefined;
  }
  
  const nifCliente = findKeyRecursively(root, 'NIF') || findKeyRecursively(root, 'CIF') || findKeyRecursively(root, 'Identificador') || findKeyRecursively(root, 'Documento');

  // R1 Specific fields (normalizados a 2 y 3 dígitos)
  const normR1Tipo = (v: any): string | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const s = String(v).trim();
    return /^\d+$/.test(s) ? s.padStart(2, '0') : s;
  };
  const normR1Subtipo = (v: any): string | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const s = String(v).trim();
    if (/^\d{5,}$/.test(s)) return undefined;
    return /^\d{1,3}$/.test(s) ? s.padStart(3, '0') : s;
  };

  let tipoReclamacion = undefined;
  let subtipoReclamacion = undefined;
  if (procesoBase === 'R1') {
    const datosSolicitud = findKeyRecursively(root, 'DatosSolicitud') || findKeyRecursively(root, 'DatosDeLaSolicitud') || findKeyRecursively(root, 'DatosCierre') || findKeyRecursively(root, 'Retipificacion');
    tipoReclamacion = normR1Tipo(datosSolicitud?.Tipo ?? findKeyRecursively(datosSolicitud || root, 'Tipo'));
    subtipoReclamacion = normR1Subtipo(datosSolicitud?.Subtipo ?? findKeyRecursively(datosSolicitud || root, 'Subtipo'));
  }

  const result: ParsedSwitchingData = {
    codigoSolicitud: finalCodigoSolicitud ? String(finalCodigoSolicitud) : undefined,
    secuencialSolicitud,
    fechaSolicitud: isNaN(fechaSolicitudDate?.getTime() as number) ? undefined : fechaSolicitudDate,
    proceso,
    procesoBase,
    paso,
    cups: cups ? String(cups).trim().toUpperCase() : undefined,
    codigoComercializadora,
    codigoReclamacion: codigoReclamacion ? String(codigoReclamacion) : undefined,
    nifCliente: nifCliente ? String(nifCliente).toUpperCase().trim() : undefined,
    tipoReclamacion,
    subtipoReclamacion,
  };

  // 3. Lógica Específica por "Paso" (R1 aislado según Regla 125 para no interferir con C1/C2/M1/A3/B1/E1/E2)
  if (procesoBase === 'R1') {
    const extractR1Rechazos = (container: any) => {
      const rechazosParent = findKeyRecursively(container, 'Rechazos') || findKeyRecursively(container, 'MotivosRechazo') || container;
      const rawItems = rechazosParent?.Rechazo ?? rechazosParent?.MotivoRechazo;
      if (!rawItems) return null;
      const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
      return arr.map((item: any) => {
        if (typeof item !== 'object' || item === null) {
          const cod = String(item).trim().padStart(2, '0');
          return { codigo: cod, descripcion: MOTIVOS_RECHAZO_CNMC[cod] || '', comentarios: '' };
        }
        const rawCod = item.CodigoMotivo ?? item.CodigoMotivoRechazo ?? '';
        const cod = rawCod !== '' ? (/^\d+$/.test(String(rawCod).trim()) ? String(rawCod).trim().padStart(2, '0') : String(rawCod).trim()) : '';
        const comentarios = item.Comentarios ? String(item.Comentarios).trim() : '';
        const descripcion = cod ? (MOTIVOS_RECHAZO_CNMC[cod] || '') : '';
        return { codigo: cod, descripcion, comentarios };
      });
    };

    if (paso === '01') {
      const datosSol = findKeyRecursively(root, 'DatosSolicitud');
      if (datosSol?.FechaLimite) {
        const fl = new Date(datosSol.FechaLimite);
        if (!isNaN(fl.getTime())) result.fechaPrevActivacion = fl;
      }
      const solicitudNode = findKeyRecursively(root, 'SolicitudReclamacion') || root;
      if (solicitudNode?.Comentarios) {
        result.observaciones = String(solicitudNode.Comentarios).trim();
      }
    } else if (paso === '02' || paso === '09') {
      const isRechazo = findKeyRecursively(root, 'Rechazos') || findKeyRecursively(root, 'Rechazo') || findKeyRecursively(root, 'MotivosRechazo');
      if (isRechazo) {
        result.estadoAR = 'RECHAZADO';
        const fechaRechazo = findKeyRecursively(root, 'FechaRechazo') || findKeyRecursively(root, 'FechaAR');
        if (fechaRechazo) {
          const d = new Date(fechaRechazo);
          if (!isNaN(d.getTime())) result.fechaAR = d;
        }
        const motivos = extractR1Rechazos(root);
        if (motivos && motivos.length > 0) {
          result.motivosRechazo = motivos;
          const parts = motivos.map((m) => {
            const label = m.codigo ? `[${m.codigo}${m.descripcion ? ` - ${m.descripcion}` : ''}]` : '';
            return [label, m.comentarios].filter(Boolean).join(' ');
          }).filter(Boolean);
          if (parts.length > 0) result.observaciones = parts.join(' | ');
        }
      } else {
        result.estadoAR = 'ACEPTADO';
        const fechaAceptacion = findKeyRecursively(root, 'FechaAceptacion') || findKeyRecursively(root, 'FechaAR');
        if (fechaAceptacion) {
          const d = new Date(fechaAceptacion);
          if (!isNaN(d.getTime())) result.fechaAR = d;
        }
        const comentarios = findKeyRecursively(root, 'Comentarios');
        if (comentarios) result.observaciones = String(comentarios).trim();
      }
    } else if (paso === '03') {
      // Paso 03: Información adicional / Estado intermedio / Retipificación enviado por Distribuidora
      const infoNode = findKeyRecursively(root, 'InformacionAdicional') || root;
      const datosInfo = findKeyRecursively(infoNode, 'DatosInformacion');
      const tipoComRaw = datosInfo?.TipoComunicacion ?? findKeyRecursively(infoNode, 'TipoComunicacion');
      const tipoComunicacion = tipoComRaw ? String(tipoComRaw).trim().padStart(2, '0') : undefined;
      result.estadoAR = tipoComunicacion ? `COM_${tipoComunicacion}` : 'INFO_ADICIONAL';

      const fechaLimRaw = findKeyRecursively(infoNode, 'FechaLimiteEnvio');
      if (fechaLimRaw) {
        const fl = new Date(fechaLimRaw);
        if (!isNaN(fl.getTime())) result.fechaPrevActivacion = fl;
      }

      const retip = findKeyRecursively(infoNode, 'Retipificacion') || findKeyRecursively(infoNode, 'SolicitudInformacionAdicionalParaRetipificacion');
      if (retip) {
        const newTipo = normR1Tipo(retip.Tipo);
        const newSubtipo = normR1Subtipo(retip.Subtipo);
        if (newTipo) result.tipoReclamacion = newTipo;
        if (newSubtipo) result.subtipoReclamacion = newSubtipo;
      }

      const descParts: string[] = [];
      const descIntermedia = findKeyRecursively(infoNode, 'DescInformacionIntermedia');
      if (descIntermedia) descParts.push(String(descIntermedia).trim());
      const descRetip = findKeyRecursively(infoNode, 'DescRetipificacion');
      if (descRetip && !descParts.includes(String(descRetip).trim())) descParts.push(String(descRetip).trim());

      const solAdicParent = findKeyRecursively(infoNode, 'SolicitudesInformacionAdicional');
      const peticiones: any[] = [];
      if (solAdicParent?.SolicitudInformacionAdicional) {
        const arr = Array.isArray(solAdicParent.SolicitudInformacionAdicional)
          ? solAdicParent.SolicitudInformacionAdicional
          : [solAdicParent.SolicitudInformacionAdicional];
        for (const s of arr) {
          const descPet = s?.DescPeticionInformacion ? String(s.DescPeticionInformacion).trim() : '';
          peticiones.push({
            tipoInformacion: s?.TipoInformacionAdicional ? String(s.TipoInformacionAdicional).trim().padStart(2, '0') : undefined,
            descripcion: descPet || undefined,
            fechaLimiteEnvio: s?.FechaLimiteEnvio ? String(s.FechaLimiteEnvio) : undefined,
          });
          if (descPet && !descParts.includes(descPet)) descParts.push(descPet);
        }
      }

      if (infoNode?.Comentarios) {
        const com = String(infoNode.Comentarios).trim();
        if (com && !descParts.includes(com)) descParts.push(com);
      }

      if (descParts.length > 0) {
        result.observaciones = descParts.join(' — ');
      }
      result.motivosRechazo = {
        tipoComunicacion,
        fechaLimiteEnvio: fechaLimRaw ? String(fechaLimRaw) : undefined,
        peticiones: peticiones.length > 0 ? peticiones : undefined,
      };
    } else if (paso === '04') {
      // Paso 04: Respuesta de Comercializadora con información adicional (NO es rechazo)
      result.estadoAR = 'INFO_ENVIADA';
      const datosEnvio = findKeyRecursively(root, 'DatosEnvioInformacion');
      if (datosEnvio?.FechaInformacion) {
        const fi = new Date(datosEnvio.FechaInformacion);
        if (!isNaN(fi.getTime())) result.fechaAR = fi;
      }
      const envioNode = findKeyRecursively(root, 'EnvioInformacionReclamacion') || root;
      if (envioNode?.Comentarios) {
        result.observaciones = String(envioNode.Comentarios).trim();
      }
    } else if (paso === '05') {
      // Paso 05: Cierre de Reclamación enviado por Distribuidora
      const cierreNode = findKeyRecursively(root, 'CierreReclamacion') || root;
      const datosCierre = findKeyRecursively(cierreNode, 'DatosCierre');
      if (datosCierre) {
        if (datosCierre.Fecha) {
          const horaStr = datosCierre.Hora ? `T${String(datosCierre.Hora).trim()}` : '';
          const dWithTime = horaStr ? new Date(`${datosCierre.Fecha}${horaStr}`) : new Date(datosCierre.Fecha);
          const dFallback = new Date(datosCierre.Fecha);
          result.fechaActivacionAlta = !isNaN(dWithTime.getTime()) ? dWithTime : (!isNaN(dFallback.getTime()) ? dFallback : undefined);
        }
        const cierreTipo = normR1Tipo(datosCierre.Tipo);
        const cierreSubtipo = normR1Subtipo(datosCierre.Subtipo);
        if (cierreTipo) result.tipoReclamacion = cierreTipo;
        if (cierreSubtipo) result.subtipoReclamacion = cierreSubtipo;
      }

      const resultadoRaw = datosCierre?.ResultadoReclamacion ?? findKeyRecursively(cierreNode, 'ResultadoReclamacion');
      const resultado = resultadoRaw ? String(resultadoRaw).trim().padStart(2, '0') : undefined;
      result.estadoAR = resultado ? `RES_${resultado}` : 'CERRADA';

      const detalleResultado = datosCierre?.DetalleResultado ? String(datosCierre.DetalleResultado).trim() : undefined;
      const indemnizacion = datosCierre?.IndemnizacionAbonada !== undefined ? Number(datosCierre.IndemnizacionAbonada) : undefined;
      const numExpFraude = datosCierre?.NumExpedienteAnomaliaFraude ? String(datosCierre.NumExpedienteAnomaliaFraude).trim() : undefined;
      const fechaMov = datosCierre?.FechaMovimiento ? String(datosCierre.FechaMovimiento).trim() : undefined;

      result.motivosRechazo = {
        resultado,
        detalleResultado,
        indemnizacionAbonada: indemnizacion !== undefined && !isNaN(indemnizacion) ? indemnizacion : undefined,
        numExpedienteAnomaliaFraude: numExpFraude,
        fechaMovimiento: fechaMov,
      };

      const obsParts: string[] = [];
      if (datosCierre?.Observaciones) {
        const obs = String(datosCierre.Observaciones).trim();
        if (obs) obsParts.push(obs);
      }
      if (cierreNode?.Comentarios) {
        const com = String(cierreNode.Comentarios).trim();
        if (com && !obsParts.includes(com)) obsParts.push(com);
      }
      if (obsParts.length > 0) {
        result.observaciones = obsParts.join('\n');
      }
    } else if (paso === '08') {
      result.estadoAR = 'ANULACION_SOLICITADA';
    }
  } else if (paso === '02') {
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
    const tarifaATR = findKeyRecursively(datosActivacion || root, 'TarifaATR');
    if (tarifaATR) result.tarifaATR = String(tarifaATR);
    
    const potenciasNode = findKeyRecursively(datosActivacion || root, 'PotenciasContratadas');
    if (potenciasNode && potenciasNode.Potencia) {
      const p = Array.isArray(potenciasNode.Potencia) ? potenciasNode.Potencia : [potenciasNode.Potencia];
      result.potenciasContratadas = p.map((val: any) => parseFloat(val?.PotenciaContratada || val)).filter((n: number) => !isNaN(n));
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
