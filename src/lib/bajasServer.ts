import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getActiveBrand, getUserVisibilityFilter } from '@/lib/permissions';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';
import { uploadFileToR2 } from '@/lib/r2';
import { PenaltyInvoicePDF, PenaltyInvoicePDFData, PenaltyInvoicePDFLine } from '@/components/pdf/PenaltyInvoicePDF';

export const MADRID_TZ = 'Europe/Madrid';
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const GRACE_PERIOD_MS = 30 * MS_PER_DAY;

export type BajasTabMode = 'CONFIRMADAS' | 'PREAVISO_PASO_11';

export interface BajasQueryFilters {
  tab?: BajasTabMode;
  page?: number;
  itemsPerPage?: number;
  search?: string;
  motivoFilter?: string;
  canalFilter?: string;
  origenBajaFilter?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  tarifaFilter?: string[];
  penaltyFilter?: string;
  winbackFilter?: string;
  selectedIds?: string[];
  exportAll?: boolean;
}

export interface BajasStatsSummary {
  totalBajas: number;
  bajasEsteMes: number;
  totalMwhPerdido: number;
  avgDias: number;
  avgClientDias: number;
  totalPenaltySum: number;
  pendingPenaltyCount: number;
}

export function round2(val: number): number {
  return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
}

export function normalizeCupsRoot(cups?: string | null): string {
  if (!cups) return '';
  return String(cups).trim().toUpperCase().substring(0, 20);
}

export function parseMadridStartOfDay(dateStr: string): Date {
  return fromZonedTime(`${dateStr.trim()}T00:00:00.000`, MADRID_TZ);
}

export function parseMadridEndOfDay(dateStr: string): Date {
  return fromZonedTime(`${dateStr.trim()}T23:59:59.999`, MADRID_TZ);
}

export function formatDateIsoMadrid(date: Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const zoned = toZonedTime(d, MADRID_TZ);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, '0');
  const day = String(zoned.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSameMadridMonth(date: Date | null | undefined, refNow: Date): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const zDate = toZonedTime(d, MADRID_TZ);
  const zNow = toZonedTime(refNow, MADRID_TZ);
  return zDate.getFullYear() === zNow.getFullYear() && zDate.getMonth() === zNow.getMonth();
}

export async function getBajasSessionContext() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('No autorizado.');
  }

  const sessionUser = session.user as any;
  let role: string = sessionUser.role || 'CANAL';
  if (sessionUser.id) {
    const liveUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { role: true, isActive: true },
    });
    if (!liveUser || liveUser.isActive === false) {
      throw new Error('Usuario inactivo o no autorizado.');
    }
    role = liveUser.role;
  }

  const isBackofficeOrAdmin = hasAdminOrBackofficeRole(role);
  const [visibilityFilter, activeBrandId, activeCompanyId] = await Promise.all([
    getUserVisibilityFilter(),
    getActiveBrand(),
    resolveActiveCompanyId(session),
  ]);

  return {
    session,
    userId: sessionUser.id as string,
    role,
    isBackofficeOrAdmin,
    visibilityFilter,
    activeBrandId,
    activeCompanyId,
  };
}

export async function requirePenaltyAdminAccess() {
  const ctx = await getBajasSessionContext();
  if (!ctx.isBackofficeOrAdmin) {
    throw new Error('No tienes permisos para gestionar ni consultar penalizaciones.');
  }
  return ctx;
}

export function checkIsResidencial(vatNumber?: string | null, cnae?: string | null): boolean {
  const vat = (vatNumber || '').toUpperCase().trim();
  const cleanCnae = (cnae || '').trim();
  if (vat.startsWith('H')) return true;
  if (/^[0-9XYZ]/.test(vat) && (cleanCnae === '9820' || cleanCnae === '9821')) return true;
  return false;
}

export function resolvePermanenceMonths(b: any): number {
  if (b.permanenceMonths !== null && b.permanenceMonths !== undefined) {
    const n = Number(b.permanenceMonths);
    if (!isNaN(n)) return Math.max(0, Math.trunc(n));
  }
  if (b.product?.permanenceMonths !== null && b.product?.permanenceMonths !== undefined) {
    const n = Number(b.product.permanenceMonths);
    if (!isNaN(n)) return Math.max(0, Math.trunc(n));
  }
  const airtable = (b.airtableData as any) || {};
  const rawAt = airtable['Meses Permanencia'];
  if (rawAt !== undefined && rawAt !== null && String(rawAt).trim() !== '') {
    const parsed = parseInt(String(rawAt), 10);
    if (!isNaN(parsed)) return Math.max(0, parsed);
  }
  return 12;
}

