'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId, hasAdminOrBackofficeRole } from '@/lib/companyContext';
import { ingestXmlStringInternal } from './switchingIngest';
import PizZip from 'pizzip';

function escapeXml(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatMadridDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}`;
}

function detectTipoIdentificadorCnmc(rawVat: string): 'NI' | 'NE' | 'PS' {
  const vat = rawVat.trim().toUpperCase();
  if (/^[XYZ]\d{7}[A-Z]$/.test(vat)) return 'NE';
  if (/^(\d{8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|[KLM]\d{7}[A-Z])$/.test(vat)) return 'NI';
  return 'PS';
}

let e2SeqCounter = 0;
function buildE2SolicitudCode(codEmisora: string): string {
  e2SeqCounter = (e2SeqCounter + 1) % 1000;
  const prefix = codEmisora.slice(0, 4).padStart(4, '0');
  const ts = String(Date.now()).slice(-5);
  const seq = String(e2SeqCounter).padStart(3, '0');
  return `${prefix}${ts}${seq}`;
}

async function requireCompanyContext() {
  const session = await auth();
  if (!session?.user?.id || !hasAdminOrBackofficeRole((session.user as any).role)) {
    throw new Error('No autorizado. Inicia sesión de nuevo.');
  }
  const activeCompanyId = await resolveActiveCompanyId(session);
  const company = activeCompanyId
    ? await prisma.company.findUnique({ where: { id: activeCompanyId }, select: { id: true, codigoRee: true } })
    : await prisma.company.findFirst({ select: { id: true, codigoRee: true } });

  if (!company) {
    throw new Error('No se encontró una comercializadora activa configurada.');
  }
  const codEmisora = (company.codigoRee || '').trim();
  if (!/^\d{4}$/.test(codEmisora)) {
    throw new Error('La comercializadora activa no tiene un Código REE válido de 4 dígitos configurado.');
  }
  return { session, companyId: company.id, codEmisora };
}

function extractTipoReposicionCode(obs?: string | null): string {
  if (!obs) return '';
  const firstSegment = String(obs).split('|')[0].trim();
  if (['01', '02', '03'].includes(firstSegment)) return firstSegment;
  const match = String(obs).match(/\b(01|02|03)\b/);
  return match?.[1] || firstSegment;
}

function buildE2_15Xml(data: {
  codEmisora: string;
  codDestino: string;
  codSolicitud: string;
  cups: string;
  isAccept: boolean;
  motivosRechazo?: string[];
  comentariosRechazo?: string;
}): string {
  const { codEmisora, codDestino, codSolicitud, cups, isAccept, motivosRechazo, comentariosRechazo } = data;
  const fechaHora = formatMadridDateTime(new Date());
  const fechaHoy = fechaHora.slice(0, 10);

  const rootElement = isAccept ? 'MensajeAceptacionReposicionReceptor' : 'MensajeRechazoReposicionReceptor';

  let body = `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} xmlns="http://localhost/elegibilidad">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${escapeXml(codEmisora)}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${escapeXml(codDestino)}</CodigoREEEmpresaDestino>
    <CodigoDelProceso>E2</CodigoDelProceso>
    <CodigoDePaso>15</CodigoDePaso>
    <CodigoDeSolicitud>${escapeXml(codSolicitud)}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaHora}</FechaSolicitud>
    <CUPS>${escapeXml(cups)}</CUPS>
  </Cabecera>`;

  if (!isAccept) {
    const validMotivos = (motivosRechazo || [])
      .map(m => m.trim().toUpperCase())
      .filter(m => /^[0-9A-Z]{2}$/.test(m));
    if (validMotivos.length === 0) {
      throw new Error('Debes indicar un código de motivo de rechazo válido de 2 caracteres (Tabla 27 CNMC).');
    }
    const cleanComment = (comentariosRechazo || '').trim().slice(0, 4000);
    const rechazosStr = validMotivos
      .map(
        (m, idx) => `
    <Rechazo>
      <Secuencial>${String(idx + 1).padStart(2, '0')}</Secuencial>
      <CodigoMotivo>${escapeXml(m)}</CodigoMotivo>
      <Comentarios>${escapeXml(cleanComment || `Rechazo de reposición por motivo ${m}`)}</Comentarios>
    </Rechazo>`
      )
      .join('');

    body += `
  <Rechazos>
    <FechaRechazo>${fechaHoy}</FechaRechazo>${rechazosStr}
  </Rechazos>`;
  }

  body += `\n</${rootElement}>`;

  return body;
}

function buildE2_01Xml(data: {
  codEmisora: string;
  codDestino: string;
  codSolicitud: string;
  cups: string;
  tipoReposicion: string;
  codigoRef: string;
  tipoIdentificador: string;
  identificador: string;
}): string {
  const { codEmisora, codDestino, codSolicitud, cups, tipoReposicion, codigoRef, tipoIdentificador, identificador } = data;
  const fechaHora = formatMadridDateTime(new Date());

  return `<?xml version="1.0" encoding="UTF-8"?>
