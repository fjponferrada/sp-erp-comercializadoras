'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveDashboardAccess } from '@/lib/dashboardAccess';
import { isInternalBillingProductionEnabled } from '@/lib/services/internalInvoiceMapper';

const IN_PROGRESS_STATUSES = [
  'TRAMITANDO',
  'Tramitando',
  'ACEPTADO',
  'Aceptado',
  'VERIFICANDO_FIRMA',
  'BORRADOR',
  'Borrador',
  'RENOVACION',
];

const REJECTED_STATUSES = [
  'RECHAZADO',
  'RECHAZO_DISTRIBUIDORA',
  'Rechazo Distribuidora',
  'RECHAZO DISTRIBUIDORA',
  'RECHAZO_COMERCIALIZADORA',
  'RECHAZO_RIESGOS',
  'RECHAZADO_POR_CLIENTE',
];

const TERMINAL_RENEWAL_CHILD_STATUSES = [
  ...REJECTED_STATUSES,
  'CANCELADO',
  'ANULADO',
];

export type SystemHealthStatus = 'ok' | 'warn' | 'error';

export interface DashboardSystemHealthItem {
  key: string;
  label: string;
  detail: string;
  status: SystemHealthStatus;
  statusText: string;
  href: string;
}

export interface DashboardRenewalItem {
  internalId: string;
  contractCode: string | null;
  client: string;
  cups: string;
  tariff: string;
  expectedEndDateIso: string;
  daysRemaining: number;
  expiresIn: string;
  urgency: 'overdue' | 'urgent' | 'soon' | 'normal';
  mwh: number;
}

export interface DashboardRecentContractItem {
  id: string;
  contractCode: string | null;
  cups: string;
  internalId: string;
  client: string;
  status: string;
  tariff: string;
  mwh: number;
  canal: string;
  updatedAtIso: string;
}