export function calculatePenaltyDetailed(
  b: any,
  mode: BajasTabMode = 'CONFIRMADAS'
): {
  amount: number;
  dailyConsumption: number;
  daysRemaining: number;
  pMonths: number;
  isResidencial: boolean;
} {
  const airtable = (b.airtableData as any) || {};
  let pStart: Date | null = b.permanenceStartDate ? new Date(b.permanenceStartDate) : null;
  if (!pStart && airtable['INICIO_PERMANENCIA']) {
    const parsed = new Date(airtable['INICIO_PERMANENCIA']);
    if (!isNaN(parsed.getTime())) pStart = parsed;
  }
  const dAlta = pStart || (b.activationDate ? new Date(b.activationDate) : new Date());
  if (!pStart) pStart = dAlta;

  const rawEndDate =
    mode === 'PREAVISO_PASO_11'
      ? b.fechaPrevistaBaja || b.terminationDate
      : b.terminationDate || b.fechaPrevistaBaja;
  const bDate = rawEndDate ? new Date(rawEndDate) : new Date();

  const pMonths = resolvePermanenceMonths(b);
  const isResidencial = checkIsResidencial(b.client?.vatNumber, b.supplyPoint?.cnae);

  let annualConsMwh = Number(b.annualConsumption ?? b.supplyPoint?.annualConsumption ?? 0) || 0;
  if (!annualConsMwh && airtable['CONSUMO COMISION']) {
    annualConsMwh = parseFloat(String(airtable['CONSUMO COMISION'])) || 0;
  }
  const annualConsKwh = annualConsMwh * 1000;
  const dailyConsumption = annualConsKwh / 365;

  if (pMonths <= 0) {
    return { amount: 0, dailyConsumption, daysRemaining: 0, pMonths: 0, isResidencial };
  }

  const pEnd = new Date(pStart);
  pEnd.setMonth(pEnd.getMonth() + pMonths);

  if (bDate >= pEnd) {
    return { amount: 0, dailyConsumption, daysRemaining: 0, pMonths, isResidencial };
  }

  const daysRemaining = Math.max(0, Math.ceil((pEnd.getTime() - bDate.getTime()) / MS_PER_DAY));
  const expectedEnergyRemaining = dailyConsumption * daysRemaining;

  const t = (b.supplyPoint?.tariff || '').trim().toUpperCase();

  const getP = (field: string, airtableField: string): number => {
    let val = b[field];
    if ((val === null || val === undefined || val === 0) && b.product?.[field]) {
      val = b.product[field];
    }
    if ((val === null || val === undefined || val === 0) && airtable[airtableField]) {
      const arr = airtable[airtableField];
      val = Array.isArray(arr) ? parseFloat(arr[0]) : parseFloat(arr);
    }
    return Number(val) || 0;
  };

  const p1 = getP('p1e', 'P1E (from PRODUCTOS)');
  const p2 = getP('p2e', 'P2E (from PRODUCTOS)');
  const p3 = getP('p3e', 'P3E (from PRODUCTOS)');
  const p4 = getP('p4e', 'P4E (from PRODUCTOS)');
  const p5 = getP('p5e', 'P5E (from PRODUCTOS)');
  const p6 = getP('p6e', 'P6E (from PRODUCTOS)');

  let energyPrice = 0;
  if (t === '2.0TD' && p1 > 0 && (p2 > 0 || p3 > 0)) {
    energyPrice = p1 * 0.25 + p2 * 0.25 + p3 * 0.5;
  } else if (t !== '2.0TD' && p1 > 0 && p6 > 0) {
    energyPrice = p1 * 0.1 + p2 * 0.1 + p3 * 0.1 + p4 * 0.1 + p5 * 0.1 + p6 * 0.5;
  }

  if (!energyPrice || isNaN(energyPrice)) {
    if (t === '2.0TD') energyPrice = 0.16;
    else if (t.startsWith('3.0')) energyPrice = 0.15;
    else if (t.startsWith('6.')) energyPrice = 0.14;
    else energyPrice = isResidencial ? 0.16 : 0.15;
  }

  let amount = 0;
  if (t.startsWith('6.')) {
    amount = expectedEnergyRemaining * 0.03;
  } else {
    const daysFromStart = Math.ceil((bDate.getTime() - pStart.getTime()) / MS_PER_DAY);
    if (isResidencial && daysFromStart <= 14) {
      amount = 0;
    } else {
      amount = expectedEnergyRemaining * energyPrice * 0.05;
    }
  }

  return {
    amount: round2(Math.max(0, amount)),
    dailyConsumption,
    daysRemaining,
    pMonths,
    isResidencial,
  };
}

export function resolveCalculatedPenalty(b: any, mode: BajasTabMode = 'CONFIRMADAS'): number {
  if (b.calculatedPenalty !== null && b.calculatedPenalty !== undefined) {
    // Respect permanenceMonths === 0 even if legacy calculatedPenalty had a value
    if (b.permanenceMonths === 0) return 0;
    return round2(Number(b.calculatedPenalty) || 0);
  }
  return calculatePenaltyDetailed(b, mode).amount;
}

export function resolveEffectivePenalty(b: any, mode: BajasTabMode = 'CONFIRMADAS'): number {
  const status = b.penaltyStatus || 'PENDIENTE';
  if (status === 'DESCARTADA') return 0;
  if (b.penalization !== null && b.penalization !== undefined) {
    return round2(Math.max(0, Number(b.penalization) || 0));
  }
  return resolveCalculatedPenalty(b, mode);
}

/**
 * Checks whether a non-residential contract terminated (or is scheduled to terminate)
 * inside the 30-day prior notice window immediately preceding contract expiration or annual cycle renewal.
 */
