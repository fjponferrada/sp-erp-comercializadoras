'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId } from '@/lib/companyContext';

function escapeXml(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function fetchAnulacionContext(cups: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('No estás autenticado.');
    }

    const activeCompanyId = await resolveActiveCompanyId(session);
    let emisora = '';
    if (activeCompanyId) {
      const company = await prisma.company.findUnique({ where: { id: activeCompanyId }, select: { codigoRee: true } });
      emisora = company?.codigoRee || '';
    }
    if (!emisora) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { brand: { include: { company: true } } },
      });
      emisora = user?.brand?.company?.codigoRee || '';
    }

    let destino = '';
    if (cups && cups.length >= 6 && cups.toUpperCase().startsWith('ES')) {
      const cupsUpper = cups.trim().toUpperCase();
      const sp = await prisma.supplyPoint.findFirst({
        where: {
          cups: { startsWith: cupsUpper.substring(0, 20) },
          ...(activeCompanyId ? { client: { brand: { companyId: activeCompanyId } } } : {}),
        },
      });

      if (sp?.distributorReeCode) {
        destino = sp.distributorReeCode;
      } else {
        destino = cupsUpper.substring(2, 6);
      }
    }

    return { success: true, emisora, destino };
  } catch (error: any) {
    console.error('Error fetching context:', error);
    return { success: false, error: error.message };
  }
}

export async function generateAnulacionXml(data: {
  emisora: string;
  destino: string;
  proceso: string;
  codigoSolicitud: string;
  cups: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('No estás autenticado.');
    }

    const emisora = (data.emisora || '').trim();
    const destino = (data.destino || '').trim();
    const proceso = (data.proceso || '').trim().toUpperCase();
    const codigoSolicitud = (data.codigoSolicitud || '').trim();
    const cupsRaw = (data.cups || '').trim().toUpperCase();

    if (!/^\d{4}$/.test(emisora)) {
      throw new Error('El Código REE de la emisora debe tener 4 dígitos.');
    }
    if (!/^\d{4}$/.test(destino)) {
      throw new Error('El Código REE de la distribuidora destino debe tener 4 dígitos.');
    }
    if (!/^\d{12}$/.test(codigoSolicitud)) {
      throw new Error('El Código de Solicitud debe tener exactamente 12 dígitos numéricos.');
    }
    if (!/^ES\d{16}[A-Z0-9]{2,4}$/.test(cupsRaw)) {
      throw new Error('El CUPS debe tener un formato válido (20 o 22 caracteres comenzando por ES).');
    }

    const PASO_BY_PROCESO: Record<string, string> = {
      C1: '08',
      C2: '08',
      E2: '08',
      R1: '08',
      A3: '06',
      M1: '06',
      B1: '03',
      E1: '03',
    };
    const paso = PASO_BY_PROCESO[proceso];
    if (!paso) {
      throw new Error(`Proceso ${proceso} no soportado para generación de anulación.`);
    }

    const cupsFinal = cupsRaw.length === 20 ? `${cupsRaw}0F` : cupsRaw;
    const now = new Date();
    const formattedDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);

    const isReclamacion = proceso === 'R1';
    const rootNode = isReclamacion ? 'MensajeAnulacionSolicitudReclamacion' : 'MensajeAnulacionSolicitud';
    const headerNode = isReclamacion ? 'CabeceraReclamacion' : 'Cabecera';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootNode} xmlns="http://localhost/elegibilidad">
  <${headerNode}>
    <CodigoREEEmpresaEmisora>${escapeXml(emisora)}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${escapeXml(destino)}</CodigoREEEmpresaDestino>
    <CodigoDelProceso>${escapeXml(proceso)}</CodigoDelProceso>
    <CodigoDePaso>${paso}</CodigoDePaso>
    <CodigoDeSolicitud>${escapeXml(codigoSolicitud)}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${formattedDate}</FechaSolicitud>
    <CUPS>${escapeXml(cupsFinal)}</CUPS>
  </${headerNode}>
