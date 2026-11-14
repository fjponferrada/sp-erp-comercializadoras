'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';
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

function detectTipoIdentificadorCnmc(rawVat: string): 'NI' | 'NE' | 'PS' {
  const vat = rawVat.trim().toUpperCase();
  if (/^[XYZ]\d{7}[A-Z]$/.test(vat)) return 'NE';
  if (/^(\d{8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|[KLM]\d{7}[A-Z])$/.test(vat)) return 'NI';
  return 'PS';
}

async function requireCompanyContext() {
  const session = await auth();
  if (!session?.user?.id) {
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

function buildE2_15Xml(data: {
  codEmisora: string;
  codDestino: string;
  codSolicitud: string;
  cups: string;
  isAccept: boolean;
  motivosRechazo?: string[];
}): string {
  const { codEmisora, codDestino, codSolicitud, cups, isAccept, motivosRechazo } = data;
  const now = new Date();
  const fechaHoy = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const fechaHora = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, -1).split('.')[0];

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
    const validMotivos = (motivosRechazo || []).map(m => m.trim()).filter(Boolean);
    if (validMotivos.length === 0) {
      throw new Error('Debes indicar al menos un código de motivo de rechazo válido (Tabla 27 CNMC).');
    }
    const rechazosStr = validMotivos
      .map(
        (m, idx) => `
    <Rechazo>
      <Secuencial>${String(idx + 1).padStart(2, '0')}</Secuencial>
      <CodigoMotivo>${escapeXml(m)}</CodigoMotivo>
      <Comentarios>${escapeXml(`Rechazo por motivo ${m}`)}</Comentarios>
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
  const now = new Date();
  const fechaHora = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, -1).split('.')[0];

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
    const { companyId } = await requireCompanyContext();

    const events = await prisma.switchingEvent.findMany({
      where: {
        procesoBase: 'E2',
        paso: '14',
        isResolved: false,
        OR: [
          { contract: { brand: { companyId } } },
          { supplyPoint: { client: { brand: { companyId } } } },
          { AND: [{ contractId: null }, { supplyPointId: null }] },
        ],
      },
      include: {
        supplyPoint: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const r2Url = process.env.R2_PUBLIC_URL || '';
    const enrichedEvents = events.map(e => ({
      ...e,
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

export async function respondToE2_14(eventId: string, isAccept: boolean, motivosRechazo?: string[]) {
  try {
    const { companyId, codEmisora } = await requireCompanyContext();

    const event = await prisma.switchingEvent.findFirst({
      where: {
        id: eventId,
        OR: [
          { contract: { brand: { companyId } } },
          { supplyPoint: { client: { brand: { companyId } } } },
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

    const cupsClean = event.supplyPoint.cups.trim().toUpperCase();
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
    });

    const zip = new PizZip();
    const typeSufix = isAccept ? 'Aceptacion' : 'Rechazo';
    const filename = `${codSolicitud}_01_${cupsClean}_SP_E2_15_${typeSufix}.xml`;
    zip.file(filename, xml);
    const content = zip.generate({ type: 'base64' });

    await prisma.switchingEvent.update({
      where: { id: event.id },
      data: { isResolved: true },
    });

    return { success: true, fileData: content, filename: `E2_15_${codSolicitud}.zip` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateE2_01(cups: string, codigoRef: string, tipoReposicion: string) {
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
      throw new Error('El titular asociado a este CUPS no tiene NIF/NIE/CIF registrado. Corrígelo en la ficha del cliente antes de generar E2_01.');
    }

    const codDestinoRaw = supplyPoint.distributorReeCode || cupsClean.substring(2, 6);
    const codDestino = codDestinoRaw?.match(/\d{4}/)?.[0];
    if (!codDestino) {
      throw new Error(`No se pudo determinar el Código REE de la distribuidora para el CUPS ${cupsClean}.`);
    }

    const timePart = Date.now().toString().slice(-8);
    const codSolicitud = `${codEmisora}${timePart}`;
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

    const zip = new PizZip();
    const filename = `${codSolicitud}_01_${cupsFinal}_SP_E2_01.xml`;
    zip.file(filename, xml);
    const content = zip.generate({ type: 'base64' });

    return { success: true, fileData: content, filename: `E2_01_${codSolicitud}.zip` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