export function computeIsPreavisoBreached(b: any, mode: BajasTabMode = 'CONFIRMADAS'): boolean {
  const isResidencial = checkIsResidencial(b.client?.vatNumber, b.supplyPoint?.cnae);
  if (isResidencial) return false;

  const pMonths = resolvePermanenceMonths(b);
  if (pMonths <= 0) return false;

  const airtable = (b.airtableData as any) || {};
  let pStart: Date | null = b.permanenceStartDate ? new Date(b.permanenceStartDate) : null;
  if (!pStart && airtable['INICIO_PERMANENCIA']) {
    const parsed = new Date(airtable['INICIO_PERMANENCIA']);
    if (!isNaN(parsed.getTime())) pStart = parsed;
  }
  if (!pStart && b.activationDate) pStart = new Date(b.activationDate);
  if (!pStart || isNaN(pStart.getTime())) return false;

  const rawEnd =
    mode === 'PREAVISO_PASO_11'
      ? b.fechaPrevistaBaja || b.terminationDate
      : b.terminationDate || b.fechaPrevistaBaja;
  if (!rawEnd) return false;
  const bDate = new Date(rawEnd);
  if (isNaN(bDate.getTime()) || bDate <= pStart) return false;

  if (b.expectedEndDate) {
    const expEnd = new Date(b.expectedEndDate);
    if (!isNaN(expEnd.getTime()) && bDate <= expEnd) {
      const diffDays = Math.ceil((expEnd.getTime() - bDate.getTime()) / MS_PER_DAY);
      if (diffDays > 0 && diffDays <= 30) return true;
    }
  }

  // Find the active permanence/renewal cycle end on or immediately after bDate
  let cycle = 1;
  while (cycle <= 25) {
    const cycleEnd = new Date(pStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + pMonths * cycle);
    if (cycleEnd >= bDate) {
      const diffDays = Math.ceil((cycleEnd.getTime() - bDate.getTime()) / MS_PER_DAY);
      return diffDays > 0 && diffDays <= 30;
    }
    cycle++;
  }

  return false;
}

/**
 * Computes both:
 * 1) Real confirmed churns (`confirmadasIds`) merging renewals within 30 days on the 20-char physical CUPS root,
 *    plus continuous client lifespan days (`continuousSpanDaysByContractId`) per 20-char CUPS.
 * 2) Active contracts with scheduled Paso 11 termination (`preavisoIds`: status = 'ACTIVO' and fechaPrevistaBaja != null).
 */
export async function computeBajasUniverse(visibilityFilter: any) {
  const allContracts = await prisma.contract.findMany({
    where: {
      ...visibilityFilter,
      status: { in: ['ACTIVO', 'BAJA', 'FINALIZADO'] },
    },
    select: {
      id: true,
      status: true,
      activationDate: true,
      terminationDate: true,
      permanenceStartDate: true,
      fechaPrevistaBaja: true,
      createdAt: true,
      supplyPoint: { select: { cups: true } },
    },
  });

  const preavisoIds: string[] = [];
  const contractsByCups20: Record<
    string,
    Array<(typeof allContracts)[0] & { _effActDate: Date; _cupsRoot: string }>
  > = {};

  for (const c of allContracts) {
    if (c.status === 'ACTIVO' && c.fechaPrevistaBaja && !c.terminationDate) {
      preavisoIds.push(c.id);
    }

    const cupsRoot = normalizeCupsRoot(c.supplyPoint?.cups);
    if (!cupsRoot) continue;
    const effActDate = c.activationDate || c.permanenceStartDate || c.createdAt;
    if (!effActDate) continue;

    if (!contractsByCups20[cupsRoot]) contractsByCups20[cupsRoot] = [];
    contractsByCups20[cupsRoot].push({ ...c, _effActDate: effActDate, _cupsRoot: cupsRoot });
  }

  const confirmadasIds: string[] = [];
  const continuousSpanDaysByContractId: Record<string, { cupsRoot: string; spanDays: number }> = {};

  for (const [cupsRoot, cupsContracts] of Object.entries(contractsByCups20)) {
    cupsContracts.sort((a, b) => a._effActDate.getTime() - b._effActDate.getTime());

    let currentPeriod: {
      start: Date;
      end: Date | null;
      endContractId: string | null;
    } | null = null;

    for (const c of cupsContracts) {
      if (!currentPeriod) {
        currentPeriod = {
          start: c._effActDate,
          end: c.terminationDate || null,
          endContractId: c.id,
        };
        continue;
      }

      const startNext = c._effActDate;
      if (currentPeriod.end === null) {
        // Already open (active supply on this 20-char CUPS), stays open
      } else if (startNext.getTime() <= currentPeriod.end.getTime() + GRACE_PERIOD_MS) {
        // Merged continuous period (renewal / version / brand continuation within 30 days)
        if (!c.terminationDate) {
          currentPeriod.end = null;
          currentPeriod.endContractId = c.id;
        } else if (c.terminationDate.getTime() > currentPeriod.end.getTime()) {
          currentPeriod.end = c.terminationDate;
          currentPeriod.endContractId = c.id;
        }
      } else {
        // Gap > 30 days -> previous period was a confirmed churn
        if (currentPeriod.endContractId && currentPeriod.end) {
          confirmadasIds.push(currentPeriod.endContractId);
          const spanDays = Math.max(
            0,
            Math.ceil(Math.abs(currentPeriod.end.getTime() - currentPeriod.start.getTime()) / MS_PER_DAY)
          );
          continuousSpanDaysByContractId[currentPeriod.endContractId] = { cupsRoot, spanDays };
        }
        currentPeriod = {
          start: c._effActDate,
          end: c.terminationDate || null,
          endContractId: c.id,
        };
      }
    }

    if (currentPeriod && currentPeriod.end !== null && currentPeriod.endContractId) {
      confirmadasIds.push(currentPeriod.endContractId);
      const spanDays = Math.max(
        0,
        Math.ceil(Math.abs(currentPeriod.end.getTime() - currentPeriod.start.getTime()) / MS_PER_DAY)
      );
      continuousSpanDaysByContractId[currentPeriod.endContractId] = { cupsRoot, spanDays };
    }
  }

  return {
    confirmadasIds,
    preavisoIds,
    continuousSpanDaysByContractId,
  };
}

