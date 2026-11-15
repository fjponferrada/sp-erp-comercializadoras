'use server';

import { revalidatePath } from 'next/cache';
import { toZonedTime } from 'date-fns-tz';
import { prisma } from '@/lib/prisma';
import { ingestXmlStringInternal } from './switchingIngest';
import {
  BajasTabMode,
  MADRID_TZ,
  getBajasSessionContext,
  issuePenaltyInvoicesForContracts,
  queryBajasDataset,
  requirePenaltyAdminAccess,
  resolveEffectivePenalty,
  round2,
} from '@/lib/bajasServer';

export async function getPaginatedBajasAction(
  page: number = 1,
  itemsPerPage: number = 100,
  search: string = '',
  motivoFilter: string = 'TODOS',
  canalFilter: string = 'TODOS',
  origenBajaFilter: string[] = [],
  dateFrom?: string | null,
  dateTo?: string | null,
  tarifaFilter: string[] = [],
  extraOptions?: {
    tab?: BajasTabMode;
    penaltyFilter?: string;
    winbackFilter?: string;
  }
) {
  try {
    const res = await queryBajasDataset({
      tab: extraOptions?.tab || 'CONFIRMADAS',
      page,
      itemsPerPage,
      search,
      motivoFilter,
      canalFilter,
      origenBajaFilter,
      dateFrom,
      dateTo,
      tarifaFilter,
      penaltyFilter: extraOptions?.penaltyFilter || 'TODOS',
      winbackFilter: extraOptions?.winbackFilter || 'TODOS',
    });

    return {
      success: true,
      isBackofficeOrAdmin: res.isBackofficeOrAdmin,
      tab: res.tab,
      bajas: res.bajas,
      totalCount: res.totalCount,
      confirmadasCount: res.confirmadasCount,
      preavisoCount: res.preavisoCount,
      totalPenaltySum: res.totalPenaltySum,
      stats: res.stats,
    };
  } catch (error: any) {
    console.error('Error in getPaginatedBajasAction:', error);
    return { success: false, error: error.message };
  }
}

export async function getBajasStatsAction(tab: BajasTabMode = 'CONFIRMADAS') {
  try {
    const res = await queryBajasDataset({
      tab,
      page: 1,
      itemsPerPage: 1,
    });

    return {
      success: true,
      stats: res.stats,
      confirmadasCount: res.confirmadasCount,
      preavisoCount: res.preavisoCount,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function savePenaltyAction(
  contractId: string,
  penalization: number,
  status: string,
  generatePdf: boolean = true
) {
  try {
    const { visibilityFilter } = await requirePenaltyAdminAccess();

    const cleanAmount = round2(Math.max(0, Number(penalization) || 0));
    const allowedStatuses = ['PENDIENTE', 'FACTURADA', 'DESCARTADA'];
    if (!allowedStatuses.includes(status)) {
      return { success: false, error: 'Estado de penalización no válido.' };
    }

    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        ...visibilityFilter,
      },
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        brand: {
          include: { company: true },
        },
        penaltyInvoices: {
          where: { invoiceType: 'PENALIZACION', paymentStatus: { not: 'ANULADA' } },
          take: 1,
        },
      },
    });

    if (!contract || !contract.brand || !contract.client || !contract.supplyPoint) {
      return { success: false, error: 'Contrato no encontrado o sin permisos de acceso.' };
    }

    if (status === 'FACTURADA' && cleanAmount > 0 && generatePdf) {
      if (contract.penaltyInvoices && contract.penaltyInvoices.length > 0) {
        return {
          success: false,
          error: `Este contrato ya dispone de una factura activa (${contract.penaltyInvoices[0].invoiceNumber}). Anúlala primero en Facturas de Penalizaciones si necesitas reemitirla.`,
        };
      }

      const issued = await issuePenaltyInvoicesForContracts([
        { contract, baseAmount: cleanAmount },
      ]);

      revalidatePath('/bajas');
      revalidatePath('/facturas-penalizaciones');
      return {
        success: true,
        invoiceNumber: issued.invoiceNumbers[0] || null,
      };
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        penalization: status === 'DESCARTADA' ? 0 : cleanAmount,
        penaltyStatus: status,
      },
    });

    revalidatePath('/bajas');
    return { success: true };
  } catch (error: any) {
    console.error('Error saving penalty:', error);
    return { success: false, error: error.message };
  }
}

