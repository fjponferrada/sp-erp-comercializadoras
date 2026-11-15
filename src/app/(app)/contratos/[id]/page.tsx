import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ContractDetailClient from './ContractDetailClient';
import { getClaimsAction } from '@/app/actions/claimsActions';

export const dynamic = 'force-dynamic';

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  const session = await auth();
  const sessionUser = session?.user as any;

  let maxRenewalDays = 45;
  let dbUser: any = null;
  if (sessionUser?.id) {
    dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        role: true,
        channelId: true,
        brandId: true,
        channel: { select: { id: true, name: true, maxRenewalDays: true } },
      },
    });
  }
  if (!dbUser && sessionUser?.email) {
    dbUser = await prisma.user.findFirst({
      where: { email: { equals: String(sessionUser.email).trim(), mode: 'insensitive' } },
      select: {
        id: true,
        email: true,
        role: true,
        channelId: true,
        brandId: true,
        channel: { select: { id: true, name: true, maxRenewalDays: true } },
      },
    });
  }
  if (dbUser?.channel?.maxRenewalDays) {
    maxRenewalDays = dbUser.channel.maxRenewalDays;
  }

  const liveRole: string = dbUser?.role || sessionUser?.role || 'CLIENT';
  const isAdminOrBackoffice = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(liveRole);

  const { getUserVisibilityFilter } = await import('@/lib/permissions');
  const visibilityFilter = await getUserVisibilityFilter();

  const contract = await prisma.contract.findFirst({
    where: {
      AND: [visibilityFilter, { id: resolvedParams.id }],
    },
    include: {
      Lead: {
        include: {
          documents: { orderBy: { createdAt: 'desc' } },
        },
      },
      client: {
        include: {
          documents: { orderBy: { createdAt: 'desc' } },
        },
      },
      supplyPoint: {
        include: {
          documents: { orderBy: { createdAt: 'desc' } },
        },
      },
      documents: { orderBy: { createdAt: 'desc' } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          codigo: true,
          role: true,
          channelId: true,
          channel: { select: { id: true, name: true, code: true } },
        },
      },
      product: true,
      AdditionalService: true,
      Commission: true,
      penaltyInvoices: { orderBy: { issueDate: 'desc' } },
      contract: {
        select: { id: true, contractCode: true, status: true, activationDate: true, version: true },
      },
      other_Contract: {
        select: { id: true, contractCode: true, status: true, activationDate: true, version: true },
      },
      invoices: {
        orderBy: { issueDate: 'desc' },
      },
    },
  });

  if (!contract) {
    notFound();
  }

  let versions: any[] = [];
  if (contract.contractCode) {
    versions = await prisma.contract.findMany({
      where: {
        AND: [
          visibilityFilter,
          {
            contractCode: contract.contractCode,
            ...(contract.brandId ? { brandId: contract.brandId } : {}),
          },
        ],
      },
      select: { id: true, version: true, status: true, createdAt: true },
      orderBy: { version: 'desc' },
    });
  }

  // Regla 58 y Regla 124: Agrupar histórico completo del contador físico por los primeros 20 caracteres del CUPS.
  // IMPORTANTE: SupplyPoint filtra marca a través de `client: { brandId }` (no tiene columna directa `brandId`).
  const effectiveBrandId = contract.brandId || contract.client?.brandId || null;
  const rawCups = contract.supplyPoint?.cups || contract.Lead?.cups || '';
  const cups20 = rawCups && !rawCups.startsWith('CUPS_MOCK') ? rawCups.substring(0, 20) : '';
  let allSupplyPointIds: string[] = contract.supplyPointId ? [contract.supplyPointId] : [];
  if (cups20.length >= 20) {
    const matchingSps = await prisma.supplyPoint.findMany({
      where: {
        cups: { startsWith: cups20 },
        ...(effectiveBrandId ? { client: { brandId: effectiveBrandId } } : {}),
      },
      select: { id: true },
    });
    if (matchingSps.length > 0) {
      allSupplyPointIds = Array.from(new Set([...allSupplyPointIds, ...matchingSps.map((sp) => sp.id)]));
    }
  }

  // Fetch Switching Events for this CUPS, excluding irrelevant ones
  let switchingEvents: any[] = [];
  if (allSupplyPointIds.length > 0 && isAdminOrBackoffice) {
    switchingEvents = await prisma.switchingEvent.findMany({
      where: {
        supplyPointId: { in: allSupplyPointIds },
        procesoBase: { notIn: ['F1', 'R1', 'P0', 'Q1', 'W1', 'T1'] },
      },
      orderBy: { fechaAviso: 'desc' },
    });
  }

  // Fetch Claims (R1) for this contract and all SupplyPoint clones of this CUPS (Regla 21 / Regla 190)
  let claims: any[] = [];
  const claimsResult = await getClaimsAction(
    { contractId: contract.id, supplyPointIds: allSupplyPointIds },
    1,
    0
  );
  if (claimsResult.success) {
    claims = claimsResult.data;
  }

  // Fetch F1 Invoices for this contract dynamically by dates (Regla 56 y Regla 178)
  let f1Invoices: any[] = [];
  if (allSupplyPointIds.length > 0 && contract.activationDate && isAdminOrBackoffice) {
    f1Invoices = await prisma.f1Invoice.findMany({
      where: {
        supplyPointId: { in: allSupplyPointIds },
        fechaFin: { gte: contract.activationDate },
        ...(contract.terminationDate ? { fechaInicio: { lte: contract.terminationDate } } : {}),
      },
      orderBy: { fechaEmision: 'desc' },
    });
  }

  // Fetch Historical Invoices for this CUPS across all contracts with permissions (Regla 93 y Regla 124)
  let historicalInvoices: any[] = [];
  if (allSupplyPointIds.length > 0) {
    const invoicesWhere: any = { supplyPointId: { in: allSupplyPointIds } };

    if (liveRole === 'SUPERADMIN') {
      // Full history for the CUPS
    } else if (liveRole === 'BACKOFFICE' || liveRole === 'COMPANYADMIN') {
      if (effectiveBrandId) {
        invoicesWhere.client = { brandId: effectiveBrandId };
      }
    } else if (liveRole === 'CANAL') {
      invoicesWhere.contract = dbUser?.channelId
        ? { OR: [{ user: { channelId: dbUser.channelId } }, { userId: dbUser.id }] }
        : { userId: dbUser?.id || 'unauthorized' };
    } else if (liveRole === 'COMERCIAL') {
      invoicesWhere.contract = { userId: dbUser?.id || 'unauthorized' };
    } else {
      invoicesWhere.clientId = contract.clientId;
    }

    historicalInvoices = await prisma.invoice.findMany({
      where: invoicesWhere,
      orderBy: { issueDate: 'asc' },
    });
  }

  // Regla 68: Resolución resiliente del producto si el contrato viene de histórico
  let resolvedProduct: any = contract.product;
  if (!resolvedProduct && contract.Lead?.product) {
    const prodRef = String(contract.Lead.product).trim();
    if (prodRef.startsWith('cm')) {
      resolvedProduct = await prisma.product.findUnique({ where: { id: prodRef } });
    } else if (prodRef) {
      resolvedProduct = await prisma.product.findFirst({
        where: {
          name: prodRef,
          ...(effectiveBrandId ? { brandId: effectiveBrandId } : {}),
        },
      });
    }
  }

  let finalDistributorName = contract.supplyPoint?.distributorName;
  if (!finalDistributorName || /^\d{4}$/.test(contract.supplyPoint?.distributor || '')) {
    const cups = contract.supplyPoint?.cups || contract.Lead?.cups || '';
    const reeCode = contract.supplyPoint?.distributorReeCode || cups.substring(2, 6);
    if (reeCode && reeCode.length === 4) {
      const dbDistri = await prisma.distributor.findFirst({ where: { reeCode } });
      if (dbDistri) {
        finalDistributorName = dbDistri.name;
      }
    }
  }

  // Unificar y deduplicar todos los documentos del expediente (Contrato, Lead, Punto de Suministro y Cliente)
  const seenDocUrls = new Set<string>();
  const expedienteDocuments: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    origin: string;
    createdAt?: Date | string | null;
  }> = [];

  const pushDoc = (doc: { id?: string; name?: string | null; type?: string | null; url?: string | null; createdAt?: Date | string | null }, origin: string) => {
    const cleanUrl = doc?.url?.trim();
    if (!cleanUrl || seenDocUrls.has(cleanUrl)) return;
    seenDocUrls.add(cleanUrl);
    expedienteDocuments.push({
      id: doc.id || `${origin}-${expedienteDocuments.length}`,
      name: doc.name || doc.type || 'Documento adjunto',
      type: doc.type || 'Documento',
      url: cleanUrl,
      origin,
      createdAt: doc.createdAt || null,
    });
  };

  (contract.documents || []).forEach((d) => pushDoc(d, 'Contrato'));
  (contract.Lead?.documents || []).forEach((d) => pushDoc(d, 'Lead'));
  (contract.supplyPoint?.documents || []).forEach((d) => pushDoc(d, 'CUPS'));
  (contract.client?.documents || []).forEach((d) => pushDoc(d, 'Cliente'));

  if (contract.client?.fileRepresentativeId) {
    pushDoc({ name: 'DNI / Identificación Titular o Representante', type: 'DNI_TITULAR', url: contract.client.fileRepresentativeId }, 'Cliente');
  }
  if (contract.client?.fileIbanCertificate) {
    pushDoc({ name: 'Certificado Titularidad Bancaria (IBAN)', type: 'CERTIFICADO_IBAN', url: contract.client.fileIbanCertificate }, 'Cliente');
  }
  if (contract.supplyPoint?.fileCie) {
    pushDoc({ name: 'Certificado Instalación Eléctrica (CIE)', type: 'CIE', url: contract.supplyPoint.fileCie }, 'CUPS');
  }
  if (contract.supplyPoint?.fileCieSelfConsump) {
    pushDoc({ name: 'CIE Autoconsumo', type: 'CIE_AUTOCONSUMO', url: contract.supplyPoint.fileCieSelfConsump }, 'CUPS');
  }

  // Sanitizar facturas (ocultar margen interno a roles no administrativos)
  const sanitizeInvoice = (inv: any) => {
    if (isAdminOrBackoffice) return inv;
    const { margin: _m, ...safeInv } = inv;
    return safeInv;
  };

  const safeInvoices = (contract.invoices || []).map(sanitizeInvoice);
  const safeHistoricalInvoices = historicalInvoices.map(sanitizeInvoice);

  // Sanitizar producto según rol
  const safeProduct = resolvedProduct
    ? (() => {
        if (isAdminOrBackoffice) return resolvedProduct;
        const {
          marginFC: _mfc,
          ip1: _ip1,
          ip2: _ip2,
          ip3: _ip3,
          ip4: _ip4,
          ip5: _ip5,
          ip6: _ip6,
          powerTiersCommission: _ptc,
          ...restProd
        } = resolvedProduct;
        if (liveRole === 'CLIENT') {
          const { fee: _pfee, deviationCost: _pdsv, ...clientProd } = restProd;
          return clientProd;
        }
        return restProd;
      })()
    : null;

  const baseUiContract: any = {
    ...contract,
    lead: contract.Lead ? { ...contract.Lead, documents: contract.Lead.documents } : null,
    client: contract.client,
    supplyPoint: contract.supplyPoint
      ? {
          ...contract.supplyPoint,
          distributorName: finalDistributorName || contract.supplyPoint?.distributorName,
        }
      : null,
    user: contract.user,
    product: safeProduct,
    additionalServicesList: contract.AdditionalService || [],
    commissionRecord: contract.Commission || null,
    previousContract: contract.contract || null,
    nextContract: contract.other_Contract || null,
    expedienteDocuments,
    invoices: safeInvoices,
    f1Invoices,
    switchingEvents,
    claims,
    historicalInvoices: safeHistoricalInvoices,
  };

  // Sanitizar márgenes y comisiones confidenciales en el servidor antes de serializar al cliente
  let uiContract = baseUiContract;
  if (!isAdminOrBackoffice) {
    const {
      marginFC: _mfc,
      ip1: _ip1,
      ip2: _ip2,
      ip3: _ip3,
      ip4: _ip4,
      ip5: _ip5,
      ip6: _ip6,
      powerTiersCommission: _ptc,
      winbackNotes: _wn,
      ...withoutInternalMargins
    } = baseUiContract;

    if (liveRole === 'CLIENT') {
      const {
        fee: _fee,
        deviationCost: _dsv,
        commissionBase: _cb,
        commissionFinal: _cf,
        commissionVariable: _cv,
        commissionType: _ct,
        commissionRuleType: _crt,
        commissionRuleValue: _crv,
        Commission: _commRel,
        commissionRecord: _commRec,
        internalComments: _ic,
        distributorMsg: _dm,
        winbackStatus: _ws,
        winbackLastContactAt: _wl,
        winbackProductOffered: _wp,
        ...clientSafe
      } = withoutInternalMargins;
      uiContract = clientSafe;
    } else {
      uiContract = withoutInternalMargins;
    }
  }

  return (
    <ContractDetailClient
      initialContract={uiContract}
      userRole={liveRole}
      maxRenewalDays={maxRenewalDays}
      versions={versions}
    />
  );
}