export async function queryBajasDataset(filters: BajasQueryFilters) {
  const ctx = await getBajasSessionContext();
  const { visibilityFilter, isBackofficeOrAdmin } = ctx;

  const tab: BajasTabMode = filters.tab === 'PREAVISO_PASO_11' ? 'PREAVISO_PASO_11' : 'CONFIRMADAS';
  const page = Math.max(1, Number(filters.page) || 1);
  const itemsPerPage = Math.max(1, Math.min(2000, Number(filters.itemsPerPage) || 100));
  const search = (filters.search || '').trim();
  const canalFilter = filters.canalFilter || 'TODOS';
  const origenBajaFilter = Array.isArray(filters.origenBajaFilter) ? filters.origenBajaFilter : [];
  const tarifaFilter = Array.isArray(filters.tarifaFilter) ? filters.tarifaFilter : [];
  const penaltyFilter = isBackofficeOrAdmin ? filters.penaltyFilter || 'TODOS' : 'TODOS';
  const winbackFilter = filters.winbackFilter || 'TODOS';

  const universe = await computeBajasUniverse(visibilityFilter);
  const targetIds = tab === 'PREAVISO_PASO_11' ? universe.preavisoIds : universe.confirmadasIds;

  const scopedIds =
    Array.isArray(filters.selectedIds) && filters.selectedIds.length > 0
      ? targetIds.filter((id) => filters.selectedIds!.includes(id))
      : targetIds;

  const andConditions: any[] = [visibilityFilter, { id: { in: scopedIds } }];

  if (search) {
    andConditions.push({
      OR: [
        { contractCode: { contains: search, mode: 'insensitive' } },
        { supplyPoint: { cups: { contains: search, mode: 'insensitive' } } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } },
        { client: { firstName: { contains: search, mode: 'insensitive' } } },
        { client: { lastName: { contains: search, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  if (canalFilter && canalFilter !== 'TODOS') {
    andConditions.push({ user: { channelId: canalFilter } });
  }

  if (tarifaFilter.length > 0) {
    const includeNoTariff = tarifaFilter.includes('Sin tarifa');
    const validTariffs = tarifaFilter.filter((t) => t !== 'Sin tarifa');
    if (includeNoTariff && validTariffs.length > 0) {
      andConditions.push({
        OR: [
          { supplyPoint: { tariff: { in: validTariffs } } },
          { supplyPoint: { tariff: '' } },
        ],
      });
    } else if (validTariffs.length > 0) {
      andConditions.push({ supplyPoint: { tariff: { in: validTariffs } } });
    } else if (includeNoTariff) {
      andConditions.push({ supplyPoint: { tariff: '' } });
    }
  }

  if (origenBajaFilter.length > 0) {
    if (origenBajaFilter.includes('Sin origen')) {
      const otherOrigins = origenBajaFilter.filter((o) => o !== 'Sin origen');
      const processOr: any[] = [{ bajaProcess: null }, { bajaProcess: '' }];
      if (otherOrigins.length > 0) {
        processOr.push({ bajaProcess: { in: otherOrigins } });
      }
      andConditions.push({ OR: processOr });
    } else {
      andConditions.push({ bajaProcess: { in: origenBajaFilter } });
    }
  }

  if (winbackFilter && winbackFilter !== 'TODOS') {
    if (winbackFilter === 'SIN_GESTION') {
      andConditions.push({ OR: [{ winbackStatus: null }, { winbackStatus: '' }] });
    } else {
      andConditions.push({ winbackStatus: winbackFilter });
    }
  }

  const dateField = tab === 'PREAVISO_PASO_11' ? 'fechaPrevistaBaja' : 'terminationDate';
  if (filters.dateFrom || filters.dateTo) {
    const range: any = {};
    if (filters.dateFrom) range.gte = parseMadridStartOfDay(filters.dateFrom);
    if (filters.dateTo) range.lte = parseMadridEndOfDay(filters.dateTo);
    andConditions.push({ [dateField]: range });
  }

  const whereClause = { AND: andConditions };

  // Fetch lightweight rows for exact penalty filtering, sorting & synchronized KPIs
  const lightweightRows = await prisma.contract.findMany({
    where: whereClause,
    select: {
      id: true,
      activationDate: true,
      permanenceStartDate: true,
      expectedEndDate: true,
      terminationDate: true,
      fechaPrevistaBaja: true,
      permanenceMonths: true,
      annualConsumption: true,
      p1e: true,
      p2e: true,
      p3e: true,
      p4e: true,
      p5e: true,
      p6e: true,
      airtableData: true,
      calculatedPenalty: true,
      penalization: true,
      penaltyStatus: true,
      product: {
        select: {
          permanenceMonths: true,
          p1e: true,
          p2e: true,
          p3e: true,
          p4e: true,
          p5e: true,
          p6e: true,
        },
      },
      supplyPoint: {
        select: {
          cups: true,
          tariff: true,
          annualConsumption: true,
          cnae: true,
        },
      },
      client: {
        select: {
          vatNumber: true,
        },
      },
    },
    orderBy:
      tab === 'PREAVISO_PASO_11'
        ? [{ fechaPrevistaBaja: 'asc' }, { createdAt: 'desc' }]
        : [{ terminationDate: 'desc' }, { createdAt: 'desc' }],
  });

  // Apply penaltyFilter accurately using resolved penalty status & calculated amount
  const matchedRows = lightweightRows.filter((row) => {
    if (!penaltyFilter || penaltyFilter === 'TODOS') return true;
    const st = row.penaltyStatus || 'PENDIENTE';
    const eff = resolveEffectivePenalty(row, tab);
    if (penaltyFilter === 'PENDIENTE_CON_IMPORTE') return st === 'PENDIENTE' && eff > 0;
    if (penaltyFilter === 'PENDIENTE') return st === 'PENDIENTE';
    if (penaltyFilter === 'FACTURADA') return st === 'FACTURADA';
    if (penaltyFilter === 'DESCARTADA') return st === 'DESCARTADA';
    if (penaltyFilter === 'SIN_PENALIZACION') return eff <= 0 || st === 'DESCARTADA';
    return true;
  });

  // Compute synchronized KPIs over all matched rows
  const now = new Date();
  let bajasEsteMes = 0;
  let totalMwhPerdido = 0;
  let totalDiasContrato = 0;
  let totalPenaltySum = 0;
  let pendingPenaltyCount = 0;
  const uniqueCupsLifespan: Record<string, number> = {};

  for (const r of matchedRows) {
    const mwh = Number(r.annualConsumption ?? r.supplyPoint?.annualConsumption ?? 0) || 0;
    totalMwhPerdido += mwh;

    const dAlta = r.activationDate || r.permanenceStartDate || now;
    const dRefEnd = (tab === 'PREAVISO_PASO_11' ? r.fechaPrevistaBaja : r.terminationDate) || now;
    const diasContrato = Math.max(0, Math.ceil(Math.abs(dRefEnd.getTime() - dAlta.getTime()) / MS_PER_DAY));
    totalDiasContrato += diasContrato;

    const spanInfo = universe.continuousSpanDaysByContractId[r.id];
    const cupsRoot = spanInfo?.cupsRoot || normalizeCupsRoot(r.supplyPoint?.cups) || r.id;
    const spanDays = spanInfo ? spanInfo.spanDays : diasContrato;
    if (uniqueCupsLifespan[cupsRoot] === undefined || spanDays > uniqueCupsLifespan[cupsRoot]) {
      uniqueCupsLifespan[cupsRoot] = spanDays;
    }

    if (isSameMadridMonth(dRefEnd, now)) {
      bajasEsteMes++;
    }

    const effPen = resolveEffectivePenalty(r, tab);
    totalPenaltySum += effPen;
    if ((r.penaltyStatus || 'PENDIENTE') === 'PENDIENTE' && effPen > 0) {
      pendingPenaltyCount++;
    }
  }

  const totalCount = matchedRows.length;
  const cupsLifespanValues = Object.values(uniqueCupsLifespan);
  const avgDias = totalCount > 0 ? Math.round(totalDiasContrato / totalCount) : 0;
  const avgClientDias =
    cupsLifespanValues.length > 0
      ? Math.round(cupsLifespanValues.reduce((a, b) => a + b, 0) / cupsLifespanValues.length)
      : 0;

  const stats: BajasStatsSummary = {
    totalBajas: totalCount,
    bajasEsteMes,
    totalMwhPerdido: round2(totalMwhPerdido),
    avgDias,
    avgClientDias,
    totalPenaltySum: round2(totalPenaltySum),
    pendingPenaltyCount,
  };

  // Paginate (or take all for export)
  const pageIds = filters.exportAll
    ? matchedRows.map((r) => r.id)
    : matchedRows.slice((page - 1) * itemsPerPage, page * itemsPerPage).map((r) => r.id);

  let pageContracts: any[] = [];
  if (pageIds.length > 0) {
    const unordered = await prisma.contract.findMany({
      where: { id: { in: pageIds } },
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        brand: { include: { company: true } },
        user: { include: { channel: true } },
        Lead: true,
        penaltyInvoices: {
          where: { invoiceType: 'PENALIZACION' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, invoiceNumber: true, pdfUrl: true, status: true, paymentStatus: true },
        },
      },
    });
    const mapById = new Map(unordered.map((c) => [c.id, c]));
    pageContracts = pageIds.map((id) => mapById.get(id)).filter(Boolean);
  }

  const nowMadrid = toZonedTime(now, MADRID_TZ);

  const bajas = pageContracts.map((b: any) => {
    const airtable = (b.airtableData as any) || {};
    let pStart: Date | null = b.permanenceStartDate ? new Date(b.permanenceStartDate) : null;
    if (!pStart && airtable['INICIO_PERMANENCIA']) {
      const parsed = new Date(airtable['INICIO_PERMANENCIA']);
      if (!isNaN(parsed.getTime())) pStart = parsed;
    }

    const dAlta = b.activationDate ? new Date(b.activationDate) : pStart || new Date();
    const rawBajaDate = tab === 'PREAVISO_PASO_11' ? b.fechaPrevistaBaja : b.terminationDate;
    const dBaja = rawBajaDate ? new Date(rawBajaDate) : new Date();
    const diffDays = Math.max(0, Math.ceil(Math.abs(dBaja.getTime() - dAlta.getTime()) / MS_PER_DAY));

    let diasHastaBaja: number | null = null;
    if (tab === 'PREAVISO_PASO_11' && b.fechaPrevistaBaja) {
      const zPrev = toZonedTime(new Date(b.fechaPrevistaBaja), MADRID_TZ);
      diasHastaBaja = Math.ceil((zPrev.getTime() - nowMadrid.getTime()) / MS_PER_DAY);
    }

    const calcPen = resolveCalculatedPenalty(b, tab);
    const isPreavisoBreached = computeIsPreavisoBreached(b, tab);
    const latestPenaltyInvoice = b.penaltyInvoices?.[0] || null;

    const fullAddress = [
      b.supplyPoint?.address,
      b.supplyPoint?.postalCode,
      b.supplyPoint?.city,
      b.supplyPoint?.province ? `(${b.supplyPoint.province})` : null,
    ]
      .filter(Boolean)
      .join(', ');

    const row: any = {
      id: b.id,
      tabMode: tab,
      contractCode: b.contractCode || 'S/N',
      cups: b.supplyPoint?.cups || 'Desconocido',
      cupsRoot: normalizeCupsRoot(b.supplyPoint?.cups),
      cliente:
        b.client?.businessName ||
        `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim() ||
        'Desconocido',
      clientId: b.clientId,
      vatNumber: b.client?.vatNumber || '',
      telefono: b.client?.contactPhone || null,
      email: b.client?.contactEmail || b.client?.invoiceEmail || null,
      invoiceEmail: b.client?.invoiceEmail || null,
      address: fullAddress,
      tarifa: b.supplyPoint?.tariff || 'Sin tarifa',
      mwh: round2(Number(b.annualConsumption ?? b.supplyPoint?.annualConsumption ?? 0) || 0),
      p1c: b.p1c ?? b.supplyPoint?.p1c ?? null,
      p2c: b.p2c ?? b.supplyPoint?.p2c ?? null,
      p3c: b.p3c ?? b.supplyPoint?.p3c ?? null,
      p4c: b.p4c ?? b.supplyPoint?.p4c ?? null,
      p5c: b.p5c ?? b.supplyPoint?.p5c ?? null,
      p6c: b.p6c ?? b.supplyPoint?.p6c ?? null,
      fechaAlta: formatDateIsoMadrid(pStart || b.activationDate),
      fechaBaja: formatDateIsoMadrid(rawBajaDate),
      diasHastaBaja,
      motivo: tab === 'PREAVISO_PASO_11' ? 'Solicitud ATR Paso 11' : 'Baja confirmada',
      canal: b.user?.channel?.name || b.Lead?.source || 'Directo',
      comercial: b.user?.name || '-',
      producto: b.product?.name || 'Desconocido',
      permanenceMonths: resolvePermanenceMonths(b),
      diasVida: diffDays,
      hasSelfConsumption: Boolean(b.autoconsumo ?? b.supplyPoint?.hasSelfConsumption),
      bajaProcess: b.bajaProcess || null,
      isPreavisoBreached,
      // Brand metadata for multi-brand Winback PDFs & emails
      brandId: b.brandId || b.client?.brandId || null,
      brandName: b.brand?.name || 'AED Energía',
      brandCode: b.brand?.codigoMarca || b.brand?.slug?.toUpperCase() || 'AED',
      brandEmail: b.brand?.supportEmail || b.brand?.email || 'clientes@aed-energia.com',
      brandPhone: b.brand?.phone || '900 525 826',
      brandDomain: b.brand?.domain || 'aed-energia.com',
      brandAddress: b.brand?.company?.address || b.brand?.address || '',
      // Winback CRM tracking
      winbackStatus: b.winbackStatus || null,
      winbackNotes: b.winbackNotes || null,
      winbackLastContactAt: b.winbackLastContactAt ? b.winbackLastContactAt.toISOString() : null,
      winbackProductOffered: b.winbackProductOffered || null,
    };

    // Strict confidentiality: never expose penalty figures or invoices to COMERCIAL / CANAL
    if (isBackofficeOrAdmin) {
      row.calculatedPenalty = calcPen;
      row.penalization = b.penalization !== null && b.penalization !== undefined ? round2(b.penalization) : null;
      row.penaltyStatus = b.penaltyStatus || 'PENDIENTE';
      row.penaltyInvoiceNumber = latestPenaltyInvoice?.invoiceNumber || null;
      row.penaltyInvoicePdfUrl = latestPenaltyInvoice?.pdfUrl || null;
    }

    return row;
  });

  return {
    isBackofficeOrAdmin,
    tab,
    bajas,
    totalCount,
    confirmadasCount: universe.confirmadasIds.length,
    preavisoCount: universe.preavisoIds.length,
    totalPenaltySum: isBackofficeOrAdmin ? stats.totalPenaltySum : 0,
    stats: isBackofficeOrAdmin ? stats : null,
  };
}

/**
 * Generates and uploads a PenaltyInvoice PDF (single or multipoint) and persists PenaltyInvoice record(s)
 * using per-company sequential numbering `A{YY}PEN{NNN}` with automatic retry on P2002 collision.
 */
export async function issuePenaltyInvoicesForContracts(
  contractsWithAmounts: Array<{
    contract: any;
    baseAmount: number;
  }>,
  options?: { groupMultipointSinglePdf?: boolean }
): Promise<{ createdCount: number; invoiceNumbers: string[] }> {
  const validItems = contractsWithAmounts.filter((item) => round2(item.baseAmount) > 0);
  if (validItems.length === 0) {
    return { createdCount: 0, invoiceNumbers: [] };
  }

  const now = new Date();
  const fullYear = now.getFullYear();
  const yy = String(fullYear).slice(-2);
  const issueDateFormatted = toZonedTime(now, MADRID_TZ).toLocaleDateString('es-ES');

  const renderPdfBuffer = async (pdfData: PenaltyInvoicePDFData): Promise<Buffer> => {
    const stream = await renderToStream(
      React.createElement(PenaltyInvoicePDF, { data: pdfData }) as any
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  };

  const getNextRootSequenceForCompany = async (companyId: string | null): Promise<number> => {
    const prefix = `A${yy}PEN`;
    const existing = await prisma.penaltyInvoice.findMany({
      where: {
        invoiceNumber: { startsWith: prefix },
        ...(companyId ? { companyId } : {}),
      },
      select: { invoiceNumber: true },
    });
    let maxNum = 0;
    for (const inv of existing) {
      const m = inv.invoiceNumber.match(/PEN(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return maxNum + 1;
  };

  const createdInvoiceNumbers: string[] = [];

  // Group by (companyId + clientId) when groupMultipointSinglePdf === true and > 1 contract for same client
  if (options?.groupMultipointSinglePdf && validItems.length > 1) {
    const groups = new Map<string, typeof validItems>();
    for (const item of validItems) {
      const companyId = item.contract.brand?.companyId || '';
      const key = `${companyId}::${item.contract.client.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    for (const [, groupItems] of groups.entries()) {
      if (groupItems.length === 1) {
        const singleRes = await issuePenaltyInvoicesForContracts(groupItems, {
          groupMultipointSinglePdf: false,
        });
        createdInvoiceNumbers.push(...singleRes.invoiceNumbers);
        continue;
      }

      const first = groupItems[0].contract;
      const companyId: string | null = first.brand?.companyId || null;

      let attempt = 0;
      while (attempt < 4) {
        attempt++;
        const seq = await getNextRootSequenceForCompany(companyId);
        const rootNumber = `A${yy}PEN${String(seq).padStart(3, '0')}`;

        const lines: PenaltyInvoicePDFLine[] = groupItems.map(({ contract, baseAmount }) => {
          const detail = calculatePenaltyDetailed(contract, 'CONFIRMADAS');
          return {
            cups: contract.supplyPoint.cups,
            contractCode: contract.contractCode || null,
            baseAmount: round2(baseAmount),
            dailyConsumption: detail.dailyConsumption,
            daysRemaining: detail.daysRemaining,
          };
        });

        const sumBase = round2(lines.reduce((acc, l) => acc + l.baseAmount, 0));
        const sumTax = round2(sumBase * 0.21);
        const sumTotal = round2(sumBase + sumTax);

        const pdfData: PenaltyInvoicePDFData = {
          invoiceNumber: rootNumber,
          issueDate: issueDateFormatted,
          baseAmount: sumBase,
          taxAmount: sumTax,
          totalAmount: sumTotal,
          brandName: first.brand.company?.name || first.brand.name,
          brandVat: first.brand.company?.cif || '',
          brandAddress: first.brand.company?.address || first.brand.address || '',
          brandLogo: first.brand.invoiceLogoUrl || first.brand.logoUrl || null,
          clientName: first.client.businessName,
          clientVat: first.client.vatNumber,
          clientAddress: first.client.billingAddress || first.supplyPoint.address,
          clientCity: first.client.billingCity || first.supplyPoint.city,
          clientPostalCode: first.client.billingPostalCode || first.supplyPoint.postalCode,
          lines,
          banks: [
            { name: first.brand.bankName1, iban: first.brand.bankIban1 },
            { name: first.brand.bankName2, iban: first.brand.bankIban2 },
            { name: first.brand.bankName3, iban: first.brand.bankIban3 },
          ].filter((b) => b.name && b.iban),
        };

        const pdfBuffer = await renderPdfBuffer(pdfData);
        const fileName = `penalizaciones/${fullYear}/${rootNumber}.pdf`;
        const pdfUrl = await uploadFileToR2(fileName, pdfBuffer, 'application/pdf');

        try {
          await prisma.$transaction(
            groupItems.map(({ contract, baseAmount }, idx) => {
              const subInvoiceNumber = `${rootNumber}-${idx + 1}`;
              const bAmt = round2(baseAmount);
              const tAmt = round2(bAmt * 0.21);
              const totAmt = round2(bAmt + tAmt);
              return prisma.penaltyInvoice.create({
                data: {
                  invoiceNumber: subInvoiceNumber,
                  invoiceType: 'PENALIZACION',
                  baseAmount: bAmt,
                  taxAmount: tAmt,
                  amount: totAmt,
                  issueDate: now,
                  pdfUrl,
                  companyId,
                  contractId: contract.id,
                  clientId: contract.client.id,
                  supplyPointId: contract.supplyPoint.id,
                  status: 'EMITIDA',
                  paymentStatus: 'PENDIENTE',
                },
              });
            })
          );

          await prisma.$transaction(
            groupItems.map(({ contract, baseAmount }) =>
              prisma.contract.update({
                where: { id: contract.id },
                data: {
                  penalization: round2(baseAmount),
                  penaltyStatus: 'FACTURADA',
                },
              })
            )
          );

          groupItems.forEach((_, idx) => createdInvoiceNumbers.push(`${rootNumber}-${idx + 1}`));
          break;
        } catch (err: any) {
          if (err?.code === 'P2002' && attempt < 4) {
            continue;
          }
          throw err;
        }
      }
    }

    return { createdCount: createdInvoiceNumbers.length, invoiceNumbers: createdInvoiceNumbers };
  }

  // Standard 1-invoice-per-contract mode
  for (const { contract, baseAmount } of validItems) {
    const companyId: string | null = contract.brand?.companyId || null;
    const bAmt = round2(baseAmount);
    const tAmt = round2(bAmt * 0.21);
    const totAmt = round2(bAmt + tAmt);
    const detail = calculatePenaltyDetailed(contract, 'CONFIRMADAS');

    let attempt = 0;
    while (attempt < 4) {
      attempt++;
      const seq = await getNextRootSequenceForCompany(companyId);
      const invoiceNumber = `A${yy}PEN${String(seq).padStart(3, '0')}`;

      const pdfData: PenaltyInvoicePDFData = {
        invoiceNumber,
        issueDate: issueDateFormatted,
        baseAmount: bAmt,
        taxAmount: tAmt,
        totalAmount: totAmt,
        brandName: contract.brand.company?.name || contract.brand.name,
        brandVat: contract.brand.company?.cif || '',
        brandAddress: contract.brand.company?.address || contract.brand.address || '',
        brandLogo: contract.brand.invoiceLogoUrl || contract.brand.logoUrl || null,
        clientName: contract.client.businessName,
        clientVat: contract.client.vatNumber,
        clientAddress: contract.client.billingAddress || contract.supplyPoint.address,
        clientCity: contract.client.billingCity || contract.supplyPoint.city,
        clientPostalCode: contract.client.billingPostalCode || contract.supplyPoint.postalCode,
        cups: contract.supplyPoint.cups,
        contractCode: contract.contractCode || null,
        dailyConsumption: detail.dailyConsumption,
        daysRemaining: detail.daysRemaining,
        banks: [
          { name: contract.brand.bankName1, iban: contract.brand.bankIban1 },
          { name: contract.brand.bankName2, iban: contract.brand.bankIban2 },
          { name: contract.brand.bankName3, iban: contract.brand.bankIban3 },
        ].filter((b) => b.name && b.iban),
      };

      const pdfBuffer = await renderPdfBuffer(pdfData);
      const fileName = `penalizaciones/${fullYear}/${invoiceNumber}.pdf`;
      const pdfUrl = await uploadFileToR2(fileName, pdfBuffer, 'application/pdf');

      try {
        await prisma.$transaction([
          prisma.penaltyInvoice.create({
            data: {
              invoiceNumber,
              invoiceType: 'PENALIZACION',
              baseAmount: bAmt,
              taxAmount: tAmt,
              amount: totAmt,
              issueDate: now,
              pdfUrl,
              companyId,
              contractId: contract.id,
              clientId: contract.client.id,
              supplyPointId: contract.supplyPoint.id,
              status: 'EMITIDA',
              paymentStatus: 'PENDIENTE',
            },
          }),
          prisma.contract.update({
            where: { id: contract.id },
            data: {
              penalization: bAmt,
              penaltyStatus: 'FACTURADA',
            },
          }),
        ]);

        createdInvoiceNumbers.push(invoiceNumber);
        break;
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < 4) {
          continue;
        }
        throw err;
      }
    }
  }

  return { createdCount: createdInvoiceNumbers.length, invoiceNumbers: createdInvoiceNumbers };
}
