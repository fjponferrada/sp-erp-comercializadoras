import { XMLParser } from 'fast-xml-parser';
import { MOTIVOS_RECHAZO_CNMC } from '@/app/(app)/reclamaciones/utils/cnmc_codes';

/**
 * Mapeo oficial CNMC Tabla 17 (TarifaATR) -> Código de tarifa ERP
 */
export const CNMC_TARIFA_TO_ERP: Record<string, string> = {
  '018': '2.0TD',
  '18': '2.0TD',
  '019': '3.0TD',
  '19': '3.0TD',
  '020': '6.1TD',
  '20': '6.1TD',
  '021': '6.2TD',
  '21': '6.2TD',
  '022': '6.3TD',
  '22': '6.3TD',
  '023': '6.4TD',
  '23': '6.4TD',
  '024': '3.0TDVE',
  '24': '3.0TDVE',
  '025': '6.1TDVE',
  '25': '6.1TDVE',
  '026': '6.2TDVE',
  '26': '6.2TDVE',
  '027': '3.0TDVE',
  '028': '6.1TDVE',
  '029': '6.2TDVE',
  '001': '2.0A',
  '003': '3.0A',
  '004': '2.0DHA',
  '005': '2.1A',
  '006': '2.1DHA',
  '011': '3.1A',
};

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
  isEnviado?: boolean;
  estadoAR?: string;
  fechaAR?: Date;
  fechaPrevActivacion?: Date;
  fechaActivacionAlta?: Date;
  fechaActivacionBaja?: Date;
  observaciones?: string;
  motivosRechazo?: any;
  actuacionCampo?: boolean;
  codigoComercializadora?: string;
  codigoDistribuidora?: string;
  codigoReclamacion?: string;
  tipoReclamacion?: string;
  subtipoReclamacion?: string;
  // Flags semánticos de pasos CNMC
  esIncidencia?: boolean;
  isAnulacionSolicitud?: boolean;
  isAnulacionAceptada?: boolean;
  motivoBaja?: string;
  // Campos M1 / C1 / A3 / C2 (Datos Técnicos normalizados a kW y tarifa ERP)
  tarifaATR?: string;
  potenciasContratadas?: Array<number | undefined>;
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
  tipoCups?: string;
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

function parseValidDate(val: any): Date | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const s = typeof val === 'object' && '#text' in val ? String(val['#text']).trim() : String(val).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

function extractTextValue(val: any): string | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'object') {
    if ('#text' in val) return String(val['#text']).trim();
    return undefined;
  }
  return String(val).trim();
}

/**
 * Busca de forma recursiva una clave en un objeto anidado.
 * Útil porque la estructura bajo <Mensaje> varía por tipo.
 */