export interface DashboardMetricsData {
  kpis: {
    activos: number;
    tramitando: number;
    rechazos: number;
    bajas: number;
    mwh: number;
  };
  operationalAlerts: {
    enRiesgoPaso11: number;
    switchingWarnings: number;
    pendingF1: number;
    openClaimsR1: number;
    urgentPaso03R1: number;
    rechazos: number;
  };
  renewalsSummary: {
    totalPending90d: number;
    overdueCount: number;
  };
  renewals: DashboardRenewalItem[];
  recentContracts: DashboardRecentContractItem[];
  systemHealth: DashboardSystemHealthItem[];
  generatedAtIso: string;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatClientName(
  cl?: {
    businessName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    lastName2?: string | null;
  } | null
): string {
  if (!cl) return 'Sin cliente';
  if (cl.businessName && cl.businessName.trim()) return cl.businessName.trim();
  const fullName = [cl.firstName, cl.lastName, cl.lastName2]
    .filter((v) => v && v.trim())
    .join(' ')
    .trim();
  return fullName || 'Sin cliente';
}

function formatShortMadridDate(d?: Date | null): string {
  if (!d) return 'Sin datos';
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(d);
}

function formatRelativeHours(d: Date, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - d.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

export async function getDashboardMetricsAction(): Promise<
  { success: true; data: DashboardMetricsData } | { success: false; error: string }
> {
  try {
    const access = await resolveDashboardAccess();
    if (!access.isAuthorized) {
      return { success: false, error: 'No tienes permisos para consultar el Dashboard.' };
    }

    const now = new Date();
    const future90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const hasBrandRestriction = access.scopedBrandIds !== null;

    // Filtro de Renovaciones Pendientes reales (<= 90d y sin contrato hijo activo/tramitando)
    const renewalWhere: Prisma.ContractWhereInput = {
      AND: [
        access.contractWhere,
        {
          status: { in: ['ACTIVO', 'Activo', 'TRAMITANDO', 'Tramitando'] },
          expectedEndDate: { not: null, lte: future90Days },
          OR: [
            { other_Contract: { is: null } },
            {
              other_Contract: {
                is: { status: { in: TERMINAL_RENEWAL_CHILD_STATUSES } },
              },
            },
          ],
        },
      ],
    };

    // Filtro de Warnings de Switching (alineado con switchingActions.ts)
    const switchingCompanyAnd: Prisma.SwitchingEventWhereInput[] = [];
    if (access.activeCompanyId) {
      const companyOr: Prisma.SwitchingEventWhereInput[] = [
        { contract: { brand: { companyId: access.activeCompanyId } } },
        { supplyPoint: { client: { brand: { companyId: access.activeCompanyId } } } },
        { AND: [{ contractId: null }, { supplyPointId: null }] },
      ];
      if (access.activeCompanyReeCode) {
        companyOr.push({ uniqueProcess: { contains: `_${access.activeCompanyReeCode}_` } });
      }
      switchingCompanyAnd.push({ OR: companyOr });
    }

    const switchingWarningsWhere: Prisma.SwitchingEventWhereInput = {
      isResolved: false,
      warning: { not: null },
      procesoBase: { notIn: ['F1', 'R1', 'P0', 'Q1', 'W1'] },
      ...(switchingCompanyAnd.length > 0 ? { AND: switchingCompanyAnd } : {}),
    };

    // Filtro de Reclamaciones R1 (alineado con claimsActions.ts)
    const r1Where: Prisma.SwitchingEventWhereInput = { procesoBase: 'R1' };
    if (hasBrandRestriction) {
      r1Where.supplyPoint = access.supplyPointWhere;
    } else if (access.activeCompanyId) {
      r1Where.AND = [
        {
          OR: [
            { contract: { brand: { companyId: access.activeCompanyId } } },
            { supplyPoint: { client: { brand: { companyId: access.activeCompanyId } } } },
            { AND: [{ contractId: null }, { supplyPointId: null }] },
          ],
        },
      ];
    }

    // Filtro de F1 pendientes de facturar (alineado con f1Actions.ts)
    const pendingF1Where: Prisma.F1InvoiceWhereInput = {
      invoices: { none: {} },
      ...(hasBrandRestriction
        ? {
            OR: [
              { contract: access.contractWhere },
              { supplyPoint: access.supplyPointWhere },
            ],
          }
        : {}),
    };

    const companySqlCond = access.activeCompanyId
      ? Prisma.sql`WHERE "companyId" = ${access.activeCompanyId}`
      : Prisma.empty;
    const syncCompanySqlCond = access.activeCompanyId
      ? Prisma.sql`AND "companyId" = ${access.activeCompanyId}`
      : Prisma.empty;
    const invBrandSqlCond = hasBrandRestriction
      ? Prisma.sql`WHERE cl."brandId" IN (${Prisma.join(access.scopedBrandIds!)})`
      : Prisma.empty;

    const [
      allContracts,
      recentContractsRaw,
      totalPendingRenewals,
      overdueRenewalsCount,
      renewalAlertsRaw,
      switchingWarningsCount,
      pendingF1Count,
      r1Events,
      distConfigs,
      telemetryRows,
    ] = await Promise.all([
      prisma.contract.findMany({
        where: access.contractWhere,
        select: {
          id: true,
          contractCode: true,
          version: true,
          status: true,
          activationDate: true,
          terminationDate: true,
          fechaPrevistaBaja: true,
          annualConsumption: true,
          supplyPointId: true,
          supplyPoint: { select: { cups: true, annualConsumption: true } },
        },
      }),
      prisma.contract.findMany({
        where: access.contractWhere,
        orderBy: { updatedAt: 'desc' },
        take: 24,
        select: {
          id: true,
          contractCode: true,
          version: true,
          status: true,
          annualConsumption: true,
          updatedAt: true,
          client: { select: { businessName: true, firstName: true, lastName: true, lastName2: true } },
          supplyPoint: { select: { cups: true, annualConsumption: true, tariff: true } },
          product: { select: { tariff: true } },
          user: { select: { name: true, channel: { select: { name: true } } } },
        },
      }),
      prisma.contract.count({ where: renewalWhere }),
      prisma.contract.count({
        where: {
          AND: [renewalWhere, { expectedEndDate: { lt: now } }],
        },
      }),
      prisma.contract.findMany({
        where: renewalWhere,
        orderBy: { expectedEndDate: 'asc' },
        take: 12,
        select: {
          id: true,
          contractCode: true,
          annualConsumption: true,
          expectedEndDate: true,
          client: { select: { businessName: true, firstName: true, lastName: true, lastName2: true } },
          supplyPoint: { select: { cups: true, annualConsumption: true, tariff: true } },
          product: { select: { tariff: true } },
        },
      }),
      prisma.switchingEvent.count({ where: switchingWarningsWhere }),
      prisma.f1Invoice.count({ where: pendingF1Where }),
      prisma.switchingEvent.findMany({
        where: r1Where,
        orderBy: [{ fechaSolicitud: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          codigoSolicitud: true,
          paso: true,
          estadoAR: true,
          isAnnulled: true,
          fechaSolicitud: true,
          fechaAR: true,
          createdAt: true,
          motivosRechazo: true,
        },
      }),
      prisma.distributorCompanyConfig.findMany({
        where: access.activeCompanyId ? { companyId: access.activeCompanyId } : {},
        select: {
          ftpActive: true,
          ftpLastSyncAt: true,
          webScrapingActive: true,
          webLastSyncAt: true,
        },
      }),
      prisma.$queryRaw<
        Array<{
          sync_date: Date | null;
          omie_date: Date | null;
          compodem_date: Date | null;
          cch_date: Date | null;
          reganecu_date: Date | null;
          inv_date: Date | null;
        }>
      >(Prisma.sql`
        SELECT
          (SELECT MAX("updatedAt") FROM "SyncJob" WHERE status = 'COMPLETED' ${syncCompanySqlCond}) AS sync_date,
          (SELECT MAX(date) FROM "SystemComponentPrice" WHERE component = 'OMIE') AS omie_date,
          (SELECT MAX(date) FROM "SystemComponentPrice" WHERE component = 'TOTAL_COMPODEM') AS compodem_date,
          (SELECT MAX(date) FROM "AggregatedLoadCurve" ${companySqlCond}) AS cch_date,
          (SELECT MAX(date) FROM "ReganecuData" ${companySqlCond}) AS reganecu_date,
          (SELECT MAX(i."issueDate") FROM "Invoice" i INNER JOIN "Client" cl ON cl.id = i."clientId" ${invBrandSqlCond}) AS inv_date
      `),
    ]);

    const telemetry = telemetryRows[0] || {
      sync_date: null,
      omie_date: null,
      compodem_date: null,
      cch_date: null,
      reganecu_date: null,
      inv_date: null,
    };
    const lastSyncJob = telemetry.sync_date ? { updatedAt: new Date(telemetry.sync_date) } : null;
    const latestOmie = telemetry.omie_date ? { date: new Date(telemetry.omie_date) } : null;
    const latestCompodem = telemetry.compodem_date ? { date: new Date(telemetry.compodem_date) } : null;
    const latestLoadCurve = telemetry.cch_date ? { date: new Date(telemetry.cch_date) } : null;
    const latestReganecu = telemetry.reganecu_date ? { date: new Date(telemetry.reganecu_date) } : null;
    const latestInvoice = telemetry.inv_date ? { issueDate: new Date(telemetry.inv_date) } : null;

    // 1. Deduplicación de versiones por contractCode (idéntica a /contratos)
    const groupedByCode = new Map<string, typeof allContracts>();
    const standaloneContracts: typeof allContracts = [];

    for (const c of allContracts) {
      if (c.contractCode) {
        if (!groupedByCode.has(c.contractCode)) groupedByCode.set(c.contractCode, []);
        groupedByCode.get(c.contractCode)!.push(c);
      } else {
        standaloneContracts.push(c);
      }
    }

    const deduplicatedContracts: typeof allContracts = [...standaloneContracts];
    for (const group of groupedByCode.values()) {
      const sortedByVersion = [...group].sort((a, b) => (b.version || 0) - (a.version || 0));
      const active = sortedByVersion.find((c) => c.status === 'ACTIVO' || c.status === 'Activo');
      const inProgress = sortedByVersion.find((c) => IN_PROGRESS_STATUSES.includes(c.status));
      const fin = sortedByVersion.find((c) => c.status === 'FINALIZADO' || c.status === 'Finalizado');
      deduplicatedContracts.push(active || inProgress || fin || sortedByVersion[0]);
    }

    let activosCount = 0;
    let tramitandoCount = 0;
    let rechazosCount = 0;
    let enRiesgoPaso11Count = 0;
    let totalMWh = 0;
    const countedActiveCups = new Set<string>();

    for (const c of deduplicatedContracts) {
      if (c.status === 'ACTIVO' || c.status === 'Activo') {
        activosCount += 1;
        if (c.fechaPrevistaBaja && !c.terminationDate) {
          enRiesgoPaso11Count += 1;
        }
        const cupsKey = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId || c.id;
        if (cupsKey && !countedActiveCups.has(cupsKey)) {
          totalMWh += Number(c.annualConsumption ?? c.supplyPoint?.annualConsumption ?? 0) || 0;
          countedActiveCups.add(cupsKey);
        }
      } else if (IN_PROGRESS_STATUSES.includes(c.status)) {
        tramitandoCount += 1;
      } else if (REJECTED_STATUSES.includes(c.status)) {
        rechazosCount += 1;
      }
    }

    // 2. Bajas Netas por CUPS20 con 30 días de gracia (Reglas 17, 47 y 124) y saneamiento de fechas invertidas
    const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
    const contractsByCups: Record<string, typeof allContracts> = {};
    for (const c of allContracts) {
      if (!['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'].includes(c.status)) continue;
      const cupsKey = c.supplyPoint?.cups?.substring(0, 20) || c.supplyPointId;
      if (!cupsKey || !c.activationDate) continue;
      if (!contractsByCups[cupsKey]) contractsByCups[cupsKey] = [];
      contractsByCups[cupsKey].push(c);
    }

    let netBajasCount = 0;
    for (const cupsContracts of Object.values(contractsByCups)) {
      cupsContracts.sort((a, b) => a.activationDate!.getTime() - b.activationDate!.getTime());
      let currentPeriod: { end: Date | null } | null = null;
      let localNetBajas = 0;

      for (const c of cupsContracts) {
        const startDate = c.activationDate!;
        const effectiveEnd =
          c.terminationDate && c.terminationDate.getTime() < startDate.getTime()
            ? startDate
            : c.terminationDate || null;

        if (!currentPeriod) {
          currentPeriod = { end: effectiveEnd };
          continue;
        }

        if (currentPeriod.end === null) {
          // Suministro abierto
        } else if (startDate.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
          if (!effectiveEnd) {
            currentPeriod.end = null;
          } else if (effectiveEnd.getTime() > currentPeriod.end.getTime()) {
            currentPeriod.end = effectiveEnd;
          }
        } else {
          localNetBajas += 1;
          currentPeriod = { end: effectiveEnd };
        }
      }

      if (currentPeriod && currentPeriod.end !== null) {
        localNetBajas += 1;
      }
      netBajasCount += localNetBajas;
    }

    // 3. Reclamaciones R1 abiertas y urgentes (Paso 03 pte. info), idéntico a claimsActions.ts
    const r1Map = new Map<
      string,
      {
        anulada: boolean;
        hasPaso01: boolean;
        paso02EstadoAR: string | null;
        hasPaso02: boolean;
        paso03Fecha: Date | null;
        paso03RequiereRespuesta: boolean;
        paso04Fecha: Date | null;
        hasPaso05: boolean;
      }
    >();

    for (const ev of r1Events) {
      const key = ev.codigoSolicitud || `SIN_CODIGO_${ev.id}`;
      if (!r1Map.has(key)) {
        r1Map.set(key, {
          anulada: false,
          hasPaso01: false,
          paso02EstadoAR: null,
          hasPaso02: false,
          paso03Fecha: null,
          paso03RequiereRespuesta: false,
          paso04Fecha: null,
          hasPaso05: false,
        });
      }
      const cl = r1Map.get(key)!;
      if (ev.isAnnulled) cl.anulada = true;

      if (ev.paso === '01') {
        cl.hasPaso01 = true;
      } else if (ev.paso === '02') {
        cl.hasPaso02 = true;
        cl.paso02EstadoAR = ev.estadoAR;
      } else if (ev.paso === '03') {
        const meta =
          ev.motivosRechazo && typeof ev.motivosRechazo === 'object' && !Array.isArray(ev.motivosRechazo)
            ? (ev.motivosRechazo as Record<string, any>)
            : {};
        let tipoCom: string | null = meta.tipoComunicacion || null;
        if (!tipoCom && ev.estadoAR?.startsWith('COM_')) {
          tipoCom = ev.estadoAR.replace('COM_', '');
        }
        cl.paso03Fecha = ev.fechaSolicitud || ev.createdAt;
        cl.paso03RequiereRespuesta = tipoCom === '01' || tipoCom === '04';
      } else if (ev.paso === '04') {
        cl.paso04Fecha = ev.fechaAR || ev.fechaSolicitud || ev.createdAt;
      } else if (ev.paso === '05') {
        cl.hasPaso05 = true;
      } else if (ev.paso === '09' && ev.estadoAR === 'ACEPTADO') {
        cl.anulada = true;
      }
    }

    let openClaimsR1 = 0;
    let urgentPaso03R1 = 0;
    for (const cl of r1Map.values()) {
      let requiereInfo = cl.paso03RequiereRespuesta;
      if (requiereInfo && cl.paso04Fecha && cl.paso03Fecha) {
        if (cl.paso04Fecha.getTime() >= cl.paso03Fecha.getTime()) {
          requiereInfo = false;
        }
      }
      if (cl.anulada || cl.hasPaso05 || cl.paso02EstadoAR === 'RECHAZADO') {
        continue;
      }
      if (requiereInfo) {
        openClaimsR1 += 1;
        urgentPaso03R1 += 1;
      } else if (cl.hasPaso02 || cl.hasPaso01 || cl.paso03Fecha || cl.paso04Fecha) {
        openClaimsR1 += 1;
      }
    }

    // 4. Actividad reciente deduplicada por contractCode (máx 8 filas)
    const seenRecentCodes = new Set<string>();
    const recentContracts: DashboardRecentContractItem[] = [];
    for (const c of recentContractsRaw) {
      const codeKey = c.contractCode || c.id;
      if (seenRecentCodes.has(codeKey)) continue;
      seenRecentCodes.add(codeKey);

      recentContracts.push({
        id: c.contractCode || c.supplyPoint?.cups || '-',
        contractCode: c.contractCode || null,
        cups: c.supplyPoint?.cups || '-',
        internalId: c.id,
        client: formatClientName(c.client),
        status: c.status,
        tariff: c.supplyPoint?.tariff || c.product?.tariff || '-',
        mwh: round2(Number(c.annualConsumption ?? c.supplyPoint?.annualConsumption ?? 0) || 0),
        canal: c.user?.channel?.name || c.user?.name || 'Directo',
        updatedAtIso: c.updatedAt.toISOString(),
      });

      if (recentContracts.length >= 8) break;
    }

    // 5. Renovaciones pendientes mapeadas con urgencia semántica
    const renewals: DashboardRenewalItem[] = renewalAlertsRaw.map((c) => {
      const expDate = new Date(c.expectedEndDate!);
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let expiresIn = `En ${diffDays} días`;
      let urgency: DashboardRenewalItem['urgency'] = 'normal';

      if (diffDays < 0) {
        expiresIn = `Vencido (${Math.abs(diffDays)}d)`;
        urgency = 'overdue';
      } else if (diffDays === 0) {
        expiresIn = 'Vence hoy';
        urgency = 'urgent';
      } else if (diffDays <= 20) {
        expiresIn = `En ${diffDays} días`;
        urgency = 'urgent';
      } else if (diffDays <= 40) {
        expiresIn = `En ${diffDays} días`;
        urgency = 'soon';
      }

      return {
        internalId: c.id,
        contractCode: c.contractCode || null,
        client: formatClientName(c.client),
        cups: c.supplyPoint?.cups || '-',
        tariff: c.supplyPoint?.tariff || c.product?.tariff || '-',
        expectedEndDateIso: expDate.toISOString(),
        daysRemaining: diffDays,
        expiresIn,
        urgency,
        mwh: round2(Number(c.annualConsumption ?? c.supplyPoint?.annualConsumption ?? 0) || 0),
      };
    });

    // 6. Telemetría Real de Salud del Sistema
    // 6a) Distribuidoras ATR (FTP / Scraping)
    const activeDistConfigs = distConfigs.filter((d) => d.ftpActive || d.webScrapingActive);
    const syncTimestamps: number[] = [];
    for (const d of activeDistConfigs) {
      if (d.ftpActive && d.ftpLastSyncAt) syncTimestamps.push(d.ftpLastSyncAt.getTime());
      if (d.webScrapingActive && d.webLastSyncAt) syncTimestamps.push(d.webLastSyncAt.getTime());
    }
    if (lastSyncJob?.updatedAt) {
      syncTimestamps.push(lastSyncJob.updatedAt.getTime());
    }
    const mostRecentDistSync =
      syncTimestamps.length > 0 ? new Date(Math.max(...syncTimestamps)) : null;

    let distStatus: SystemHealthStatus = 'ok';
    let distStatusText = 'Operativo';
    let distDetail = 'Sin conectores activos';
    if (activeDistConfigs.length === 0) {
      distStatus = 'warn';
      distStatusText = 'Inactivo';
      distDetail = '0 distribuidoras activas';
    } else if (!mostRecentDistSync) {
      distStatus = 'warn';
      distStatusText = 'Sin sync';
      distDetail = `${activeDistConfigs.length} conectores activos`;
    } else {
      const ageHours = (now.getTime() - mostRecentDistSync.getTime()) / 3600000;
      distDetail = `${formatRelativeHours(mostRecentDistSync, now)} · ${activeDistConfigs.length} activas`;
      if (ageHours <= 36) {
        distStatus = 'ok';
        distStatusText = 'OK';
      } else if (ageHours <= 96) {
        distStatus = 'warn';
        distStatusText = 'Retraso';
      } else {
        distStatus = 'error';
        distStatusText = 'Revisar';
      }
    }

    // 6b) Mercado Mayorista (OMIE / COMPODEM)
    let marketStatus: SystemHealthStatus = 'ok';
    let marketStatusText = 'OK';
    if (!latestOmie?.date) {
      marketStatus = 'error';
      marketStatusText = 'Sin datos';
    } else {
      const omieAgeDays = (now.getTime() - latestOmie.date.getTime()) / (1000 * 60 * 60 * 24);
      if (omieAgeDays > 5) {
        marketStatus = 'error';
        marketStatusText = 'Desactualizado';
      } else if (omieAgeDays > 2.5) {
        marketStatus = 'warn';
        marketStatusText = 'Revisar';
      }
    }
    const marketDetail = `OMIE ${formatShortMadridDate(latestOmie?.date)} · COMPODEM ${formatShortMadridDate(latestCompodem?.date)}`;

    // 6c) Curvas CCH y Liquidación REGANECU
    let curvesStatus: SystemHealthStatus = 'ok';
    let curvesStatusText = 'OK';
    if (!latestLoadCurve?.date && !latestReganecu?.date) {
      curvesStatus = 'warn';
      curvesStatusText = 'Sin cargas';
    } else if (latestLoadCurve?.date) {
      const curveAgeDays = (now.getTime() - latestLoadCurve.date.getTime()) / (1000 * 60 * 60 * 24);
      if (curveAgeDays > 20) {
        curvesStatus = 'warn';
        curvesStatusText = 'Histórico';
      }
    }
    const curvesDetail = `CCH ${formatShortMadridDate(latestLoadCurve?.date)} · REGANECU ${formatShortMadridDate(latestReganecu?.date)}`;

    // 6d) Motor de Facturación Oficial
    const prodInternal = isInternalBillingProductionEnabled();
    const billingDetail = `${prodInternal ? 'Motor Interno (Prod)' : 'Ingebau + Shadow'} · Últ. ${formatShortMadridDate(latestInvoice?.issueDate)}`;

    const systemHealth: DashboardSystemHealthItem[] = [
      {
        key: 'distribuidoras',
        label: 'Sincronización ATR (FTP / Web)',
        detail: distDetail,
        status: distStatus,
        statusText: distStatusText,
        href: '/distribuidoras',
      },
      {
        key: 'mercado',
        label: 'Precios Mercado (OMIE / REE)',
        detail: marketDetail,
        status: marketStatus,
        statusText: marketStatusText,
        href: '/compras/precios-componentes',
      },
      {
        key: 'curvas',
        label: 'Curvas CCH y Liquidaciones',
        detail: curvesDetail,
        status: curvesStatus,
        statusText: curvesStatusText,
        href: '/compras/energia-pendiente',
      },
      {
        key: 'facturacion',
        label: 'Motor de Facturación',
        detail: billingDetail,
        status: latestInvoice?.issueDate ? 'ok' : 'warn',
        statusText: prodInternal ? 'Producción' : 'Activo',
        href: '/facturacion/interna',
      },
    ];

    return {
      success: true,
      data: {
        kpis: {
          activos: activosCount,
          tramitando: tramitandoCount,
          rechazos: rechazosCount,
          bajas: netBajasCount,
          mwh: round2(totalMWh),
        },
        operationalAlerts: {
          enRiesgoPaso11: enRiesgoPaso11Count,
          switchingWarnings: switchingWarningsCount,
          pendingF1: pendingF1Count,
          openClaimsR1,
          urgentPaso03R1,
          rechazos: rechazosCount,
        },
        renewalsSummary: {
          totalPending90d: totalPendingRenewals,
          overdueCount: overdueRenewalsCount,
        },
        renewals,
        recentContracts,
        systemHealth,
        generatedAtIso: now.toISOString(),
      },
    };
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    return { success: false, error: error.message || 'Error interno al cargar el Dashboard.' };
  }
}
