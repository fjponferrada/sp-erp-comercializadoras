'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getSupplyPointVisibilityFilter } from '@/lib/permissions';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';
import {
  extractF1Financials,
  resolveDistributorInfo,
  type ExtractedF1Data,
} from '@/lib/f1Utils';

export type F1BilledStatusFilter =
  | 'ALL'
  | 'BILLED'
  | 'PENDING'
  | 'INTERNAL_DRAFT'
  | 'INTERNAL_EMITTED';

export interface F1QueryFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
  billedStatus?: F1BilledStatusFilter;
  tipoFactura?: string;
  distributorCode?: string;
}

function reverseShiftedDbDateToIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  // En BD, fechaInicio y fechaFin se guardan desplazadas +1 día a las 00:00 Europe/Madrid (Regla 170).
  // Restamos 12 horas y formateamos en Europe/Madrid para recuperar el día inclusivo original del XML.
  const shiftedBack = new Date(dateObj.getTime() - 12 * 60 * 60 * 1000);
  return shiftedBack.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
}

function dateToMadridIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return null;
  return dateObj.toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }).substring(0, 10);
}

function buildClientSearchOr(term: string) {
  return [
    { vatNumber: { contains: term, mode: 'insensitive' as const } },
    { businessName: { contains: term, mode: 'insensitive' as const } },
    { firstName: { contains: term, mode: 'insensitive' as const } },
    { lastName: { contains: term, mode: 'insensitive' as const } },
  ];
}

async function buildF1WhereClause(filters: F1QueryFilters): Promise<Prisma.F1InvoiceWhereInput> {
  const visibilityFilter = (await getSupplyPointVisibilityFilter()) as Record<string, any>;

  if (visibilityFilter.id === 'not_logged_in') {
    return { id: 'not_logged_in' };
  }

  const andConditions: Prisma.F1InvoiceWhereInput[] = [];

  if (Object.keys(visibilityFilter).length > 0) {
    andConditions.push({
      OR: [
        { contract: visibilityFilter as any },
        { supplyPoint: visibilityFilter as any },
      ],
    });
  }

  const rawSearch = (filters.search || '').trim();
  if (rawSearch) {
    const cleanCf = rawSearch.replace(/^CF\s+/i, '').trim();
    const searchOr: Prisma.F1InvoiceWhereInput[] = [
      { numeroFactura: { contains: rawSearch, mode: 'insensitive' } },
      { supplyPoint: { cups: { contains: rawSearch, mode: 'insensitive' } } },
      { contract: { contractCode: { contains: rawSearch, mode: 'insensitive' } } },
      { contract: { client: { OR: buildClientSearchOr(rawSearch) } } },
      { supplyPoint: { client: { OR: buildClientSearchOr(rawSearch) } } },
    ];
    if (cleanCf && cleanCf !== rawSearch) {
      searchOr.push({ numeroFactura: { contains: cleanCf, mode: 'insensitive' } });
    }
    andConditions.push({ OR: searchOr });
  }

  if (filters.startDate || filters.endDate) {
    const fechaFilter: Prisma.DateTimeNullableFilter = {};
    if (filters.startDate) {
      fechaFilter.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    }
    if (filters.endDate) {
      fechaFilter.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    }
    andConditions.push({ fechaEmision: fechaFilter });
  }

  if (filters.billedStatus === 'BILLED') {
    andConditions.push({ invoices: { some: {} } });
  } else if (filters.billedStatus === 'PENDING') {
    andConditions.push({ invoices: { none: {} } });
  } else if (filters.billedStatus === 'INTERNAL_DRAFT') {
    andConditions.push({
      internalInvoices: {
        some: { status: { in: ['BORRADOR', 'REQUIERE_REPARACION'] } },
      },
    });
  } else if (filters.billedStatus === 'INTERNAL_EMITTED') {
    andConditions.push({
      internalInvoices: {
        some: { status: { in: ['EMITIDA', 'ABONO'] } },
      },
    });
  }

  if (filters.tipoFactura && filters.tipoFactura !== 'ALL') {
    const tf = filters.tipoFactura.trim().toUpperCase();
    if (tf === 'OTRAS') {
      andConditions.push({ tipoDocumento: 'OtrasFacturas' });
    } else if (tf === 'AR') {
      andConditions.push({
        OR: [
          { numeroFactura: { startsWith: 'AR-' } },
          {
            jsonData: {
              path: ['DatosGeneralesFacturaATR', 'DatosGeneralesFactura', 'TipoFactura'],
              equals: 'AR',
            },
          },
          {
            jsonData: {
              path: ['DatosGeneralesOtrasFacturas', 'DatosGeneralesFactura', 'TipoFactura'],
              equals: 'AR',
            },
          },
        ],
      });
    } else {
      andConditions.push({
        OR: [
          {
            jsonData: {
              path: ['DatosGeneralesFacturaATR', 'DatosGeneralesFactura', 'TipoFactura'],
              equals: tf,
            },
          },
          {
            jsonData: {
              path: ['DatosGeneralesOtrasFacturas', 'DatosGeneralesFactura', 'TipoFactura'],
              equals: tf,
            },
          },
        ],
      });
    }
  }

  if (filters.distributorCode && filters.distributorCode !== 'ALL') {
    const dc = filters.distributorCode.trim();
    andConditions.push({
      OR: [
        { supplyPoint: { cups: { startsWith: `ES${dc}`, mode: 'insensitive' } } },
        { supplyPoint: { distributor: { contains: `[${dc}]`, mode: 'insensitive' } } },
      ],
    });
  }

  return andConditions.length > 0 ? { AND: andConditions } : {};
}