<MensajeSolicitudReposicion xmlns="http://localhost/elegibilidad">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${escapeXml(codEmisora)}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${escapeXml(codDestino)}</CodigoREEEmpresaDestino>
    <CodigoDelProceso>E2</CodigoDelProceso>
    <CodigoDePaso>01</CodigoDePaso>
    <CodigoDeSolicitud>${escapeXml(codSolicitud)}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaHora}</FechaSolicitud>
    <CUPS>${escapeXml(cups)}</CUPS>
  </Cabecera>
  <SolicitudReposicion>
    <CodigoDeSolicitudRef>${escapeXml(codigoRef)}</CodigoDeSolicitudRef>
    <TipoDeReposicion>${escapeXml(tipoReposicion)}</TipoDeReposicion>
    <IdCliente>
      <TipoIdentificador>${escapeXml(tipoIdentificador)}</TipoIdentificador>
      <Identificador>${escapeXml(identificador)}</Identificador>
    </IdCliente>
  </SolicitudReposicion>
</MensajeSolicitudReposicion>`;
}

export async function getPendingE2_14() {
  try {
    const { companyId, codEmisora } = await requireCompanyContext();

    const events = await prisma.switchingEvent.findMany({
      where: {
        procesoBase: 'E2',
        paso: '14',
        isResolved: false,
        OR: [
          { contract: { brand: { companyId } } },
          { supplyPoint: { client: { brand: { companyId } } } },
          { uniqueProcess: { contains: `_${codEmisora}_` } },
          { AND: [{ contractId: null }, { supplyPointId: null }] },
        ],
      },
      include: {
        supplyPoint: true,
        contract: { select: { id: true, contractCode: true } },
      },
      orderBy: [{ fechaSolicitud: 'desc' }, { createdAt: 'desc' }],
    });
    const r2Url = process.env.R2_PUBLIC_URL || '';
    const enrichedEvents = events.map(e => ({
      ...e,
      tipoReposicionClean: extractTipoReposicionCode(e.observaciones),
      fullXmlUrl: e.xmlUrl
        ? e.xmlUrl.startsWith('http')
          ? e.xmlUrl
          : `${r2Url}/${e.xmlUrl}`
        : null,
    }));

    return { success: true, data: enrichedEvents };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export interface RecentLossCandidate {
  codigoSolicitud: string;
  proceso: string;
  paso: string;
  fecha: string | null;
  contractCode: string | null;
}

export async function fetchReposicionContext(cups: string) {
  try {
    const { companyId } = await requireCompanyContext();
    const cupsClean = (cups || '').trim().toUpperCase();
    if (cupsClean.length < 16 || !cupsClean.startsWith('ES')) {
      return { success: true, titular: null, recentLosses: [] as RecentLossCandidate[] };
    }

    const cups20 = cupsClean.substring(0, 20);
    const sps = await prisma.supplyPoint.findMany({
      where: {
        cups: { startsWith: cups20 },
        client: { brand: { companyId } },
      },
      include: {
        client: true,
        contracts: {
          orderBy: [{ terminationDate: 'desc' }, { version: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    });

    if (sps.length === 0) {
      return { success: true, notFound: true, titular: null, recentLosses: [] as RecentLossCandidate[] };
    }

    const primarySp = sps[0];
    const holder = primarySp.client;
    const lastContract = primarySp.contracts?.[0] || null;
    const titularName =
      holder?.businessName ||
      `${holder?.firstName || ''} ${holder?.lastName || ''}`.trim() ||
      'Sin nombre';

    const spIds = sps.map(s => s.id);
    const lossEvents = await prisma.switchingEvent.findMany({
      where: {
        supplyPointId: { in: spIds },
        procesoBase: { in: ['C1', 'C2'] },
        paso: { in: ['06', '11'] },
        codigoSolicitud: { not: null },
      },
      include: {
        contract: { select: { contractCode: true } },
      },
      orderBy: [{ fechaSolicitud: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    const seen = new Set<string>();
    const recentLosses: RecentLossCandidate[] = [];
    for (const ev of lossEvents) {
      const sol = (ev.codigoSolicitud || '').trim();
      if (!/^\d{12}$/.test(sol) || seen.has(sol)) continue;
      seen.add(sol);
      const dt = ev.fechaActivacionBaja || ev.fechaSolicitud;
      recentLosses.push({
        codigoSolicitud: sol,
        proceso: ev.procesoBase,
        paso: ev.paso || '06',
        fecha: dt ? dt.toISOString().split('T')[0] : null,
        contractCode: ev.contract?.contractCode || lastContract?.contractCode || null,
      });
    }

    return {
      success: true,
      notFound: false,
      cupsFull: primarySp.cups,
      titular: titularName,
      nif: holder?.vatNumber || '',
      contractId: lastContract?.id || null,
      contractCode: lastContract?.contractCode || null,
      contractStatus: lastContract?.status || null,
      recentLosses,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function respondToE2_14(
  eventId: string,
  isAccept: boolean,
  motivosRechazo?: string[],
  comentariosRechazo?: string,
  registerInErp: boolean = true
) {
  try {
    const { companyId, codEmisora } = await requireCompanyContext();

    const event = await prisma.switchingEvent.findFirst({
      where: {
        id: eventId,
        OR: [
          { contract: { brand: { companyId } } },
          { supplyPoint: { client: { brand: { companyId } } } },
          { uniqueProcess: { contains: `_${codEmisora}_` } },
          { AND: [{ contractId: null }, { supplyPointId: null }] },
        ],
      },
      include: {
        supplyPoint: true,
      },
    });

    if (!event || !event.supplyPoint?.cups) {
      throw new Error('Evento o punto de suministro no encontrado.');
    }

    const cupsRaw = event.supplyPoint.cups.trim().toUpperCase();
    const cupsClean = cupsRaw.length === 20 ? `${cupsRaw}0F` : cupsRaw;
    const codDestinoRaw = event.supplyPoint.distributorReeCode || cupsClean.substring(2, 6);
    const codDestino = codDestinoRaw?.match(/\d{4}/)?.[0];
    if (!codDestino) {
      throw new Error(`No se pudo determinar el Código REE de la distribuidora para el CUPS ${cupsClean}.`);
    }

    const codSolicitud = (event.codigoSolicitud || '').trim();
    if (!/^\d{12}$/.test(codSolicitud)) {
      throw new Error('El evento E2_14 no contiene un Código de Solicitud válido de 12 dígitos.');
    }

    const xml = buildE2_15Xml({
      codEmisora,
      codDestino,
      codSolicitud,
      cups: cupsClean,
      isAccept,
      motivosRechazo,
      comentariosRechazo,
    });

    const zip = new PizZip();
    const typeSufix = isAccept ? 'Aceptacion' : 'Rechazo';
    const xmlFilename = `${codSolicitud}_01_${cupsClean}_SP_E2_15_${typeSufix}.xml`;
    zip.file(xmlFilename, xml);
    const content = zip.generate({ type: 'base64' });

    if (registerInErp) {
      await ingestXmlStringInternal(xml, `${codSolicitud}_01_${cupsClean}_SP_E2_15.xml`).catch(err => {
        console.warn('No se pudo auto-registrar E2_15 en ERP:', err);
      });
    }

    await prisma.switchingEvent.update({
      where: { id: event.id },
      data: { isResolved: true },
    });

    return { success: true, fileData: content, filename: `E2_15_${codSolicitud}.zip` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateE2_01(
  cups: string,
  codigoRef: string,
  tipoReposicion: string,
  registerInErp: boolean = true
) {
  try {
    const { companyId, codEmisora } = await requireCompanyContext();

    const cupsClean = (cups || '').trim().toUpperCase();
    if (!/^ES\d{16}[A-Z0-9]{2,4}$/.test(cupsClean)) {
      throw new Error('El CUPS introducido no tiene un formato válido (20 o 22 caracteres comenzando por ES).');
    }

    const refClean = (codigoRef || '').trim();
    if (!/^\d{12}$/.test(refClean)) {
      throw new Error('El Código de Solicitud a reponer debe tener exactamente 12 dígitos numéricos.');
    }

    if (!['01', '02', '03'].includes(tipoReposicion)) {
      throw new Error('El Tipo de Reposición debe ser 01, 02 o 03 (Tabla 135 CNMC).');
    }

    const cups20 = cupsClean.substring(0, 20);
    const supplyPoint = await prisma.supplyPoint.findFirst({
      where: {
        cups: { startsWith: cups20 },
        client: { brand: { companyId } },
      },
      include: {
        client: true,
      },
    });

    if (!supplyPoint) {
      throw new Error('CUPS no encontrado en la base de datos para la comercializadora activa.');
    }

    const vat = (supplyPoint.client?.vatNumber || '').toUpperCase().trim();
    if (!vat) {
      throw new Error(
        'El titular asociado a este CUPS no tiene NIF/NIE/CIF registrado. Corrígelo en la ficha del cliente antes de generar E2_01.'
      );
    }

    const codDestinoRaw = supplyPoint.distributorReeCode || cupsClean.substring(2, 6);
    const codDestino = codDestinoRaw?.match(/\d{4}/)?.[0];
    if (!codDestino) {
      throw new Error(`No se pudo determinar el Código REE de la distribuidora para el CUPS ${cupsClean}.`);
    }

    const codSolicitud = buildE2SolicitudCode(codEmisora);
    const tipoIdentificador = detectTipoIdentificadorCnmc(vat);
    const cupsFinal = supplyPoint.cups.length === 20 ? `${supplyPoint.cups}0F` : supplyPoint.cups;

    const xml = buildE2_01Xml({
      codEmisora,
      codDestino,
      codSolicitud,
      cups: cupsFinal,
      tipoReposicion,
      codigoRef: refClean,
      tipoIdentificador,
      identificador: vat,
    });

    const filename = `${codSolicitud}_01_${cupsFinal}_SP_E2_01.xml`;
    if (registerInErp) {
      await ingestXmlStringInternal(xml, filename).catch(err => {
        console.warn('No se pudo auto-registrar E2_01 en ERP:', err);
      });
    }

    const zip = new PizZip();
    zip.file(filename, xml);
    const content = zip.generate({ type: 'base64' });

    return { success: true, fileData: content, filename: `E2_01_${codSolicitud}.zip` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