export async function bulkDiscardPenaltiesAction(contractIds: string[]) {
  try {
    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      return { success: false, error: 'No se han seleccionado contratos.' };
    }

    const { visibilityFilter } = await requirePenaltyAdminAccess();

    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        ...visibilityFilter,
        OR: [{ penaltyStatus: null }, { penaltyStatus: { not: 'FACTURADA' } }],
      },
      select: { id: true },
    });

    if (contracts.length === 0) {
      return {
        success: false,
        error: 'Ninguno de los contratos seleccionados está pendiente de penalización.',
      };
    }

    const validIds = contracts.map((c) => c.id);
    const updated = await prisma.contract.updateMany({
      where: { id: { in: validIds } },
      data: {
        penalization: 0,
        penaltyStatus: 'DESCARTADA',
      },
    });

    revalidatePath('/bajas');
    return {
      success: true,
      count: updated.count,
      message: `Se han descartado ${updated.count} penalizaciones correctamente.`,
    };
  } catch (error: any) {
    console.error('Error in bulkDiscardPenaltiesAction:', error);
    return { success: false, error: error.message };
  }
}

export async function bulkIssuePenaltiesAction(
  contractIds: string[],
  groupMultipointSinglePdf: boolean = false
) {
  try {
    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      return { success: false, error: 'No se han seleccionado contratos.' };
    }

    const { visibilityFilter } = await requirePenaltyAdminAccess();

    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        ...visibilityFilter,
      },
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        brand: { include: { company: true } },
        penaltyInvoices: {
          where: { invoiceType: 'PENALIZACION', paymentStatus: { not: 'ANULADA' } },
          take: 1,
        },
      },
    });

    const billable: Array<{ contract: any; baseAmount: number }> = [];
    let skippedAlreadyInvoiced = 0;
    let skippedZero = 0;

    for (const c of contracts) {
      if (!c.brand || !c.client || !c.supplyPoint) continue;
      if (c.penaltyStatus === 'FACTURADA' || (c.penaltyInvoices && c.penaltyInvoices.length > 0)) {
        skippedAlreadyInvoiced++;
        continue;
      }
      if (c.penaltyStatus === 'DESCARTADA') {
        skippedZero++;
        continue;
      }
      const effAmount = resolveEffectivePenalty(c, 'CONFIRMADAS');
      if (effAmount <= 0) {
        skippedZero++;
        continue;
      }
      billable.push({ contract: c, baseAmount: effAmount });
    }

    if (billable.length === 0) {
      return {
        success: false,
        error: `No hay penalizaciones facturables > 0 € entre la selección (${skippedAlreadyInvoiced} ya facturadas, ${skippedZero} con importe 0 € o descartadas).`,
      };
    }

    const res = await issuePenaltyInvoicesForContracts(billable, {
      groupMultipointSinglePdf,
    });

    revalidatePath('/bajas');
    revalidatePath('/facturas-penalizaciones');

    return {
      success: true,
      createdCount: res.createdCount,
      invoiceNumbers: res.invoiceNumbers,
      skippedAlreadyInvoiced,
      skippedZero,
      message: `Emitidas ${res.createdCount} facturas de penalización (${res.invoiceNumbers.slice(0, 4).join(', ')}${res.invoiceNumbers.length > 4 ? '...' : ''}).`,
    };
  } catch (error: any) {
    console.error('Error in bulkIssuePenaltiesAction:', error);
    return { success: false, error: error.message };
  }
}

const VALID_WINBACK_STATUSES = new Set([
  '',
  'SIN_GESTION',
  'CONTACTADO',
  'OFERTA_ENVIADA',
  'EN_NEGOCIACION',
  'RECUPERADO',
  'DESCARTADO',
]);