function resolveBestContractForF1(file: any) {
  if (file.contract) {
    return file.contract;
  }

  const contracts: any[] = file.supplyPoint?.contracts || [];
  if (contracts.length === 0) return null;

  const cycleStartMs = file.fechaInicio ? new Date(file.fechaInicio).getTime() : null;
  const cycleEndMs = file.fechaFin ? new Date(file.fechaFin).getTime() : null;

  if (cycleStartMs && cycleEndMs) {
    const overlapping = contracts.filter((c) => {
      if (!c.activationDate) return false;
      const actMs = new Date(c.activationDate).getTime();
      const termMs = c.terminationDate ? new Date(c.terminationDate).getTime() : null;
      const startOk = cycleEndMs > cycleStartMs ? actMs < cycleEndMs : actMs <= cycleEndMs;
      const endOk = !termMs || termMs >= cycleStartMs;
      return startOk && endOk;
    });

    if (overlapping.length > 0) {
      // Regla 178: priorizar el contrato vigente al inicio del ciclo y luego el más reciente
      overlapping.sort((a, b) => {
        const aAct = new Date(a.activationDate).getTime();
        const bAct = new Date(b.activationDate).getTime();
        const aCoversStart = aAct <= cycleStartMs ? 1 : 0;
        const bCoversStart = bAct <= cycleStartMs ? 1 : 0;
        if (aCoversStart !== bCoversStart) return bCoversStart - aCoversStart;
        return bAct - aAct;
      });
      return overlapping[0];
    }
  }

  const active = contracts.find(
    (c) => c.status === 'ACTIVO' || c.status === 'EN_VIGOR' || c.status === 'Activo'
  );
  return active || contracts[0];
}

function resolveClientDisplayName(client: any): string {
  if (!client) return '';
  if (client.businessName && client.businessName.trim()) return client.businessName.trim();
  const full = `${client.firstName || ''} ${client.lastName || ''}`.trim();
  return full;
}

