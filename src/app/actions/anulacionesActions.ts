'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { resolveActiveCompanyId, hasAdminOrBackofficeRole } from '@/lib/companyContext';
import { ingestXmlStringInternal } from './switchingIngest';
import { getTramitationCodes } from '@/lib/tramitationMapper';

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

export interface OpenAnulableProcess {
  codigoSolicitud: string;
  proceso: string;
  cups: string;
  destino: string;
  contractCode?: string | null;
  fechaSolicitud?: string | null;
  sourceLabel: string;
}

export async function fetchAnulacionContext(cups: string) {
  try {
    const session = await auth();
    if (!session?.user?.id || !hasAdminOrBackofficeRole((session.user as any).role)) {
      throw new Error('No estás autorizado.');
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
    const openProcesses: OpenAnulableProcess[] = [];

    if (cups && cups.length >= 6 && cups.toUpperCase().startsWith('ES')) {
      const cupsUpper = cups.trim().toUpperCase();
      const cups20 = cupsUpper.substring(0, 20);

      const sps = await prisma.supplyPoint.findMany({
        where: {
          cups: { startsWith: cups20 },
          ...(activeCompanyId ? { client: { brand: { companyId: activeCompanyId } } } : {}),
        },
        include: {
          contracts: {
            where: { status: { in: ['TRAMITANDO', 'Tramitando'] } },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
          },
        },
      });

      const primarySp = sps[0];
      if (primarySp?.distributorReeCode) {
        destino = primarySp.distributorReeCode;
      } else {
        destino = cupsUpper.substring(2, 6);
      }

      const seenSolicitudes = new Set<string>();
      const spIds = sps.map(s => s.id);

      // 1. Contratos en TRAMITANDO con nSolicitud de 12 dígitos
      for (const sp of sps) {
        const spDest = sp.distributorReeCode || sp.cups.substring(2, 6);
        for (const c of sp.contracts) {
          const nSol = (c.nSolicitud || '').trim();
          if (/^\d{12}$/.test(nSol)) {
            const proc = (c.tipo || getTramitationCodes(c.tramitationType).tipo || 'C1').toUpperCase();
            if (['C1', 'C2', 'A3', 'M1', 'B1', 'E1', 'E2'].includes(proc)) {
              const key = `${proc}_${nSol}`;
              if (!seenSolicitudes.has(key)) {
                seenSolicitudes.add(key);
                openProcesses.push({
                  codigoSolicitud: nSol,
                  proceso: proc,
                  cups: sp.cups,
                  destino: spDest,
                  contractCode: c.contractCode,
                  fechaSolicitud: c.createdAt ? c.createdAt.toISOString().split('T')[0] : null,
                  sourceLabel: `Contrato TRAMITANDO (${c.contractCode || 'S/N'})`,
                });
              }
            }
          }
        }
      }

      // 2. Eventos Switching Paso 01 abiertos (sin cierre Paso 05 ni rechazo Paso 04 ni anulados)
      if (spIds.length > 0 && cupsUpper.length >= 16) {
        const events = await prisma.switchingEvent.findMany({
          where: {
            supplyPointId: { in: spIds },
            procesoBase: { in: ['C1', 'C2', 'A3', 'M1', 'B1', 'E1', 'E2', 'R1'] },
            isAnnulled: false,
            codigoSolicitud: { not: null },
          },
          include: {
            supplyPoint: { select: { cups: true, distributorReeCode: true } },
            contract: { select: { contractCode: true } },
          },
          orderBy: { fechaSolicitud: 'desc' },
          take: 60,
        });

        const closedSet = new Set<string>();
        for (const ev of events) {
          if (!ev.codigoSolicitud) continue;
          const k = `${ev.procesoBase}_${ev.codigoSolicitud}`;
          if (
            ev.paso === '05' ||
            (ev.paso === '04' && ev.procesoBase !== 'R1') ||
            (ev.paso === '02' && ev.estadoAR === 'RECHAZADO') ||
            ev.isAnnulled
          ) {
            closedSet.add(k);
          }
        }

        for (const ev of events) {
          if (ev.paso !== '01' || !ev.codigoSolicitud || !/^\d{12}$/.test(ev.codigoSolicitud.trim())) continue;
          const sol = ev.codigoSolicitud.trim();
          const key = `${ev.procesoBase}_${sol}`;
          if (closedSet.has(key) || seenSolicitudes.has(key)) continue;
          seenSolicitudes.add(key);
          const evCups = ev.supplyPoint?.cups || cupsUpper;
          const evDest = ev.supplyPoint?.distributorReeCode || evCups.substring(2, 6);
          openProcesses.push({
            codigoSolicitud: sol,
            proceso: ev.procesoBase,
            cups: evCups,
            destino: evDest,
            contractCode: ev.contract?.contractCode || null,
            fechaSolicitud: ev.fechaSolicitud ? ev.fechaSolicitud.toISOString().split('T')[0] : null,
            sourceLabel:
              ev.procesoBase === 'R1'
                ? `Reclamación R1 abierta (${ev.tipoReclamacion || ''}/${ev.subtipoReclamacion || ''})`
                : `Solicitud ${ev.procesoBase}_01 en curso`,
          });
        }
      }
    }

    return { success: true, emisora, destino, openProcesses };
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
  registerInErp?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || !hasAdminOrBackofficeRole((session.user as any).role)) {
      throw new Error('No estás autorizado.');
    }

    const emisora = (data.emisora || '').trim();
    const destino = (data.destino || '').trim();
    const proceso = (data.proceso || '').trim().toUpperCase();
    const codigoSolicitud = (data.codigoSolicitud || '').trim();
    const cupsRaw = (data.cups || '').trim().toUpperCase();
    const registerInErp = data.registerInErp !== false;

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
    const formattedDate = formatMadridDateTime(new Date());

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

    const filename = `${codigoSolicitud}_01_${cupsFinal}_SP_${proceso}_${paso}.xml`;

    if (registerInErp) {
      await ingestXmlStringInternal(xml, filename).catch(err => {
        console.warn('No se pudo auto-registrar la anulación en ERP:', err);
      });
    }

    return { success: true, xml, paso, filename };
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
  registerInErp?: boolean;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id || !hasAdminOrBackofficeRole((session.user as any).role)) {
      throw new Error('No estás autorizado.');
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
    const registerInErp = data.registerInErp !== false;

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
    const fechaSolicitud = formatMadridDateTime(new Date());
    const fechaRechazo = fechaSolicitud.slice(0, 10);

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

    const filename = `${codigoSolicitud}_01_${cupsFinal}_SP_D1_02.xml`;

    if (registerInErp) {
      await ingestXmlStringInternal(xml, filename).catch(err => {
        console.warn('No se pudo auto-registrar D1_02 en ERP:', err);
      });
    }

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
      filename,
    };
  } catch (error: any) {
    console.error('Error generando XML D1_02:', error);
    return { success: false, error: error.message };
  }
}