function findKeyRecursively(obj: any, targetKey: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (targetKey in obj) return obj[targetKey];

  for (const key of Object.keys(obj)) {
    if (key.startsWith('@_')) continue;
    const found = findKeyRecursively(obj[key], targetKey);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Determina si un mensaje CNMC V3.0 es ENVIADO por la comercializadora (true) o RECIBIDO desde distribuidora (false).
 * Prioriza contrastar Remitente/Destinatario contra los códigos REE propios de nuestras comercializadoras.
 */
export function determineIsEnviado(
  procesoBase: string,
  paso: string | undefined,
  remitente?: string,
  destinatario?: string,
  ownReeCodes: string[] = ['1713']
): boolean {
  const normCode = (c?: string) => (c && /^\d{1,4}$/.test(c.trim()) ? c.trim().padStart(4, '0') : c?.trim());
  const rem = normCode(remitente);
  const dest = normCode(destinatario);
  const normalizedOwn = new Set(ownReeCodes.filter(Boolean).map(c => normCode(c)!));

  if (rem && normalizedOwn.has(rem) && (!dest || !normalizedOwn.has(dest))) {
    return true;
  }
  if (dest && normalizedOwn.has(dest) && (!rem || !normalizedOwn.has(rem))) {
    return false;
  }

  // Matriz normativa CNMC V3.0 por proceso y paso
  const p = paso || '';
  switch (procesoBase) {
    case 'Q1':
    case 'B2':
    case 'T1':
    case 'F1':
    case 'M2':
      return false; // Siempre emitidos por la distribuidora
    case 'D1':
      return p === '02'; // 01/07/10 distribuidora -> 02 rechazo comercializadora
    case 'J1':
      return ['02', '04', '53'].includes(p); // Expedientes anomalía/fraude: 01/05/52 distribuidora -> comercializadora
    case 'R1':
      return ['01', '04', '08'].includes(p); // 01 solicitud, 04 envío info, 08 anulación
    case 'E2':
      return ['01', '03', '08', '15'].includes(p);
    case 'A3':
    case 'M1':
      return ['01', '06'].includes(p); // 01 solicitud, 06 anulación (03 es incidencia recibida de distribuidora)
    case 'C1':
    case 'C2':
      return ['01', '08'].includes(p); // 01 solicitud, 08 anulación (03 es incidencia recibida de distribuidora)
    case 'B1':
    case 'E1':
      return ['01', '03'].includes(p); // 01 solicitud, 03 anulación
    case 'W1':
    case 'P0':
      return p === '01';
    default:
      return p === '01';
  }
}

/**
 * Extrae la lista normalizada de motivos de rechazo CNMC V3.0 (Tabla 27)
 * soportando <Rechazos><Rechazo>, <RechazosPeticion><Rechazo>, <RechazoReposicionReceptor> y <MotivosRechazo>.
 */
function extractCnmcRechazos(container: any): Array<{ codigo: string; descripcion: string; comentarios: string }> | null {
  const rechazosParent =
    findKeyRecursively(container, 'Rechazos') ||
    findKeyRecursively(container, 'RechazosPeticion') ||
    findKeyRecursively(container, 'MotivosRechazo') ||
    findKeyRecursively(container, 'RechazoReposicionReceptor') ||
    container;

  const rawItems = rechazosParent?.Rechazo ?? rechazosParent?.MotivoRechazo;
  if (!rawItems) return null;

  const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
  const parsed = arr
    .map((item: any) => {
      if (typeof item !== 'object' || item === null) {
        const cod = String(item).trim().padStart(2, '0');
        return { codigo: cod, descripcion: MOTIVOS_RECHAZO_CNMC[cod] || '', comentarios: '' };
      }
      const rawCod = extractTextValue(item.CodigoMotivo ?? item.CodigoMotivoRechazo) ?? '';
      const cod = rawCod !== '' ? (/^\d+$/.test(rawCod) ? rawCod.padStart(2, '0') : rawCod) : '';
      const comentarios = extractTextValue(item.Comentarios) ?? '';
      const descripcion = cod ? (MOTIVOS_RECHAZO_CNMC[cod] || '') : '';
      return { codigo: cod, descripcion, comentarios };
    })
    .filter(r => r.codigo || r.comentarios);

  return parsed.length > 0 ? parsed : null;
}

/**
 * Extrae <PotenciasContratadas><Potencia Periodo="1..6">4600</Potencia></PotenciasContratadas>
 * respetando el atributo @Periodo y convirtiendo vatios enteros CNMC (xs:long) a kW.
 */
function extractPotenciasKw(container: any): Array<number | undefined> | undefined {
  const potenciasNode = findKeyRecursively(container, 'PotenciasContratadas');
  if (!potenciasNode || potenciasNode.Potencia === undefined) return undefined;

  const items = Array.isArray(potenciasNode.Potencia) ? potenciasNode.Potencia : [potenciasNode.Potencia];
  const slots: Array<number | undefined> = [undefined, undefined, undefined, undefined, undefined, undefined];
  let anyValid = false;

  items.forEach((item: any, idx: number) => {
    let rawVal: string | undefined;
    let periodoIdx = idx;

    if (item && typeof item === 'object') {
      rawVal = extractTextValue(item) ?? extractTextValue(item.PotenciaContratada);
      const pAttr = item['@_Periodo'] ?? item.Periodo;
      if (pAttr !== undefined) {
        const pNum = parseInt(String(pAttr).trim(), 10);
        if (pNum >= 1 && pNum <= 6) periodoIdx = pNum - 1;
      }
    } else if (item !== undefined && item !== null) {
      rawVal = String(item).trim();
    }

    if (rawVal !== undefined && rawVal !== '') {
      const num = parseFloat(rawVal);
      if (!isNaN(num) && periodoIdx >= 0 && periodoIdx < 6) {
        // En CNMC TiposSencillos.xsd, Potencia es xs:long en vatios enteros (ej. 4600 -> 4.6 kW).
        // Si viniera ya con decimales explícitos y < 500 (ej. XML interno de test), se respeta.
        const hasDecimalDot = rawVal.includes('.');
        const kw = !hasDecimalDot ? Number((num / 1000).toFixed(6)) : num;
        slots[periodoIdx] = kw;
        anyValid = true;
      }
    }
  });

  return anyValid ? slots : undefined;
}

function normalizeTarifaATR(rawTarifa: any): string | undefined {
  const s = extractTextValue(rawTarifa);
  if (!s) return undefined;
  const padded = /^\d{1,2}$/.test(s) ? s.padStart(3, '0') : s;
  return CNMC_TARIFA_TO_ERP[padded] || CNMC_TARIFA_TO_ERP[s] || s;
}

export function parseSwitchingXml(xmlString: string, ownReeCodes: string[] = ['1713']): ParsedSwitchingData {
  const jsonObj = parser.parse(xmlString);

  // La raíz puede llamarse MensajeAceptacion..., MensajeRechazo..., MensajeC101...
  const rootKey = Object.keys(jsonObj).find(k => k !== '?xml');
  const root = rootKey ? jsonObj[rootKey] : jsonObj;

  // 1. Extraer Cabecera Universal (o sus variantes R1, Q1)
  const cabecera =
    findKeyRecursively(root, 'Cabecera') ||
    findKeyRecursively(root, 'CabeceraReclamacion') ||
    findKeyRecursively(root, 'CabeceraQ1');

  const codigoSolicitud = extractTextValue(cabecera?.CodigoDeSolicitud ?? cabecera?.CodigoSolicitud);
  const secuencialRaw = extractTextValue(cabecera?.SecuencialDeSolicitud ?? cabecera?.SecuencialSolicitud);
  const secuencialSolicitud = secuencialRaw ? secuencialRaw.padStart(2, '0') : undefined;
  const codigoPaso = extractTextValue(cabecera?.CodigoDePaso ?? cabecera?.CodigoPaso);
  let codigoProceso = extractTextValue(cabecera?.CodigoDelProceso ?? cabecera?.CodigoProceso ?? cabecera?.CodigoDeProceso);
  if (!codigoProceso && rootKey?.toUpperCase().includes('Q1')) {
    codigoProceso = 'Q1';
  }
  const rawCabeceraCodigo = extractTextValue(cabecera?.Codigo);
  const cups =
    extractTextValue(cabecera?.CUPS) ||
    (rawCabeceraCodigo && rawCabeceraCodigo.toUpperCase().startsWith('ES') ? rawCabeceraCodigo : undefined) ||
    extractTextValue(findKeyRecursively(root, 'CUPS'));

  // Extraer el código de reclamación si existe en el proceso (R1)
  const codigoReclamacion =
    extractTextValue(findKeyRecursively(root, 'CodigoReclamacionDistribuidora')) ||
    extractTextValue(findKeyRecursively(root, 'CodigoReclamacion')) ||
    extractTextValue(findKeyRecursively(root, 'CodigoDeReclamacion'));

  const fallbackCodigoSolicitud = extractTextValue(findKeyRecursively(root, 'CodigoSolicitudReclamacion')) || codigoReclamacion;
  const finalCodigoSolicitud = codigoSolicitud || fallbackCodigoSolicitud;

  const fechaSolicitudDate = parseValidDate(cabecera?.FechaSolicitud);

  // 2. Determinar Proceso y Base
  const proceso = codigoProceso ? String(codigoProceso).trim().toUpperCase() : 'DESC';
  const paso = codigoPaso ? String(codigoPaso).trim().padStart(2, '0') : undefined;
  let procesoBase = proceso.substring(0, 2);
  if (!procesoBase) procesoBase = 'DESC';

  const remitenteRaw =
    extractTextValue(cabecera?.Remitente?.CodigoRE) ??
    extractTextValue(cabecera?.Remitente) ??
    extractTextValue(cabecera?.CodigoREEEmpresaEmisora);
  const destinatarioRaw =
    extractTextValue(cabecera?.Destinatario?.CodigoRE) ??
    extractTextValue(cabecera?.Destinatario) ??
    extractTextValue(cabecera?.CodigoREEEmpresaDestino);

  const normRee = (v?: string) => (v && /^\d{1,4}$/.test(v) ? v.padStart(4, '0') : v);
  const remitente = normRee(remitenteRaw);
  const destinatario = normRee(destinatarioRaw);

  const isEnviado = determineIsEnviado(procesoBase, paso, remitente, destinatario, ownReeCodes);
  const codigoComercializadora = isEnviado ? remitente : destinatario;
  const codigoDistribuidora = isEnviado ? destinatario : remitente;

  const nifCliente =
    extractTextValue(findKeyRecursively(root, 'NIF')) ||
    extractTextValue(findKeyRecursively(root, 'CIF')) ||
    extractTextValue(findKeyRecursively(root, 'Identificador')) ||
    extractTextValue(findKeyRecursively(root, 'Documento'));

  // R1 Specific fields (normalizados a 2 y 3 dígitos)
  const normR1Tipo = (v: any): string | undefined => {
    const s = extractTextValue(v);
    if (!s) return undefined;
    return /^\d+$/.test(s) ? s.padStart(2, '0') : s;
  };
  const normR1Subtipo = (v: any): string | undefined => {
    const s = extractTextValue(v);
    if (!s || /^\d{5,}$/.test(s)) return undefined;
    return /^\d{1,3}$/.test(s) ? s.padStart(3, '0') : s;
  };

  let tipoReclamacion = undefined;
  let subtipoReclamacion = undefined;
  if (procesoBase === 'R1') {
    const datosSolicitud =
      findKeyRecursively(root, 'DatosSolicitud') ||
      findKeyRecursively(root, 'DatosDeLaSolicitud') ||
      findKeyRecursively(root, 'DatosCierre') ||
      findKeyRecursively(root, 'Retipificacion');
    tipoReclamacion = normR1Tipo(datosSolicitud?.Tipo ?? findKeyRecursively(datosSolicitud || root, 'Tipo'));
    subtipoReclamacion = normR1Subtipo(datosSolicitud?.Subtipo ?? findKeyRecursively(datosSolicitud || root, 'Subtipo'));
  }

  const result: ParsedSwitchingData = {
    codigoSolicitud: finalCodigoSolicitud ? String(finalCodigoSolicitud) : undefined,
    secuencialSolicitud,
    fechaSolicitud: fechaSolicitudDate,
    proceso,
    procesoBase,
    paso,
    cups: cups ? String(cups).trim().toUpperCase() : undefined,
    isEnviado,
    codigoComercializadora,
    codigoDistribuidora,
    codigoReclamacion: codigoReclamacion ? String(codigoReclamacion) : undefined,
    nifCliente: nifCliente ? String(nifCliente).toUpperCase().trim() : undefined,
    tipoReclamacion,
    subtipoReclamacion,
  };

  // Detectar de forma universal si el nodo raíz corresponde a Solicitud de Anulación o Aceptación de Anulación
  const aceptacionAnulacionNode = findKeyRecursively(root, 'AceptacionAnulacion');
  const isAnulacionStep =
    rootKey === 'MensajeAnulacionSolicitud' ||
    (paso === '06' && ['A3', 'M1'].includes(procesoBase)) ||
    (paso === '08' && ['C1', 'C2', 'E2', 'R1'].includes(procesoBase)) ||
    (paso === '03' && ['B1', 'E1', 'E2'].includes(procesoBase) && isEnviado);

  // 3. Lógica Específica por Proceso y Paso
  if (procesoBase === 'R1') {
    if (paso === '01') {
      const datosSol = findKeyRecursively(root, 'DatosSolicitud');
      const fl = parseValidDate(datosSol?.FechaLimite);
      if (fl) result.fechaPrevActivacion = fl;
      const solicitudNode = findKeyRecursively(root, 'SolicitudReclamacion') || root;
      const com = extractTextValue(solicitudNode?.Comentarios);
      if (com) result.observaciones = com;
    } else if (paso === '02' || paso === '09') {
      const motivos = extractCnmcRechazos(root);
      const isRechazo = Boolean(motivos || findKeyRecursively(root, 'Rechazos') || findKeyRecursively(root, 'FechaRechazo'));
      if (isRechazo && !aceptacionAnulacionNode) {
        result.estadoAR = 'RECHAZADO';
        const d = parseValidDate(findKeyRecursively(root, 'FechaRechazo') ?? findKeyRecursively(root, 'FechaAR'));
        if (d) result.fechaAR = d;
        if (motivos && motivos.length > 0) {
          result.motivosRechazo = motivos;
          const parts = motivos
            .map((m) => {
              const label = m.codigo ? `[${m.codigo}${m.descripcion ? ` - ${m.descripcion}` : ''}]` : '';
              return [label, m.comentarios].filter(Boolean).join(' ');
            })
            .filter(Boolean);
          if (parts.length > 0) result.observaciones = parts.join(' | ');
        }
      } else {
        result.estadoAR = 'ACEPTADO';
        if (paso === '09') result.isAnulacionAceptada = true;
        const d = parseValidDate(findKeyRecursively(root, 'FechaAceptacion') ?? findKeyRecursively(root, 'FechaAR'));
        if (d) result.fechaAR = d;
        const comentarios = extractTextValue(findKeyRecursively(root, 'Comentarios'));
        if (comentarios) result.observaciones = comentarios;
      }
    } else if (paso === '03') {
      // Paso 03: Información adicional / Estado intermedio / Retipificación enviado por Distribuidora
      const infoNode = findKeyRecursively(root, 'InformacionAdicional') || root;
      const datosInfo = findKeyRecursively(infoNode, 'DatosInformacion');
      const tipoComRaw = extractTextValue(datosInfo?.TipoComunicacion ?? findKeyRecursively(infoNode, 'TipoComunicacion'));
      const tipoComunicacion = tipoComRaw ? tipoComRaw.padStart(2, '0') : undefined;
      result.estadoAR = tipoComunicacion ? `COM_${tipoComunicacion}` : 'INFO_ADICIONAL';

      const fechaLimRaw = extractTextValue(findKeyRecursively(infoNode, 'FechaLimiteEnvio'));
      const fl = parseValidDate(fechaLimRaw);
      if (fl) result.fechaPrevActivacion = fl;

      const retip = findKeyRecursively(infoNode, 'Retipificacion') || findKeyRecursively(infoNode, 'SolicitudInformacionAdicionalParaRetipificacion');
      if (retip) {
        const newTipo = normR1Tipo(retip.Tipo);
        const newSubtipo = normR1Subtipo(retip.Subtipo);
        if (newTipo) result.tipoReclamacion = newTipo;
        if (newSubtipo) result.subtipoReclamacion = newSubtipo;
      }

      const descParts: string[] = [];
      const descIntermedia = extractTextValue(findKeyRecursively(infoNode, 'DescInformacionIntermedia'));
      if (descIntermedia) descParts.push(descIntermedia);
      const descRetip = extractTextValue(findKeyRecursively(infoNode, 'DescRetipificacion'));
      if (descRetip && !descParts.includes(descRetip)) descParts.push(descRetip);

      const solAdicParent = findKeyRecursively(infoNode, 'SolicitudesInformacionAdicional');
      const peticiones: any[] = [];
      if (solAdicParent?.SolicitudInformacionAdicional) {
        const arr = Array.isArray(solAdicParent.SolicitudInformacionAdicional)
          ? solAdicParent.SolicitudInformacionAdicional
          : [solAdicParent.SolicitudInformacionAdicional];
        for (const s of arr) {
          const descPet = extractTextValue(s?.DescPeticionInformacion) || '';
          const tipoInf = extractTextValue(s?.TipoInformacionAdicional);
          const fLimPet = extractTextValue(s?.FechaLimiteEnvio);
          peticiones.push({
            tipoInformacion: tipoInf ? tipoInf.padStart(2, '0') : undefined,
            descripcion: descPet || undefined,
            fechaLimiteEnvio: fLimPet || undefined,
          });
          if (descPet && !descParts.includes(descPet)) descParts.push(descPet);
        }
      }

      const com = extractTextValue(infoNode?.Comentarios);
      if (com && !descParts.includes(com)) descParts.push(com);

      if (descParts.length > 0) {
        result.observaciones = descParts.join(' — ');
      }
      result.motivosRechazo = {
        tipoComunicacion,
        fechaLimiteEnvio: fechaLimRaw || undefined,
        peticiones: peticiones.length > 0 ? peticiones : undefined,
      };
    } else if (paso === '04') {
      // Paso 04 en R1: Respuesta de Comercializadora con información adicional (NO es rechazo)
      result.estadoAR = 'INFO_ENVIADA';
      const datosEnvio = findKeyRecursively(root, 'DatosEnvioInformacion');
      const fi = parseValidDate(datosEnvio?.FechaInformacion);
      if (fi) result.fechaAR = fi;
      const envioNode = findKeyRecursively(root, 'EnvioInformacionReclamacion') || root;
      const com = extractTextValue(envioNode?.Comentarios);
      if (com) result.observaciones = com;
    } else if (paso === '05') {
      // Paso 05: Cierre de Reclamación enviado por Distribuidora
      const cierreNode = findKeyRecursively(root, 'CierreReclamacion') || root;
      const datosCierre = findKeyRecursively(cierreNode, 'DatosCierre');
      if (datosCierre) {
        const fechaRaw = extractTextValue(datosCierre.Fecha);
        if (fechaRaw) {
          const horaRaw = extractTextValue(datosCierre.Hora);
          const horaStr = horaRaw ? `T${horaRaw}` : '';
          result.fechaActivacionAlta = parseValidDate(`${fechaRaw}${horaStr}`) || parseValidDate(fechaRaw);
        }
        const cierreTipo = normR1Tipo(datosCierre.Tipo);
        const cierreSubtipo = normR1Subtipo(datosCierre.Subtipo);
        if (cierreTipo) result.tipoReclamacion = cierreTipo;
        if (cierreSubtipo) result.subtipoReclamacion = cierreSubtipo;
      }

      const resultadoRaw = extractTextValue(datosCierre?.ResultadoReclamacion ?? findKeyRecursively(cierreNode, 'ResultadoReclamacion'));
      const resultado = resultadoRaw ? resultadoRaw.padStart(2, '0') : undefined;
      result.estadoAR = resultado ? `RES_${resultado}` : 'CERRADA';

      const detalleResultado = extractTextValue(datosCierre?.DetalleResultado);
      const indemnizacion = datosCierre?.IndemnizacionAbonada !== undefined ? Number(extractTextValue(datosCierre.IndemnizacionAbonada)) : undefined;
      const numExpFraude = extractTextValue(datosCierre?.NumExpedienteAnomaliaFraude);
      const fechaMov = extractTextValue(datosCierre?.FechaMovimiento);

      result.motivosRechazo = {
        resultado,
        detalleResultado,
        indemnizacionAbonada: indemnizacion !== undefined && !isNaN(indemnizacion) ? indemnizacion : undefined,
        numExpedienteAnomaliaFraude: numExpFraude,
        fechaMovimiento: fechaMov,
      };

      const obsParts: string[] = [];
      const obs = extractTextValue(datosCierre?.Observaciones);
      if (obs) obsParts.push(obs);
      const com = extractTextValue(cierreNode?.Comentarios);
      if (com && !obsParts.includes(com)) obsParts.push(com);
      if (obsParts.length > 0) {
        result.observaciones = obsParts.join('\n');
      }
    } else if (paso === '08') {
      result.isAnulacionSolicitud = true;
      result.estadoAR = 'ANULACION_SOLICITADA';
    }
  } else if (isAnulacionStep) {
    // Solicitud de Anulación enviada por comercializadora (A3_06, M1_06, C1_08, C2_08, B1_03, E1_03, E2_08)
    result.isAnulacionSolicitud = true;
    result.estadoAR = 'ANULACION_SOLICITADA';
  } else if (aceptacionAnulacionNode || ['07', '09'].includes(paso || '') && ['A3', 'M1', 'C1', 'C2', 'E2'].includes(procesoBase)) {
    // Respuesta a Anulación (AceptacionAnulacion o Rechazo de Anulación en A3_07, M1_07, C1_09, C2_09, B1_04, E1_04, E2_09)
    const motivos = extractCnmcRechazos(root);
    if (motivos && !aceptacionAnulacionNode) {
      result.estadoAR = 'RECHAZADO';
      result.fechaAR = parseValidDate(findKeyRecursively(root, 'FechaRechazo'));
      result.motivosRechazo = motivos;
      result.observaciones = motivos
        .map(m => `${m.codigo ? `[${m.codigo}${m.descripcion ? ` - ${m.descripcion}` : ''}]` : ''} ${m.comentarios}`.trim())
        .filter(Boolean)
        .join(' | ');
    } else if (aceptacionAnulacionNode) {
      result.isAnulacionAceptada = true;
      result.estadoAR = 'ACEPTADO';
      result.fechaAR = parseValidDate(aceptacionAnulacionNode.FechaAceptacion ?? findKeyRecursively(root, 'FechaAceptacion'));
    }
  } else if (paso === '03' && ['A3', 'C1', 'C2', 'M1'].includes(procesoBase)) {
    // Incidencias ATR en actuación en campo notificadas por la distribuidora (Tabla 28)
    result.esIncidencia = true;
    result.estadoAR = 'INCIDENCIA';
    result.fechaAR = parseValidDate(findKeyRecursively(root, 'FechaIncidencia'));
    result.fechaPrevActivacion = parseValidDate(findKeyRecursively(root, 'FechaPrevistaAccion'));
    const incParent = findKeyRecursively(root, 'IncidenciasATRDistribuidor') || findKeyRecursively(root, 'Incidencias') || root;
    const rawIncs = incParent?.Incidencia;
    if (rawIncs) {
      const arr = Array.isArray(rawIncs) ? rawIncs : [rawIncs];
      const parsedIncs = arr.map((inc: any) => ({
        codigo: extractTextValue(inc?.CodigoMotivo) || '',
        comentarios: extractTextValue(inc?.Comentarios) || '',
      }));
      result.motivosRechazo = parsedIncs;
      const summary = parsedIncs
        .map(i => `${i.codigo ? `[Incidencia ${i.codigo}]` : ''} ${i.comentarios}`.trim())
        .filter(Boolean)
        .join(' | ');
      if (summary) result.observaciones = summary;
    }
  } else if (procesoBase === 'E2') {
    // Proceso E2: Reposición (incluye 01, 02, 04, 05, 06, 12, 14, 15)
    if (paso === '02' || paso === '04' || paso === '12') {
      const motivos = extractCnmcRechazos(root);
      const isRechazo = paso === '04' || paso === '12' || Boolean(motivos || findKeyRecursively(root, 'Rechazos') || findKeyRecursively(root, 'FechaRechazo'));
      if (isRechazo) {
        result.estadoAR = 'RECHAZADO';
        result.fechaAR =
          parseValidDate(
            findKeyRecursively(root, 'FechaRechazo') ??
            findKeyRecursively(root, 'FechaAR') ??
            findKeyRecursively(root, 'DatosRechazo')?.Fecha
          ) ?? (paso === '04' || paso === '12' ? fechaSolicitudDate : undefined);
        if (motivos) {
          result.motivosRechazo = motivos;
          result.observaciones = motivos
            .map(m => `${m.codigo ? `[${m.codigo}${m.descripcion ? ` - ${m.descripcion}` : ''}]` : ''} ${m.comentarios}`.trim())
            .filter(Boolean)
            .join(' | ');
        }
      } else {
        result.estadoAR = 'ACEPTADO';
        result.fechaAR = parseValidDate(findKeyRecursively(root, 'FechaAceptacion') ?? findKeyRecursively(root, 'FechaAR'));
        result.fechaPrevActivacion = parseValidDate(findKeyRecursively(root, 'FechaPrevistaAccion') ?? findKeyRecursively(root, 'FechaActivacionPrevista'));
      }
    } else if (paso === '14') {
      const solicitud = findKeyRecursively(root, 'SolicitudReposicion');
      if (solicitud) {
        const ref = extractTextValue(solicitud.CodigoDeSolicitudRef);
        const tipoRep = extractTextValue(solicitud.TipoDeReposicion);
        if (ref) result.codigoDeSolicitudRef = ref;
        if (tipoRep) result.tipoDeReposicion = tipoRep;
        result.fechaPrevistaAccion = parseValidDate(solicitud.FechaPrevistaAccion);
      }
    } else if (paso === '15') {
      // AceptacionReposicionReceptor / RechazoReposicionReceptor (NUNCA usar new Date() si falta fecha)
      const acNode = findKeyRecursively(root, 'AceptacionReposicionReceptor') || findKeyRecursively(root, 'DatosAceptacion');
      const recNode = findKeyRecursively(root, 'RechazoReposicionReceptor') || findKeyRecursively(root, 'Rechazos');
      if (acNode && !recNode) {
        result.estadoAR = 'ACEPTADO';
        result.fechaAR = parseValidDate(acNode.FechaAceptacion ?? findKeyRecursively(root, 'FechaAceptacion'));
      } else if (recNode) {
        result.estadoAR = 'RECHAZADO';
        result.fechaAR = parseValidDate(recNode.FechaRechazo ?? findKeyRecursively(root, 'FechaRechazo'));
        const motivos = extractCnmcRechazos(root);
        if (motivos) {
          result.motivosRechazo = motivos;
          result.observaciones = motivos
            .map(m => `${m.codigo ? `[${m.codigo}${m.descripcion ? ` - ${m.descripcion}` : ''}]` : ''} ${m.comentarios}`.trim())
            .filter(Boolean)
            .join(' | ');
        }
      }
    } else if (paso === '01') {
      const solicitud = findKeyRecursively(root, 'SolicitudReposicion');
      if (solicitud) {
        const ref = extractTextValue(solicitud.CodigoDeSolicitudRef);
        const tipoRep = extractTextValue(solicitud.TipoDeReposicion);
        if (ref) result.codigoDeSolicitudRef = ref;
        if (tipoRep) result.tipoDeReposicion = tipoRep;
      }
    } else if (paso === '05' || paso === '06') {
      const datosAct = findKeyRecursively(root, 'DatosActivacion');
      const d = parseValidDate(
        datosAct?.Fecha ??
        findKeyRecursively(root, 'FechaActivacion') ??
        findKeyRecursively(root, 'FechaActivacionBaja') ??
        findKeyRecursively(root, 'FechaFinalizacion')
      );
      if (paso === '05') {
        result.fechaActivacionAlta = d;
        result.tarifaATR = normalizeTarifaATR(findKeyRecursively(root, 'TarifaATR'));
        result.potenciasContratadas = extractPotenciasKw(root);
      } else {
        result.fechaActivacionBaja = d;
        result.fechaActivacionAlta = d;
      }
    }
  } else if (paso === '02' || paso === '04') {
    // Aceptación o Rechazo en A3, C1, C2, M1, B1, E1, D1, P0, W1
    const motivos = extractCnmcRechazos(root);
    const isRechazo =
      paso === '04' ||
      procesoBase === 'D1' ||
      Boolean(motivos || findKeyRecursively(root, 'Rechazos') || findKeyRecursively(root, 'RechazosPeticion') || findKeyRecursively(root, 'FechaRechazo'));

    if (isRechazo) {
      result.estadoAR = 'RECHAZADO';
      result.fechaAR =
        parseValidDate(
          findKeyRecursively(root, 'FechaRechazo') ??
          findKeyRecursively(root, 'FechaAR') ??
          findKeyRecursively(root, 'DatosRechazo')?.Fecha
        ) ?? (paso === '04' ? fechaSolicitudDate : undefined);
      if (motivos && motivos.length > 0) {
        result.motivosRechazo = motivos;
        const formatted = motivos
          .map(m => `${m.codigo ? `[${m.codigo}${m.descripcion ? ` - ${m.descripcion}` : ''}]` : ''} ${m.comentarios}`.trim())
          .filter(Boolean)
          .join(' | ');
        if (formatted) result.observaciones = formatted;
      }
    } else {
      result.estadoAR = 'ACEPTADO';
      result.fechaAR = parseValidDate(findKeyRecursively(root, 'FechaAceptacion') ?? findKeyRecursively(root, 'FechaAR'));
      result.fechaPrevActivacion = parseValidDate(findKeyRecursively(root, 'FechaPrevistaAccion') ?? findKeyRecursively(root, 'FechaActivacionPrevista'));
    }

    const actuacionCampo = extractTextValue(
      findKeyRecursively(root, 'ActuacionCampo') ??
      findKeyRecursively(root, 'ConActuacionCampo') ??
      findKeyRecursively(root, 'RequiereActuacionCampo')
    );
    if (actuacionCampo !== undefined) {
      const val = actuacionCampo.toUpperCase();
      if (val === 'S' || val === 'TRUE' || val === '1') {
        result.actuacionCampo = true;
      } else if (val === 'N' || val === 'FALSE' || val === '0') {
        result.actuacionCampo = false;
      }
    }

    if (!result.observaciones) {
      const observaciones = extractTextValue(findKeyRecursively(root, 'Comentarios'));
      if (observaciones) result.observaciones = observaciones;
    }
  } else if (procesoBase === 'J1') {
    // Expediente de Anomalía o Fraude (J1_01, J1_05 cierre/activación, J1_52 valoración, etc.)
    const numExp = extractTextValue(findKeyRecursively(root, 'NumExpediente'));
    const anomaliaNode = findKeyRecursively(root, 'AnomaliaFraude');
    const codAnom = extractTextValue(anomaliaNode?.CodAnomaliaFraude ?? findKeyRecursively(root, 'CodAnomaliaFraude'));
    const descAnom = extractTextValue(anomaliaNode?.Descripcion);
    const fechaActJ1 = parseValidDate(
      findKeyRecursively(root, 'FechaActivacion') ??
      findKeyRecursively(root, 'FechaInspeccion') ??
      findKeyRecursively(root, 'FechaAltaExpediente')
    );
    if (fechaActJ1) {
      result.fechaAR = fechaActJ1;
      if (paso === '05') result.fechaActivacionAlta = fechaActJ1;
    }
    const ivaJ1 = findKeyRecursively(root, 'IVA');
    const biJ1 = extractTextValue(ivaJ1?.BaseImponible);
    const totalJ1 = extractTextValue(ivaJ1?.ImporteTotal);
    const partsJ1 = [
      numExp ? `Expediente #${numExp}` : 'Expediente J1',
      [codAnom, descAnom].filter(Boolean).join(' - '),
      biJ1 ? `BI: ${biJ1} €${totalJ1 ? ` (Total: ${totalJ1} €)` : ''}` : '',
    ].filter(Boolean);
    if (partsJ1.length > 0) {
      result.observaciones = partsJ1.join(' | ');
    }
  } else if (paso === '05') {
    // Activación: A3, C1, C2, M1, M2 (alta/modificación) vs B1, B2, E1 (baja/suspensión)
    const datosActivacionBaja = findKeyRecursively(root, 'DatosActivacionBaja');
    const datosActivacion =
      datosActivacionBaja ||
      findKeyRecursively(root, 'DatosActivacion') ||
      findKeyRecursively(root, 'ActivacionCambiodeComercializadorConCambios');

    const fechaAct = parseValidDate(
      datosActivacion?.FechaActivacion ??
      datosActivacion?.Fecha ??
      findKeyRecursively(root, 'FechaActivacion') ??
      findKeyRecursively(root, 'FechaBaja')
    );

    const motivoRaw = extractTextValue(datosActivacionBaja?.Motivo ?? findKeyRecursively(root, 'Motivo'));
    if (motivoRaw) {
      result.motivoBaja = /^\d+$/.test(motivoRaw) ? motivoRaw.padStart(2, '0') : motivoRaw;
    }

    if (['B1', 'B2', 'E1'].includes(procesoBase)) {
      result.fechaActivacionBaja = fechaAct;
      result.fechaActivacionAlta = fechaAct;
    } else {
      result.fechaActivacionAlta = fechaAct;
      result.tarifaATR = normalizeTarifaATR(findKeyRecursively(root, 'TarifaATR'));
      result.potenciasContratadas = extractPotenciasKw(root);
    }
  } else if (paso === '11' || paso === '06' || (procesoBase === 'B1' && paso === '07')) {
    // Notificaciones de Baja / Aviso de Baja / Activación Desistimiento E1_06 / Aceptación E1_11
    const fechaExtraida = parseValidDate(
      findKeyRecursively(root, 'FechaActivacionPrevista') ??
      findKeyRecursively(root, 'FechaPrevistaAccion') ??
      findKeyRecursively(root, 'FechaActivacion') ??
      findKeyRecursively(root, 'FechaFinalizacion') ??
      findKeyRecursively(root, 'FechaBaja') ??
      findKeyRecursively(root, 'FechaCese') ??
      findKeyRecursively(root, 'DatosActivacion')?.Fecha ??
      findKeyRecursively(root, 'DatosNotificacion')?.FechaActivacion
    );

    if (procesoBase === 'E1' && paso === '06') {
      result.fechaActivacionAlta = fechaExtraida;
      result.fechaActivacionBaja = fechaExtraida;
    } else if (procesoBase === 'E1' && paso === '11') {
      result.fechaPrevActivacion = fechaExtraida;
      result.fechaActivacionBaja = fechaExtraida;
    } else {
      result.fechaActivacionBaja = fechaExtraida;
    }
  } else if (paso === '01' && procesoBase === 'B1') {
    const datosSol = findKeyRecursively(root, 'DatosSolicitud');
    const mot = extractTextValue(datosSol?.Motivo);
    if (mot) result.motivoBaja = /^\d+$/.test(mot) ? mot.padStart(2, '0') : mot;
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
      const codFisc = extractTextValue(datosGenFactura.CodigoFiscalFactura);
      if (codFisc) result.numeroFactura = codFisc;
      result.fechaEmision = parseValidDate(datosGenFactura.FechaFactura);
      const impTot = extractTextValue(datosGenFactura.ImporteTotalFactura);
      if (impTot !== undefined) result.saldoFactura = Number(impTot);
    }
    if (periodo) {
      result.fechaInicio = parseValidDate(periodo.FechaDesdeFactura);
      result.fechaFin = parseValidDate(periodo.FechaHastaFactura);
    }
    const bi = extractTextValue(iva?.BaseImponible);
    if (bi !== undefined) result.baseImponible = Number(bi);

    let p = 0;
    let e = 0;
    const impPot = extractTextValue(potencia?.ImporteTotalTerminoPotencia);
    if (impPot !== undefined) p = Number(impPot);
    const impEn = extractTextValue(energia?.ImporteTotalEnergiaActiva);
    if (impEn !== undefined) e = Number(impEn);
    result.totalPeajes = p + e;

    const impCargos = extractTextValue(cargos?.TotalImporteCargos);
    if (impCargos !== undefined) result.totalCargos = Number(impCargos);
  }

  // Extracción global de Autoconsumo (relevante en M2_05, D1_01, etc.)
  const autoconsumo = findKeyRecursively(root, 'Autoconsumo') || findKeyRecursively(root, 'ModificacionAutoconsumo');
  if (autoconsumo) {
    const cau = extractTextValue(findKeyRecursively(autoconsumo, 'CAU'));
    const tipoAutoconsumo = extractTextValue(findKeyRecursively(autoconsumo, 'TipoAutoconsumo'));
    const tipoSubseccion = extractTextValue(findKeyRecursively(autoconsumo, 'TipoSubseccion'));
    const colectivo = extractTextValue(findKeyRecursively(autoconsumo, 'Colectivo'));
    const cil = extractTextValue(findKeyRecursively(autoconsumo, 'CIL'));
    const tecGenerador = extractTextValue(findKeyRecursively(autoconsumo, 'TecGenerador'));
    const potInstaladaGenRaw = extractTextValue(findKeyRecursively(autoconsumo, 'PotInstaladaGen'));
    const tipoInstalacion = extractTextValue(findKeyRecursively(autoconsumo, 'TipoInstalacion'));
    const esquemaMedida = extractTextValue(findKeyRecursively(autoconsumo, 'EsquemaMedida'));
    const tipoCups = extractTextValue(findKeyRecursively(autoconsumo, 'TipoCUPS'));

    if (tipoCups) result.tipoCups = tipoCups.padStart(2, '0');
    if (cau) result.cau = cau;
    if (tipoAutoconsumo) result.tipoAutoconsumo = tipoAutoconsumo;
    if (tipoSubseccion) result.cauSubtype = tipoSubseccion;
    if (colectivo) result.cauCollective = colectivo;
    if (cil) result.cil = cil;
    if (tecGenerador) result.generatorTechnology = tecGenerador;
    if (potInstaladaGenRaw) {
      const pNum = parseFloat(potInstaladaGenRaw);
      if (!isNaN(pNum)) {
        // En CNMC TiposComplejos.xsd PotInstaladaGen es Potencia (xs:long en W)
        result.installedPowerGen = !potInstaladaGenRaw.includes('.') && pNum >= 100 ? Number((pNum / 1000).toFixed(4)) : pNum;
      }
    }
    if (tipoInstalacion) result.installationType = tipoInstalacion;
    if (esquemaMedida) result.meteringScheme = esquemaMedida;
  }

  // Extraer comentarios genéricos
  if (!result.observaciones) {
    const comentariosGen = extractTextValue(findKeyRecursively(root, 'Comentarios'));
    if (comentariosGen) {
      result.observaciones = comentariosGen;
    }
  }

  return result;
}