export async function getPaginatedF1FilesAction(
  page: number = 1,
  pageSize: number = 100,
  startDate?: string,
  endDate?: string,
  cupsOrSearch?: string,
  billedStatus: F1BilledStatusFilter = 'ALL',
  tipoFactura: string = 'ALL',
  distributorCode: string = 'ALL'
) {
  try {
    const session = await auth();
    if (!session?.user || !hasAdminOrBackofficeRole(session.user.role)) {
      throw new Error('No autorizado');
    }

    const whereClause = await buildF1WhereClause({
      startDate,
      endDate,
      search: cupsOrSearch,
      billedStatus,
      tipoFactura,
      distributorCode,
    });

    const isUnbounded = pageSize <= 0;
    const safePage = Math.max(1, page);
    const safePageSize = isUnbounded ? undefined : Math.min(500, Math.max(10, pageSize));

    const [files, total] = await Promise.all([
      prisma.f1Invoice.findMany({
        where: whereClause,
        include: {
          contract: {
            include: {
              client: {
                select: {
                  id: true,
                  businessName: true,
                  firstName: true,
                  lastName: true,
                  vatNumber: true,
                },
              },
            },
          },
          supplyPoint: {
            include: {
              client: {
                select: {
                  id: true,
                  businessName: true,
                  firstName: true,
                  lastName: true,
                  vatNumber: true,
                },
              },
              contracts: {
                where: { status: { notIn: ['DRAFT', 'Borrador'] } },
                include: {
                  client: {
                    select: {
                      id: true,
                      businessName: true,
                      firstName: true,
                      lastName: true,
                      vatNumber: true,
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              pdfUrl: true,
              invoiceType: true,
            },
          },
          internalInvoices: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              totalAmount: true,
            },
          },
        },
        orderBy: [{ fechaEmision: 'desc' }, { createdAt: 'desc' }],
        ...(safePageSize
          ? {
              skip: (safePage - 1) * safePageSize,
              take: safePageSize,
            }
          : {}),
      }),
      prisma.f1Invoice.count({ where: whereClause }),
    ]);

    const formattedFiles = files.map((file: any) => {
      const activeContract = resolveBestContractForF1(file);
      const client = activeContract?.client || file.supplyPoint?.client || null;
      const extracted: ExtractedF1Data = extractF1Financials(
        file.jsonData,
        file.tipoDocumento,
        file.numeroFactura
      );

      const cups = file.supplyPoint?.cups || extracted.cups || null;
      const distributor = resolveDistributorInfo(
        cups,
        file.supplyPoint?.distributor,
        extracted.identificadorEmisora
      );

      const fechaEmisionIso =
        extracted.fechaFacturaIso || dateToMadridIso(file.fechaEmision);
      const fechaDesdeIso =
        extracted.fechaDesdeIso || reverseShiftedDbDateToIso(file.fechaInicio);
      const fechaHastaIso =
        extracted.fechaHastaIso || reverseShiftedDbDateToIso(file.fechaFin);

      return {
        id: file.id,
        numeroFactura: file.numeroFactura,
        tipoDocumento: file.tipoDocumento,
        motivoFacturacion: file.motivoFacturacion || extracted.motivoFacturacion,
        fechaEmision: file.fechaEmision,
        fechaEmisionIso,
        fechaDesdeIso,
        fechaHastaIso,
        numeroDias: extracted.numeroDias,
        baseImponible: file.baseImponible ?? extracted.baseImponible,
        totalPeajes: file.totalPeajes ?? extracted.totalPeajes,
        totalCargos: file.totalCargos ?? extracted.totalCargos,
        saldoFactura: file.saldoFactura ?? extracted.importeTotalFactura,
        saldoFacturaXml: extracted.saldoFacturaXml,
        hasDistinctSaldo: extracted.hasDistinctSaldo,
        totalEnergiaKwh: extracted.totalEnergiaKwh,
        xmlUrl: file.xmlUrl,
        supplyPointId: file.supplyPointId || file.supplyPoint?.id || null,
        cups,
        distributor,
        contract: activeContract
          ? {
              id: activeContract.id,
              contractCode: activeContract.contractCode,
              status: activeContract.status,
              tariff: file.supplyPoint?.tariff || null,
            }
          : null,
        client: client
          ? {
              id: client.id,
              displayName: resolveClientDisplayName(client),
              vatNumber: client.vatNumber,
            }
          : null,
        invoices: file.invoices || [],
        internalInvoices: file.internalInvoices || [],
        extracted,
      };
    });

    return {
      success: true,
      files: formattedFiles,
      totalCount: total,
      totalPages: safePageSize ? Math.ceil(total / safePageSize) : 1,
    };
  } catch (error: any) {
    console.error('Error fetching F1 files:', error);
    return { success: false, error: error.message };
  }
}

export async function getF1SummaryKpisAction(
  startDate?: string,
  endDate?: string,
  cupsOrSearch?: string,
  billedStatus: F1BilledStatusFilter = 'ALL',
  tipoFactura: string = 'ALL',
  distributorCode: string = 'ALL'
) {
  try {
    const session = await auth();
    if (!session?.user || !hasAdminOrBackofficeRole(session.user.role)) {
      throw new Error('No autorizado');
    }

    const baseWhere = await buildF1WhereClause({
      startDate,
      endDate,
      search: cupsOrSearch,
      billedStatus,
      tipoFactura,
      distributorCode,
    });

    const pendingWhere: Prisma.F1InvoiceWhereInput =
      billedStatus === 'BILLED'
        ? { id: 'none_when_billed_only' }
        : {
            AND: [baseWhere, { invoices: { none: {} } }],
          };

    const [agg, billedCount, pendingIdsRows] = await Promise.all([
      prisma.f1Invoice.aggregate({
        where: baseWhere,
        _count: { _all: true },
        _sum: {
          baseImponible: true,
          totalPeajes: true,
          totalCargos: true,
          saldoFactura: true,
        },
      }),
      prisma.f1Invoice.count({
        where: {
          AND: [baseWhere, { invoices: { some: {} } }],
        },
      }),
      billedStatus === 'BILLED'
        ? Promise.resolve([] as Array<{ id: string }>)
        : prisma.f1Invoice.findMany({
            where: pendingWhere,
            select: { id: true },
          }),
    ]);

    let pendingEnergiaKWh = 0;
    if (pendingIdsRows.length > 0) {
      const ids = pendingIdsRows.map((r) => r.id);
      const energyRes = await prisma.$queryRaw<Array<{ total_energia: string | number | null }>>`
        SELECT SUM(
          CASE
            WHEN COALESCE(
              f."jsonData"->'DatosGeneralesFacturaATR'->'DatosGeneralesFactura'->>'TipoFactura',
              ''
            ) = 'A'
              AND COALESCE(f."saldoFactura", 0) < 0
              AND REPLACE(COALESCE(p->>'ValorEnergiaActiva', '0'), ',', '.')::numeric > 0
            THEN -REPLACE(COALESCE(p->>'ValorEnergiaActiva', '0'), ',', '.')::numeric
            ELSE REPLACE(COALESCE(p->>'ValorEnergiaActiva', '0'), ',', '.')::numeric
          END
        ) AS total_energia
        FROM "F1Invoice" f
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva') = 'array'
              THEN f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva'
            WHEN jsonb_typeof(f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva') = 'object'
              THEN jsonb_build_array(f."jsonData"->'EnergiaActiva'->'TerminoEnergiaActiva')
            ELSE '[]'::jsonb
          END
        ) AS tea
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(tea->'Periodo') = 'array'
              THEN tea->'Periodo'
            WHEN jsonb_typeof(tea->'Periodo') = 'object'
              THEN jsonb_build_array(tea->'Periodo')
            ELSE '[]'::jsonb
          END
        ) AS p
        WHERE f.id = ANY(${ids}::text[])
      `;
      pendingEnergiaKWh = energyRes[0]?.total_energia
        ? Number(energyRes[0].total_energia)
        : 0;
    }

    const totalCount = agg._count._all || 0;
    const pendingCount = billedStatus === 'BILLED' ? 0 : pendingIdsRows.length;

    return {
      success: true,
      totalCount,
      billedCount,
      pendingCount,
      totalMWh: Math.round((pendingEnergiaKWh / 1000) * 100) / 100,
      sumBaseImponible: agg._sum.baseImponible || 0,
      sumTotalPeajes: agg._sum.totalPeajes || 0,
      sumTotalCargos: agg._sum.totalCargos || 0,
      sumTotalFactura: agg._sum.saldoFactura || 0,
    };
  } catch (err: any) {
    console.error('Error fetching F1 summary KPIs:', err);
    return { success: false, error: err.message };
  }
}

export async function getPendingF1EnergyAction(
  startDate?: string,
  endDate?: string,
  cups?: string,
  billedStatus: F1BilledStatusFilter = 'ALL',
  tipoFactura: string = 'ALL',
  distributorCode: string = 'ALL'
) {
  return getF1SummaryKpisAction(
    startDate,
    endDate,
    cups,
    billedStatus,
    tipoFactura,
    distributorCode
  );
}

export async function getF1FilterOptionsAction() {
  try {
    const session = await auth();
    if (!session?.user || !hasAdminOrBackofficeRole(session.user.role)) {
      throw new Error('No autorizado');
    }

    const baseWhere = await buildF1WhereClause({});
    const spRows = await prisma.f1Invoice.findMany({
      where: baseWhere,
      select: {
        supplyPoint: {
          select: {
            cups: true,
            distributor: true,
          },
        },
      },
      distinct: ['supplyPointId'],
    });

    const distMap = new Map<string, string>();
    for (const r of spRows) {
      const info = resolveDistributorInfo(r.supplyPoint?.cups, r.supplyPoint?.distributor, null);
      if (info.code && info.code !== 'DESCONOCIDA' && info.code !== 'OTRA') {
        if (!distMap.has(info.code)) {
          distMap.set(info.code, info.shortName);
        }
      }
    }

    const distributors = Array.from(distMap.entries())
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));

    return {
      success: true,
      distributors,
    };
  } catch (error: any) {
    console.error('Error fetching F1 filter options:', error);
    return { success: false, distributors: [] };
  }
}