export async function saveWinbackTrackingAction(
  contractId: string,
  payload: {
    winbackStatus?: string | null;
    winbackNotes?: string | null;
    winbackProductOffered?: string | null;
    touchContactDate?: boolean;
  }
) {
  try {
    const { visibilityFilter } = await getBajasSessionContext();

    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        ...visibilityFilter,
      },
      select: { id: true, winbackStatus: true, winbackNotes: true, winbackProductOffered: true },
    });

    if (!contract) {
      return { success: false, error: 'Contrato no encontrado o sin permisos.' };
    }

    const rawStatus = (payload.winbackStatus ?? '').trim();
    if (!VALID_WINBACK_STATUSES.has(rawStatus)) {
      return { success: false, error: 'Estado de recuperación no válido.' };
    }

    const normalizedStatus = !rawStatus || rawStatus === 'SIN_GESTION' ? null : rawStatus;
    const normalizedNotes =
      payload.winbackNotes !== undefined
        ? payload.winbackNotes?.trim() || null
        : contract.winbackNotes;
    const normalizedProduct =
      payload.winbackProductOffered !== undefined
        ? payload.winbackProductOffered?.trim() || null
        : contract.winbackProductOffered;

    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        winbackStatus: normalizedStatus,
        winbackNotes: normalizedNotes,
        winbackProductOffered: normalizedProduct,
        ...(payload.touchContactDate !== false ? { winbackLastContactAt: new Date() } : {}),
      },
      select: {
        id: true,
        winbackStatus: true,
        winbackNotes: true,
        winbackLastContactAt: true,
        winbackProductOffered: true,
      },
    });

    revalidatePath('/bajas');
    return {
      success: true,
      tracking: {
        winbackStatus: updated.winbackStatus,
        winbackNotes: updated.winbackNotes,
        winbackLastContactAt: updated.winbackLastContactAt
          ? updated.winbackLastContactAt.toISOString()
          : null,
        winbackProductOffered: updated.winbackProductOffered,
      },
    };
  } catch (error: any) {
    console.error('Error saving winback tracking:', error);
    return { success: false, error: error.message };
  }
}

function escapeXmlBaja(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

let bajaSeqCounter = 0;
function buildB1SolicitudCode(emisora: string): string {
  bajaSeqCounter = (bajaSeqCounter + 1) % 1000;
  const prefix = emisora.slice(0, 4).padStart(4, '0');
  const ts = String(Date.now()).slice(-5);
  const seq = String(bajaSeqCounter).padStart(3, '0');
  return `${prefix}${ts}${seq}`;
}

export interface BajaContractPreview {
  cupsFull: string;
  titular: string;
  nif: string;
  contractId: string | null;
  contractCode: string | null;
  status: string | null;
  tariff: string | null;
}

export async function fetchBajaContext(cups: string) {
  try {
    const { userId, activeCompanyId } = await requirePenaltyAdminAccess();

    let emisora = '';
    if (activeCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: activeCompanyId },
        select: { codigoRee: true },
      });
      emisora = company?.codigoRee || '';
    }
    if (!emisora && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { brand: { include: { company: true } } },
      });
      emisora = user?.brand?.company?.codigoRee || '';
    }

    let destino = '';
    let preview: BajaContractPreview | null = null;
    let notFound = false;

    if (cups && cups.length >= 6 && cups.toUpperCase().startsWith('ES')) {
      const cupsUpper = cups.trim().toUpperCase();
      const sp = await prisma.supplyPoint.findFirst({
        where: {
          cups: { startsWith: cupsUpper.substring(0, 20) },
          ...(activeCompanyId ? { client: { brand: { companyId: activeCompanyId } } } : {}),
        },
        include: {
          client: true,
          contracts: {
            where: { status: { in: ['ACTIVO', 'Activo', 'TRAMITANDO', 'Tramitando'] } },
            orderBy: [{ version: 'desc' }, { activationDate: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            include: { client: true, product: { select: { tariff: true } } },
          },
        },
      });

      if (sp?.distributorReeCode) {
        destino = sp.distributorReeCode;
      } else {
        destino = cupsUpper.substring(2, 6);
      }

      if (cupsUpper.length >= 16) {
        const activeContract = sp?.contracts?.[0] || null;
        const holder = activeContract?.client || sp?.client || null;
        if (sp && activeContract && holder) {
          const titular =
            holder.businessName ||
            `${holder.firstName || ''} ${holder.lastName || ''} ${(holder as any).lastName2 || ''}`.replace(/\s+/g, ' ').trim();
          preview = {
            cupsFull: sp.cups,
            titular: titular || 'Sin nombre',
            nif: holder.vatNumber || '',
            contractId: activeContract.id,
            contractCode: activeContract.contractCode,
            status: activeContract.status,
            tariff: sp.tariff || activeContract.product?.tariff || null,
          };
        } else {
          notFound = true;
        }
      }
    }

    return { success: true, emisora, destino, preview, notFound };
  } catch (error: any) {
    console.error('Error fetching context:', error);
    return { success: false, error: error.message };
  }
}