</${rootNode}>`;

    return { success: true, xml, paso };
  } catch (error: any) {
    console.error('Error generando XML de anulación:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Genera el mensaje CNMC D1_02 (`MensajeRechazoD1`) para rechazar una notificación D1_01 recibida de distribuidora.
 * Según `RechazoD1.xsd` (Tabla 27), los motivos válidos son E1, F1 o I1.
 */
export async function generateRechazoD1Xml(data: {
  eventId?: string;
  emisora?: string;
  destino?: string;
  codigoSolicitud: string;
  cups: string;
  codigoMotivo: 'E1' | 'F1' | 'I1' | string;
  comentarios: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('No estás autenticado.');
    }
    const activeCompanyId = await resolveActiveCompanyId(session);

    let emisora = (data.emisora || '').trim();
    if (!emisora) {
      const company = activeCompanyId
        ? await prisma.company.findUnique({ where: { id: activeCompanyId }, select: { codigoRee: true } })
        : await prisma.company.findFirst({ select: { codigoRee: true } });
      emisora = (company?.codigoRee || '').trim();
    }

    const cupsRaw = (data.cups || '').trim().toUpperCase();
    let destino = (data.destino || '').trim();
    if (!destino && cupsRaw.length >= 6) {
      destino = cupsRaw.substring(2, 6);
    }

    const codigoSolicitud = (data.codigoSolicitud || '').trim();
    const codigoMotivo = (data.codigoMotivo || '').trim().toUpperCase();
    const comentarios = (data.comentarios || '').trim().slice(0, 4000);

    if (!/^\d{4}$/.test(emisora)) {
      throw new Error('El Código REE de la emisora debe tener 4 dígitos.');
    }
    if (!/^\d{4}$/.test(destino)) {
      throw new Error('El Código REE de la distribuidora destino debe tener 4 dígitos.');
    }
    if (!/^\d{12}$/.test(codigoSolicitud)) {
      throw new Error('El Código de Solicitud D1 debe tener exactamente 12 dígitos numéricos.');
    }
    if (!/^ES\d{16}[A-Z0-9]{2,4}$/.test(cupsRaw)) {
      throw new Error('El CUPS debe tener un formato válido (20 o 22 caracteres comenzando por ES).');
    }
    if (!['E1', 'F1', 'I1'].includes(codigoMotivo)) {
      throw new Error('El motivo de rechazo para D1_02 debe ser E1, F1 o I1 según RechazoD1.xsd (Tabla 27 CNMC).');
    }
    if (!comentarios) {
      throw new Error('El campo Comentarios es obligatorio en el rechazo D1_02.');
    }

    const cupsFinal = cupsRaw.length === 20 ? `${cupsRaw}0F` : cupsRaw;
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
    const fechaSolicitud = localIso.slice(0, 19);
    const fechaRechazo = localIso.slice(0, 10);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MensajeRechazoD1 xmlns="http://localhost/elegibilidad">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${escapeXml(emisora)}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${escapeXml(destino)}</CodigoREEEmpresaDestino>
    <CodigoDelProceso>D1</CodigoDelProceso>
    <CodigoDePaso>02</CodigoDePaso>
    <CodigoDeSolicitud>${escapeXml(codigoSolicitud)}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaSolicitud}</FechaSolicitud>
    <CUPS>${escapeXml(cupsFinal)}</CUPS>
  </Cabecera>
  <Rechazos>
    <FechaRechazo>${fechaRechazo}</FechaRechazo>
    <Rechazo>
      <Secuencial>01</Secuencial>
      <CodigoMotivo>${escapeXml(codigoMotivo)}</CodigoMotivo>
      <Comentarios>${escapeXml(comentarios)}</Comentarios>
    </Rechazo>
  </Rechazos>
</MensajeRechazoD1>`;

    if (data.eventId) {
      await prisma.switchingEvent.updateMany({
        where: {
          id: data.eventId,
          ...(activeCompanyId
            ? {
                OR: [
                  { contract: { brand: { companyId: activeCompanyId } } },
                  { supplyPoint: { client: { brand: { companyId: activeCompanyId } } } },
                  { AND: [{ contractId: null }, { supplyPointId: null }] },
                ],
              }
            : {}),
        },
        data: { isResolved: true },
      });
    }

    return {
      success: true,
      xml,
      filename: `${codigoSolicitud}_01_${cupsFinal}_SP_D1_02.xml`,
    };
  } catch (error: any) {
    console.error('Error generando XML D1_02:', error);
    return { success: false, error: error.message };
  }
}
