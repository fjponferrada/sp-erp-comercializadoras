'use server';

import { prisma } from '@/lib/prisma';
import PizZip from 'pizzip';

function buildE2_15Xml(data: any): string {
  const { codEmisora, codDestino, codSolicitud, cups, isAccept, motivosRechazo } = data;
  const now = new Date();
  const fechaHoy = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const fechaHora = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().slice(0, -1).split('.')[0];
  
  const rootElement = isAccept ? 'MensajeAceptacionReposicionReceptor' : 'MensajeRechazoReposicionReceptor';

  let body = `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} xmlns="http://localhost/elegibilidad">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${codEmisora}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${codDestino}</CodigoREEEmpresaDestino>
    <CodigoDeProceso>E2</CodigoDeProceso>
    <CodigoDePaso>15</CodigoDePaso>
    <CodigoDeSolicitud>${codSolicitud}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaHora}</FechaSolicitud>
    <CUPS>${cups}</CUPS>
  </Cabecera>`;

  if (!isAccept) {
    let rechazosStr = '';
    if (motivosRechazo && motivosRechazo.length > 0) {
      rechazosStr = motivosRechazo.map((m: string, idx: number) => `
    <Rechazo>
      <Secuencial>${String(idx + 1).padStart(2, '0')}</Secuencial>
      <CodigoMotivo>${m}</CodigoMotivo>
      <Comentarios>Rechazo por motivo ${m}</Comentarios>
    </Rechazo>`).join('');
    } else {
      rechazosStr = `
    <Rechazo>
      <Secuencial>01</Secuencial>
      <CodigoMotivo>99</CodigoMotivo>
      <Comentarios>Rechazado</Comentarios>
    </Rechazo>`;
    }

    body += `
  <Rechazos>
    <FechaRechazo>${fechaHoy}</FechaRechazo>${rechazosStr}
  </Rechazos>`;
  }

  body += `\n</${rootElement}>`;

  return body;
}

function buildE2_01Xml(data: any): string {
  const { codEmisora, codDestino, codSolicitud, cups, tipoReposicion, codigoRef, tipoIdentificador, identificador } = data;
  const now = new Date();
  const fechaHora = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().slice(0, -1).split('.')[0];
  
  const ns = 'http://www.cnmc.es/2024/05/16/SolicitudReposicion';

  return `<?xml version="1.0" encoding="UTF-8"?>
<MensajeSolicitudReposicion xmlns="${ns}">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${codEmisora}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${codDestino}</CodigoREEEmpresaDestino>
    <CodigoDeProceso>E2</CodigoDeProceso>
    <CodigoDePaso>01</CodigoDePaso>
    <CodigoDeSolicitud>${codSolicitud}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaHora}</FechaSolicitud>
    <CUPS>${cups}</CUPS>
  </Cabecera>
  <SolicitudReposicion>
    <CodigoDeSolicitudRef>${codigoRef}</CodigoDeSolicitudRef>
    <TipoDeReposicion>${tipoReposicion}</TipoDeReposicion>
    <IdCliente>
      <TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
      <Identificador>${identificador}</Identificador>
    </IdCliente>
  </SolicitudReposicion>
</MensajeSolicitudReposicion>`;
}

export async function getPendingE2_14() {
  try {
    const events = await prisma.switchingEvent.findMany({
      where: {
        procesoBase: 'E2',
        paso: '14',
        isResolved: false
      },
      include: {
        supplyPoint: true
      },
      orderBy: { createdAt: 'desc' }
    });
    const r2Url = process.env.R2_PUBLIC_URL || '';
    const enrichedEvents = events.map(e => ({
      ...e,
      fullXmlUrl: e.xmlUrl 
        ? e.xmlUrl.startsWith('http') ? e.xmlUrl : `${r2Url}/${e.xmlUrl}` 
        : null
    }));

    return { success: true, data: enrichedEvents };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function respondToE2_14(eventId: string, isAccept: boolean, motivosRechazo?: string[]) {
  try {
    const event = await prisma.switchingEvent.findUnique({
      where: { id: eventId },
      include: {
        supplyPoint: true
      }
    });

    if (!event || !event.supplyPoint) {
      throw new Error("Evento o punto de suministro no encontrado.");
    }

    const codEmisora = '1713';
    const codDestinoRaw = event.supplyPoint.distributorReeCode || event.supplyPoint.distributor || event.supplyPoint.cups?.substring(2, 6) || '0021';
    const codDestino = codDestinoRaw.match(/\d{4}/)?.[0] || '0021';
    
    let codSolicitud = event.codigoSolicitud || Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');

    const xml = buildE2_15Xml({
      codEmisora,
      codDestino,
      codSolicitud,
      cups: event.supplyPoint.cups,
      isAccept,
      motivosRechazo
    });

    const zip = new PizZip();
    const typeSufix = isAccept ? 'Aceptacion' : 'Rechazo';
    const filename = `${codSolicitud}_01_${event.supplyPoint.cups}_SP_E2_15_${typeSufix}.xml`;
    zip.file(filename, xml);
    const content = zip.generate({ type: 'base64' });

    await prisma.switchingEvent.update({
      where: { id: event.id },
      data: { isResolved: true }
    });

    return { success: true, fileData: content, filename: `E2_15_${codSolicitud}.zip` };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function generateE2_01(cups: string, codigoRef: string, tipoReposicion: string) {
  try {
    const supplyPoint = await prisma.supplyPoint.findFirst({
      where: { cups: cups },
      include: {
        client: true
      }
    });

    if (!supplyPoint) {
      throw new Error("CUPS no encontrado en la base de datos.");
    }

    const codEmisora = '1713';
    const codDestinoRaw = supplyPoint.distributorReeCode || supplyPoint.distributor || cups.substring(2, 6) || '0021';
    const codDestino = codDestinoRaw.match(/\d{4}/)?.[0] || '0021';
    const codSolicitud = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');

    // Identificar Tipo
    let tipoIdentificador = 'NIF';
    const vat = supplyPoint.client?.vatNumber?.toUpperCase().trim() || '00000000T';
    if (/^[XYZ]/.test(vat)) tipoIdentificador = 'NIE';
    else if (/^[A-W]/.test(vat)) tipoIdentificador = 'CIF';

    const xml = buildE2_01Xml({
      codEmisora,
      codDestino,
      codSolicitud,
      cups,
      tipoReposicion,
      codigoRef,
      tipoIdentificador,
      identificador: vat
    });

    const zip = new PizZip();
    const filename = `${codSolicitud}_01_${cups}_SP_E2_01.xml`;
    zip.file(filename, xml);
    const content = zip.generate({ type: 'base64' });

    return { success: true, fileData: content, filename: `E2_01_${codSolicitud}.zip` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
