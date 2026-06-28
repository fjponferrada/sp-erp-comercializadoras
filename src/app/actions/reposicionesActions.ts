'use server';

import { prisma } from '@/lib/prisma';
import PizZip from 'pizzip';

function buildE2_15Xml(data: any): string {
  const { codEmisora, codDestino, codSolicitud, cups, isAccept, motivosRechazo } = data;
  const now = new Date();
  const fechaHoy = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const fechaHora = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().slice(0, -1).split('.')[0];
  
  const ns = isAccept ? 'http://www.cnmc.es/2024/05/16/AceptacionReposicionReceptor' : 'http://www.cnmc.es/2024/05/16/RechazoReposicionReceptor';

  if (isAccept) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<AceptacionReposicionReceptor xmlns="${ns}">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${codEmisora}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${codDestino}</CodigoREEEmpresaDestino>
    <CodigoDeProceso>E2</CodigoDeProceso>
    <CodigoDePaso>15</CodigoDePaso>
    <CodigoDeSolicitud>${codSolicitud}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaHora}</FechaSolicitud>
    <CUPS>${cups}</CUPS>
  </Cabecera>
  <AceptacionReposicionReceptor>
    <FechaAceptacion>${fechaHoy}</FechaAceptacion>
  </AceptacionReposicionReceptor>
</AceptacionReposicionReceptor>`;
  } else {
    let motivosStr = '';
    if (motivosRechazo && motivosRechazo.length > 0) {
      motivosStr = `
    <MotivosRechazo>
${motivosRechazo.map((m: string) => `      <MotivoRechazo><CodigoMotivoRechazo>${m}</CodigoMotivoRechazo></MotivoRechazo>`).join('\n')}
    </MotivosRechazo>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<RechazoReposicionReceptor xmlns="${ns}">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${codEmisora}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${codDestino}</CodigoREEEmpresaDestino>
    <CodigoDeProceso>E2</CodigoDeProceso>
    <CodigoDePaso>15</CodigoDePaso>
    <CodigoDeSolicitud>${codSolicitud}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaHora}</FechaSolicitud>
    <CUPS>${cups}</CUPS>
  </Cabecera>
  <RechazoReposicionReceptor>
    <FechaRechazo>${fechaHoy}</FechaRechazo>${motivosStr}
  </RechazoReposicionReceptor>
</RechazoReposicionReceptor>`;
  }
}

function buildE2_01Xml(data: any): string {
  const { codEmisora, codDestino, codSolicitud, cups, tipoReposicion, codigoRef } = data;
  const now = new Date();
  const fechaHoy = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const fechaHora = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().slice(0, -1).split('.')[0];
  
  const ns = 'http://www.cnmc.es/2024/05/16/SolicitudReposicion';

  return `<?xml version="1.0" encoding="UTF-8"?>
<SolicitudReposicion xmlns="${ns}">
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
    <FechaPrevistaAccion>${fechaHoy}</FechaPrevistaAccion>
    <ActuacionCampo>N</ActuacionCampo>
  </SolicitudReposicion>
</SolicitudReposicion>`;
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
    return { success: true, data: events };
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
      where: { cups: cups }
    });

    if (!supplyPoint) {
      throw new Error("CUPS no encontrado en la base de datos.");
    }

    const codEmisora = '1713';
    const codDestinoRaw = supplyPoint.distributorReeCode || supplyPoint.distributor || cups.substring(2, 6) || '0021';
    const codDestino = codDestinoRaw.match(/\d{4}/)?.[0] || '0021';
    const codSolicitud = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');

    const xml = buildE2_01Xml({
      codEmisora,
      codDestino,
      codSolicitud,
      cups,
      tipoReposicion,
      codigoRef
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