export async function generateBajaXml(data: {
  emisora: string;
  destino: string;
  codigoSolicitud?: string;
  cups: string;
  motivo: string;
  fechaPrevista: string;
  registerInErp?: boolean;
}) {
  try {
    const { activeCompanyId } = await requirePenaltyAdminAccess();

    const emisora = (data.emisora || '').trim();
    const destino = (data.destino || '').trim();
    const cupsRaw = (data.cups || '').trim().toUpperCase();
    const motivo = (data.motivo || '').trim();
    const fechaPrevista = (data.fechaPrevista || '').trim();
    const registerInErp = data.registerInErp !== false;

    if (!/^\d{4}$/.test(emisora)) {
      throw new Error('El Código REE de la emisora debe tener 4 dígitos.');
    }
    if (!/^\d{4}$/.test(destino)) {
      throw new Error('El Código REE de la distribuidora destino debe tener 4 dígitos.');
    }

    const codigoSolicitud = (data.codigoSolicitud || '').trim() || buildB1SolicitudCode(emisora);
    if (!/^\d{12}$/.test(codigoSolicitud)) {
      throw new Error('El Código de Solicitud debe tener exactamente 12 dígitos numéricos.');
    }
    if (!/^ES\d{16}[A-Z0-9]{2,4}$/.test(cupsRaw)) {
      throw new Error(
        'El CUPS introducido no tiene un formato válido (20 o 22 caracteres comenzando por ES).'
      );
    }
    if (!['01', '02', '03', '04'].includes(motivo)) {
      throw new Error('El motivo de baja debe ser 01, 02, 03 o 04 (Tabla 10 CNMC).');
    }
    if (fechaPrevista && !/^\d{4}-\d{2}-\d{2}$/.test(fechaPrevista)) {
      throw new Error('La fecha prevista debe tener formato YYYY-MM-DD.');
    }

    const rootNode = 'MensajeBajaSuspension';
    const zonedNow = toZonedTime(new Date(), MADRID_TZ);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const formattedDate = `${zonedNow.getFullYear()}-${pad2(zonedNow.getMonth() + 1)}-${pad2(zonedNow.getDate())}T${pad2(zonedNow.getHours())}:${pad2(zonedNow.getMinutes())}:${pad2(zonedNow.getSeconds())}`;

    const sp = await prisma.supplyPoint.findFirst({
      where: {
        cups: { startsWith: cupsRaw.substring(0, 20) },
        ...(activeCompanyId ? { client: { brand: { companyId: activeCompanyId } } } : {}),
      },
      include: {
        client: true,
        contracts: {
          where: { status: { in: ['ACTIVO', 'TRAMITANDO'] } },
          orderBy: [{ version: 'desc' }, { activationDate: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          include: { client: true },
        },
      },
    });

    const client = sp?.contracts?.[0]?.client || sp?.client;
    if (!client) {
      throw new Error(
        'No se ha encontrado un cliente activo para este CUPS en la comercializadora activa.'
      );
    }

    const vat = (client.vatNumber || '').trim().toUpperCase();
    if (!vat) {
      throw new Error('El titular del suministro no tiene NIF/NIE/CIF registrado.');
    }

    // Tabla 6 CNMC: NI, NE, PS, NV, OT (jamás PA)
    let tipoIdentificador: 'NI' | 'NE' | 'PS' = 'NI';
    if (/^[XYZ]\d{7}[A-Z]$/.test(vat)) {
      tipoIdentificador = 'NE';
    } else if (!/^(\d{8}[A-Z]|[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]|[KLM]\d{7}[A-Z])$/.test(vat)) {
      tipoIdentificador = 'PS';
    }

    const isJuridica = /^[ABCDEFGHJNPQRSUVW]/.test(vat);
    let xmlNombre = '';
    if (!isJuridica) {
      const firstName = (client.firstName || '').trim().slice(0, 80);
      const rawLastName = (client.lastName || '').trim();
      const rawLastName2 = ((client as any).lastName2 || '').trim();
      let primerApellido = rawLastName;
      let segundoApellido = rawLastName2;
      if (!segundoApellido && rawLastName.includes(' ')) {
        const parts = rawLastName.split(/\s+/);
        primerApellido = parts[0];
        segundoApellido = parts.slice(1).join(' ');
      }
      primerApellido = primerApellido.slice(0, 80);
      segundoApellido = segundoApellido.slice(0, 80);

      if (!firstName || !primerApellido) {
        throw new Error(
          'El cliente persona física debe tener Nombre y Primer Apellido informados en su ficha antes de generar B1_01.'
        );
      }

      xmlNombre = `<NombreDePila>${escapeXmlBaja(firstName)}</NombreDePila>
      <PrimerApellido>${escapeXmlBaja(primerApellido)}</PrimerApellido>`;
      if (segundoApellido) {
        xmlNombre += `\n      <SegundoApellido>${escapeXmlBaja(segundoApellido)}</SegundoApellido>`;
      }
    } else {
      const razonSocial = (client.businessName || '').trim().slice(0, 80);
      if (!razonSocial) {
        throw new Error(
          'El cliente persona jurídica debe tener Razón Social informada en su ficha antes de generar B1_01.'
        );
      }
      xmlNombre = `<RazonSocial>${escapeXmlBaja(razonSocial)}</RazonSocial>`;
    }

    let telefonoXml = '';
    if (client.contactPhone) {
      const phone = client.contactPhone.replace(/\D/g, '').slice(-9);
      if (phone.length === 9) {
        telefonoXml = `
    <Telefono>
      <PrefijoPais>0034</PrefijoPais>
      <Numero>${phone}</Numero>
    </Telefono>`;
      }
    }

    const cupsFinal = cupsRaw.length === 20 ? `${cupsRaw}0F` : cupsRaw;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootNode} xmlns="http://localhost/elegibilidad">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${escapeXmlBaja(emisora)}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${escapeXmlBaja(destino)}</CodigoREEEmpresaDestino>
    <CodigoDelProceso>B1</CodigoDelProceso>
    <CodigoDePaso>01</CodigoDePaso>
    <CodigoDeSolicitud>${escapeXmlBaja(codigoSolicitud)}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${formattedDate}</FechaSolicitud>
    <CUPS>${escapeXmlBaja(cupsFinal)}</CUPS>
  </Cabecera>
  <BajaSuspension>
    <DatosSolicitud>
      <IndActivacion>${fechaPrevista ? 'F' : 'A'}</IndActivacion>${fechaPrevista ? `
      <FechaPrevistaAccion>${escapeXmlBaja(fechaPrevista)}</FechaPrevistaAccion>` : ''}
      <Motivo>${escapeXmlBaja(motivo)}</Motivo>
    </DatosSolicitud>
    <Cliente>
      <IdCliente>
        <TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
        <Identificador>${escapeXmlBaja(vat)}</Identificador>
      </IdCliente>
      <Nombre>
        ${xmlNombre}
      </Nombre>${telefonoXml}
    </Cliente>
  </BajaSuspension>
</${rootNode}>`;

    const filename = `${codigoSolicitud}_01_${cupsFinal}_SP_B1_01.xml`;

    if (registerInErp) {
      await ingestXmlStringInternal(xml, filename).catch(err => {
        console.warn('No se pudo auto-registrar B1_01 en ERP:', err);
      });
    }

    return { success: true, xml, filename, codigoSolicitud };
  } catch (error: any) {
    console.error('Error generando XML de baja:', error);
    return { success: false, error: error.message };
  }
}