export async function getF1RawXmlJsonAction(f1Id: string) {
  try {
    const session = await auth();
    if (!session?.user || !hasAdminOrBackofficeRole(session.user.role)) {
      throw new Error('No autorizado');
    }

    const baseWhere = await buildF1WhereClause({});
    const f1 = await prisma.f1Invoice.findFirst({
      where: {
        AND: [{ id: f1Id }, baseWhere],
      },
      select: {
        id: true,
        numeroFactura: true,
        xmlUrl: true,
        jsonData: true,
      },
    });

    if (!f1) {
      return { success: false, error: 'Factura F1 no encontrada o sin permisos' };
    }

    return { success: true, f1 };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function exportF1FilesAction(
  startDate?: string,
  endDate?: string,
  cupsOrSearch?: string,
  billedStatus: F1BilledStatusFilter = 'ALL',
  tipoFactura: string = 'ALL',
  distributorCode: string = 'ALL'
) {
  const res = await getPaginatedF1FilesAction(
    1,
    0,
    startDate,
    endDate,
    cupsOrSearch,
    billedStatus,
    tipoFactura,
    distributorCode
  );
  if (!res.success || !res.files) {
    return { success: false, error: res.error || 'Error al exportar ficheros F1' };
  }

  const rows = res.files.map((f: any) => ({
    fechaEmision: f.fechaEmisionIso || '',
    numeroFactura: f.numeroFactura || '',
    tipoDocumento: f.tipoDocumento || '',
    tipoFactura: f.extracted?.tipoFactura || '',
    tipoFacturaDesc: f.extracted?.tipoFacturaLabel || '',
    motivoFacturacion: f.extracted?.motivoFacturacionLabel || f.motivoFacturacion || '',
    estadoFacturacion:
      f.invoices && f.invoices.length > 0
        ? `Facturado (${f.invoices[0].invoiceNumber || 'Sí'})`
        : f.internalInvoices && f.internalInvoices.length > 0
          ? `Interna (${f.internalInvoices[0].status})`
          : 'Pendiente',
    cups: f.cups || '',
    distribuidora: f.distributor?.name || '',
    tarifaAtr: f.extracted?.tarifaAtrLabel || f.contract?.tariff || '',
    contrato: f.contract?.contractCode || '',
    titular: f.client?.displayName || '',
    nifCif: f.client?.vatNumber || '',
    periodoInicio: f.fechaDesdeIso || '',
    periodoFin: f.fechaHastaIso || '',
    dias: f.numeroDias ?? '',
    energiaKwh: f.totalEnergiaKwh ?? 0,
    peajesPotenciaEur: f.extracted?.potenciaEur ?? 0,
    peajesEnergiaEur: f.extracted?.energiaActivaEur ?? 0,
    excesosPotenciaEur: f.extracted?.excesosEur ?? 0,
    reactivaEur: f.extracted?.reactivaEur ?? 0,
    totalPeajesEur: f.totalPeajes ?? 0,
    totalCargosEur: f.totalCargos ?? 0,
    alquilerEquipoEur: f.extracted?.alquileresEur ?? 0,
    impuestoElectricoEur: f.extracted?.impuestoElectricoEur ?? 0,
    conceptosRepercutiblesEur: f.extracted?.conceptosRepercutiblesEur ?? 0,
    baseImponibleEur: f.baseImponible ?? 0,
    ivaEur: f.extracted?.ivaEur ?? 0,
    totalFacturaEur: f.saldoFactura ?? 0,
    saldoNetoXmlEur: f.saldoFacturaXml ?? f.saldoFactura ?? 0,
    facturaRectificada: f.extracted?.codigoRectificada || '',
    xmlUrl: f.xmlUrl || '',
  }));

  return { success: true, rows };
}

export async function getFianzasAction(
  page: number = 1,
  pageSize: number = 100,
  search?: string,
  startDate?: string,
  endDate?: string,
  motivoFilter: 'ALL' | 'FIANZA' | 'DERECHOS' | 'OTROS' = 'ALL'
) {
  try {
    const session = await auth();
    if (!session?.user || !hasAdminOrBackofficeRole(session.user.role)) {
      throw new Error('No autorizado');
    }

    const baseWhere = await buildF1WhereClause({
      startDate,
      endDate,
      search,
      tipoFactura: 'OTRAS',
    });

    const andList: Prisma.F1InvoiceWhereInput[] = [baseWhere];

    if (motivoFilter === 'FIANZA') {
      andList.push({ motivoFacturacion: { in: ['4', '04', '6', '06'] } });
    } else if (motivoFilter === 'DERECHOS') {
      andList.push({ motivoFacturacion: { in: ['1', '01', '2', '02'] } });
    } else if (motivoFilter === 'OTROS') {
      andList.push({
        OR: [
          { motivoFacturacion: null },
          { motivoFacturacion: { notIn: ['1', '01', '2', '02', '4', '04', '6', '06'] } },
        ],
      });
    }

    const whereClause: Prisma.F1InvoiceWhereInput = { AND: andList };
    const isUnbounded = pageSize <= 0;
    const safePage = Math.max(1, page);
    const safePageSize = isUnbounded ? undefined : Math.min(500, Math.max(10, pageSize));

    const [files, total, agg] = await Promise.all([
      prisma.f1Invoice.findMany({
        where: whereClause,
        include: {
          contract: {
            include: {
              client: {
                select: {
                  id: true,
                  businessName: true,
                  firstName: true,
                  lastName: true,
                  vatNumber: true,
                },
              },
            },
          },
          supplyPoint: {
            include: {
              client: {
                select: {
                  id: true,
                  businessName: true,
                  firstName: true,
                  lastName: true,
                  vatNumber: true,
                },
              },
              contracts: {
                where: { status: { notIn: ['DRAFT', 'Borrador'] } },
                include: {
                  client: {
                    select: {
                      id: true,
                      businessName: true,
                      firstName: true,
                      lastName: true,
                      vatNumber: true,
                    },
                  },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
        orderBy: [{ fechaEmision: 'desc' }, { createdAt: 'desc' }],
        ...(safePageSize
          ? {
              skip: (safePage - 1) * safePageSize,
              take: safePageSize,
            }
          : {}),
      }),
      prisma.f1Invoice.count({ where: whereClause }),
      prisma.f1Invoice.aggregate({
        where: whereClause,
        _sum: { saldoFactura: true, baseImponible: true },
      }),
    ]);

    const formattedFiles = files.map((file: any) => {
      const activeContract = resolveBestContractForF1(file);
      const client = activeContract?.client || file.supplyPoint?.client || null;
      const extracted = extractF1Financials(file.jsonData, 'OtrasFacturas', file.numeroFactura);
      const cups = file.supplyPoint?.cups || extracted.cups || null;
      const distributor = resolveDistributorInfo(
        cups,
        file.supplyPoint?.distributor,
        extracted.identificadorEmisora
      );
      const fechaEmisionIso =
        extracted.fechaFacturaIso || dateToMadridIso(file.fechaEmision);

      return {
        id: file.id,
        numeroFactura: file.numeroFactura,
        fechaEmision: file.fechaEmision,
        fechaEmisionIso,
        motivoFacturacion: file.motivoFacturacion || extracted.motivoFacturacion,
        baseImponible: file.baseImponible ?? extracted.baseImponible,
        saldoFactura: file.saldoFactura ?? extracted.importeTotalFactura,
        xmlUrl: file.xmlUrl,
        supplyPointId: file.supplyPointId || file.supplyPoint?.id || null,
        cups,
        distributor,
        contract: activeContract
          ? {
              id: activeContract.id,
              contractCode: activeContract.contractCode,
              status: activeContract.status,
            }
          : null,
        client: client
          ? {
              id: client.id,
              displayName: resolveClientDisplayName(client),
              vatNumber: client.vatNumber,
            }
          : null,
        extracted,
      };
    });

    return {
      success: true,
      files: formattedFiles,
      totalCount: total,
      totalPages: safePageSize ? Math.ceil(total / safePageSize) : 1,
      sumImporte: agg._sum.saldoFactura || 0,
      sumBase: agg._sum.baseImponible || 0,
    };
  } catch (error: any) {
    console.error('Error fetching fianzas:', error);
    return { success: false, error: error.message };
  }
}
