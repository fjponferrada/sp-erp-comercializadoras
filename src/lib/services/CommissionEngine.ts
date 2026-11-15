import { prisma } from '@/lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

const madridDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Convierte cualquier Date o string ISO a formato 'YYYY-MM-DD' en zona horaria Europe/Madrid (Regla 112).
 */
export function toMadridYmd(dateInput: Date | string): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return madridDateFormatter.format(d);
}

/**
 * Convierte un Date o 'YYYY-MM-DD' al timestamp UTC exacto de medianoche de ese día calendario en Madrid,
 * eliminando cualquier desviación de 23h/25h por cambios de hora DST o diferencias T22:00Z vs T00:00Z.
 */
export function toMadridDayUtcMs(dateInput: Date | string): number {
  const ymd = toMadridYmd(dateInput);
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function parseNullableFloat(val: any): number | null {
  if (val === null || val === undefined) return null;
  const raw = Array.isArray(val) ? val[0] : val;
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrae los snapshots inmutables de márgenes y fee para almacenar en Contract al crearlo o rehacerlo.
 * Nunca usa truthy `||` sobre números para preservar valores legítimos como 0 o márgenes negativos.
 */
export function extractContractMarginSnapshots(
  cData: any,
  product: any,
  fallbackProductType?: string | null
) {
  const cd = cData && typeof cData === 'object' ? cData : {};

  const customFee =
    parseNullableFloat(cd.indexado?.fee) ??
    parseNullableFloat(cd.feeIndex) ??
    parseNullableFloat(cd['FEE']) ??
    parseNullableFloat(cd['Fee Index']) ??
    parseNullableFloat(cd['Fee Index (from Producto)']);

  const resolvedFee = customFee ?? parseNullableFloat(product?.fee);
  const productTypeSnapshot: string | null = product?.type || fallbackProductType || null;

  const isCustomIndexado =
    Boolean(product?.isCustomizable) ||
    (productTypeSnapshot || '').toLowerCase().includes('personalizado') ||
    customFee !== null;

  let marginFC: number | null = null;
  if (parseNullableFloat(cd.marginFC) !== null) {
    marginFC = parseNullableFloat(cd.marginFC);
  } else if (isCustomIndexado && resolvedFee !== null) {
    marginFC = resolvedFee;
  } else if (parseNullableFloat(product?.marginFC) !== null) {
    marginFC = parseNullableFloat(product?.marginFC);
  } else {
    marginFC = resolvedFee;
  }

  const resolveIp = (idx: number): number | null => {
    return (
      parseNullableFloat(cd.indexado?.[`ip${idx}`]) ??
      parseNullableFloat(cd[`ip${idx}`]) ??
      parseNullableFloat(cd[`IP${idx}`]) ??
      parseNullableFloat(product?.[`ip${idx}`])
    );
  };

  return {
    fee: resolvedFee,
    marginFC,
    ip1: resolveIp(1),
    ip2: resolveIp(2),
    ip3: resolveIp(3),
    ip4: resolveIp(4),
    ip5: resolveIp(5),
    ip6: resolveIp(6),
    productTypeSnapshot,
  };
}

export function getContractTarifa(c: any): string {
  if (c.supplyPoint?.tariff) return c.supplyPoint.tariff;
  if (c.product?.tariff) return c.product.tariff;
  if (c.airtableData && typeof c.airtableData === 'object') {
    const ad = c.airtableData;
    const raw = ad['Tarifa'] || ad['tarifa'] || ad['Tarifa (from Producto)'];
    if (Array.isArray(raw) && raw.length > 0) return String(raw[0]);
    if (raw) return String(raw);
  }
  return '-';
}

export function getContractConsumoMWh(c: any): number {
  if (c.annualConsumption !== null && c.annualConsumption !== undefined) {
    return Number(c.annualConsumption) || 0;
  }
  if (c.supplyPoint?.annualConsumption !== null && c.supplyPoint?.annualConsumption !== undefined) {
    return Number(c.supplyPoint.annualConsumption) || 0;
  }
  if (c.airtableData && typeof c.airtableData === 'object') {
    const ad = c.airtableData;
    if (ad['CONSUMO COMISION'] !== undefined) return Number(ad['CONSUMO COMISION']) || 0;
    if (ad['CONSUMO ANUAL'] !== undefined) return Number(ad['CONSUMO ANUAL']) || 0;
  }
  return 0;
}

export function getContractPotencias(c: any): [number, number, number, number, number, number] {
  const getPx = (field: string, airtableField: string): number => {
    if (c[field] !== null && c[field] !== undefined) return Number(c[field]) || 0;
    if (c.supplyPoint?.[field] !== null && c.supplyPoint?.[field] !== undefined) {
      return Number(c.supplyPoint[field]) || 0;
    }
    if (c.airtableData && typeof c.airtableData === 'object' && c.airtableData[airtableField] !== undefined) {
      return parseNullableFloat(c.airtableData[airtableField]) ?? 0;
    }
    return 0;
  };
  return [
    getPx('p1c', 'P1'),
    getPx('p2c', 'P2'),
    getPx('p3c', 'P3'),
    getPx('p4c', 'P4'),
    getPx('p5c', 'P5'),
    getPx('p6c', 'P6'),
  ];
}

export function getSnapshotMarginFC(c: any): number {
  if (c.marginFC !== null && c.marginFC !== undefined) return Number(c.marginFC);
  if (c.product?.marginFC !== null && c.product?.marginFC !== undefined) return Number(c.product.marginFC);
  if (c.fee !== null && c.fee !== undefined) return Number(c.fee);
  return 0;
}

export function getSnapshotPotenciaMargins(c: any): [number, number, number, number, number, number] {
  const getIp = (idx: number): number => {
    const k = `ip${idx}`;
    if (c[k] !== null && c[k] !== undefined) return Number(c[k]);
    if (c.product?.[k] !== null && c.product?.[k] !== undefined) return Number(c.product[k]);
    return 0;
  };
  return [getIp(1), getIp(2), getIp(3), getIp(4), getIp(5), getIp(6)];
}

export function getSnapshotProductType(c: any): string {
  return c.productTypeSnapshot || c.product?.type || '';
}

/**
 * Selecciona la regla de comisión principal con mayor especificidad dentro del Nivel del canal.
 */
export function matchBestCommissionRule(
  tierRules: any[],
  params: {
    tarifa: string;
    productType: string;
    productId: string | null | undefined;
    avgPower: number;
  }
) {
  let matchedRule: any = null;
  let bestSpecificity = -1;

  for (const rule of tierRules) {
    const svcCount = rule.additionalServices?.length || 0;
    const prodCount = rule.products?.length || 0;

    // Ignorar reglas que sean exclusivamente para servicios adicionales
    if (svcCount > 0 && prodCount === 0 && !rule.tariff && !rule.productType) {
      continue;
    }

    let specificity = 0;
    let match = true;

    if (rule.tariff) {
      if (rule.tariff !== params.tarifa) match = false;
      else specificity += 1;
    }

    if (rule.productType) {
      const rType = rule.productType;
      const pTypeLower = (params.productType || '').toLowerCase();

      if (rType === 'Fijo') {
        if (!pTypeLower.includes('fijo')) match = false;
        else specificity += 1;
      } else if (rType === 'Indexado' || rType === 'Index') {
        if (!pTypeLower.includes('indexado')) match = false;
        else specificity += 1;
      } else {
        if (rType !== params.productType) match = false;
        else specificity += 2;
      }
    }

    if (rule.powerMin !== null && rule.powerMin !== undefined) {
      if (params.avgPower < rule.powerMin) match = false;
      else specificity += 1;
    }

    if (rule.powerMax !== null && rule.powerMax !== undefined) {
      if (params.avgPower >= rule.powerMax) match = false;
      else specificity += 1;
    }

    if (prodCount > 0) {
      if (!params.productId || !rule.products.some((rp: any) => rp.id === params.productId)) {
        match = false;
      } else {
        specificity += 100;
      }
    }

    if (match && specificity > bestSpecificity) {
      matchedRule = rule;
      bestSpecificity = specificity;
    }
  }

  return matchedRule;
}

/**
 * Selecciona la regla más específica aplicable a un Servicio Adicional concreto.
 */
export function matchBestServiceRule(
  tierRules: any[],
  serviceId: string,
  params: {
    tarifa: string;
    productType: string;
    productId: string | null | undefined;
    avgPower: number;
  }
) {
  let matchedRule: any = null;
  let bestSpecificity = -1;

  for (const rule of tierRules) {
    if (!rule.additionalServices?.some((as: any) => as.id === serviceId)) continue;

    let specificity = 50; // Base por coincidir con el servicio
    let match = true;

    if (rule.tariff) {
      if (rule.tariff !== params.tarifa) match = false;
      else specificity += 1;
    }

    if (rule.productType) {
      const rType = rule.productType;
      const pTypeLower = (params.productType || '').toLowerCase();
      if (rType === 'Fijo') {
        if (!pTypeLower.includes('fijo')) match = false;
        else specificity += 1;
      } else if (rType === 'Indexado' || rType === 'Index') {
        if (!pTypeLower.includes('indexado')) match = false;
        else specificity += 1;
      } else {
        if (rType !== params.productType) match = false;
        else specificity += 2;
      }
    }

    if (rule.powerMin !== null && rule.powerMin !== undefined) {
      if (params.avgPower < rule.powerMin) match = false;
      else specificity += 1;
    }

    if (rule.powerMax !== null && rule.powerMax !== undefined) {
      if (params.avgPower >= rule.powerMax) match = false;
      else specificity += 1;
    }

    if (rule.products?.length > 0) {
      if (!params.productId || !rule.products.some((rp: any) => rp.id === params.productId)) {
        match = false;
      } else {
        specificity += 100;
      }
    }

    if (match && specificity > bestSpecificity) {
      matchedRule = rule;
      bestSpecificity = specificity;
    }
  }

  return matchedRule;
}

/**
 * Calcula la comisión anual (horizonte fijo de 12 meses / 365 días, independiente de la permanencia del cliente)
 * usando los snapshots inmutables del contrato y persiste el resultado + snapshot de regla en Contract.
 */
export async function calculateAndSnapshotContractCommission(
  contractId: string,
  options?: {
    onlyIfEmpty?: boolean;
    preloadedRulesByTier?: Map<string, any[]>;
  }
): Promise<{ success: boolean; commissionFinal?: number; error?: string }> {
  const c = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      product: true,
      supplyPoint: true,
      Lead: { select: { contractData: true, productType: true } },
      user: { include: { channel: true } },
    },
  });

  if (!c) {
    return { success: false, error: 'Contrato no encontrado.' };
  }

  // Plan Amigo: si la marca tiene zeroChannelCommission activo y el contrato proviene de invitación válida, comisión de canal = 0 €
  const activeReferral = await prisma.referral.findFirst({
    where: {
      referredContractId: contractId,
      status: { not: 'CANCELLED' },
    },
    include: {
      brand: { select: { referralConfig: { select: { zeroChannelCommission: true } } } },
    },
  });
  if (activeReferral && activeReferral.brand?.referralConfig?.zeroChannelCommission) {
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        commissionBase: 0,
        commissionFinal: 0,
        commissionRuleType: 'PLAN_AMIGO_ZERO',
        commissionRuleValue: 0,
      },
    });
    return { success: true, commissionFinal: 0 };
  }

  if (options?.onlyIfEmpty && c.commissionFinal !== null && c.commissionFinal !== undefined && c.commissionFinal > 0) {
    return { success: true, commissionFinal: c.commissionFinal };
  }

  const tierId = c.user?.channel?.commissionTierId;
  if (!tierId) {
    return { success: false, error: 'El canal asociado al contrato no tiene un Nivel de comisión asignado.' };
  }

  // Garantizar que los snapshots de márgenes queden poblados si aún eran nulos (contratos legacy)
  const mergedCData = {
    ...((c.airtableData as Record<string, any>) || {}),
    ...((c.Lead?.contractData as Record<string, any>) || {}),
  };
  const extracted = extractContractMarginSnapshots(mergedCData, c.product, c.Lead?.productType);

  const snapMarginFC = c.marginFC !== null && c.marginFC !== undefined ? c.marginFC : extracted.marginFC;
  const snapIp1 = c.ip1 !== null && c.ip1 !== undefined ? c.ip1 : extracted.ip1;
  const snapIp2 = c.ip2 !== null && c.ip2 !== undefined ? c.ip2 : extracted.ip2;
  const snapIp3 = c.ip3 !== null && c.ip3 !== undefined ? c.ip3 : extracted.ip3;
  const snapIp4 = c.ip4 !== null && c.ip4 !== undefined ? c.ip4 : extracted.ip4;
  const snapIp5 = c.ip5 !== null && c.ip5 !== undefined ? c.ip5 : extracted.ip5;
  const snapIp6 = c.ip6 !== null && c.ip6 !== undefined ? c.ip6 : extracted.ip6;
  const snapProductType = c.productTypeSnapshot || extracted.productTypeSnapshot || c.product?.type || '';
  const snapFee = c.fee !== null && c.fee !== undefined ? c.fee : extracted.fee;

  let tierRules = options?.preloadedRulesByTier?.get(tierId);
  if (!tierRules) {
    tierRules = await prisma.commissionRule.findMany({
      where: { tierId },
      include: {
        products: { select: { id: true } },
        additionalServices: { select: { id: true } },
      },
    });
  }

  const potencias = getContractPotencias(c);
  const avgPower = (potencias[0] + potencias[1]) / 2;
  const tarifa = getContractTarifa(c);

  const matchParams = {
    tarifa,
    productType: snapProductType,
    productId: c.productId,
    avgPower,
  };

  const matchedRule = matchBestCommissionRule(tierRules, matchParams);
  if (!matchedRule) {
    return { success: false, error: 'No se encontró ninguna regla aplicable en el Nivel del canal.' };
  }

  let calculatedCommission = 0;
  if (matchedRule.commissionType === 'FIXED') {
    calculatedCommission = matchedRule.value;
  } else if (matchedRule.commissionType === 'PERCENTAGE') {
    const consumoMWh = getContractConsumoMWh(c);
    const energyMargin = consumoMWh * (snapMarginFC ?? 0);
    const powerMargin =
      potencias[0] * (snapIp1 ?? 0) +
      potencias[1] * (snapIp2 ?? 0) +
      potencias[2] * (snapIp3 ?? 0) +
      potencias[3] * (snapIp4 ?? 0) +
      potencias[4] * (snapIp5 ?? 0) +
      potencias[5] * (snapIp6 ?? 0);

    calculatedCommission = (energyMargin + powerMargin) * (matchedRule.value / 100);
  }

  // Comisiones de Servicios Adicionales: horizonte anual fijo de 12 meses (independiente de la permanencia del cliente)
  let serviceCommission = 0;
  if (c.additionalServicesSnapshot && Array.isArray(c.additionalServicesSnapshot)) {
    for (const s of c.additionalServicesSnapshot as any[]) {
      if (s?.isCommissionable) {
        const serviceRule = matchBestServiceRule(tierRules, s.id, matchParams);
        if (serviceRule) {
          if (serviceRule.commissionType === 'FIXED') {
            serviceCommission += serviceRule.value;
          } else if (serviceRule.commissionType === 'PERCENTAGE') {
            const monthlyPrice =
              s.monthlyPrice !== null && s.monthlyPrice !== undefined
                ? Number(s.monthlyPrice)
                : s.dailyPrice !== null && s.dailyPrice !== undefined
                  ? Number(s.dailyPrice) * (365 / 12)
                  : 0;
            const annualServiceMargin = monthlyPrice * 12;
            serviceCommission += annualServiceMargin * (serviceRule.value / 100);
          }
        }
      }
    }
  }

  const finalCommissionTotal = calculatedCommission + serviceCommission;

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      commissionBase: finalCommissionTotal,
      commissionFinal: finalCommissionTotal,
      commissionRuleType: matchedRule.commissionType,
      commissionRuleValue: matchedRule.value,
      fee: snapFee,
      marginFC: snapMarginFC,
      ip1: snapIp1,
      ip2: snapIp2,
      ip3: snapIp3,
      ip4: snapIp4,
      ip5: snapIp5,
      ip6: snapIp6,
      productTypeSnapshot: snapProductType || null,
    },
  });

  return { success: true, commissionFinal: finalCommissionTotal };
}

/**
 * Determina si un contrato inicia un ciclo anual independiente por ser una Renovación (Regla 135).
 */
export function isRenewalContract(c: any): boolean {
  if (c.tipo === 'R' || c.isTacitRenewal === true) return true;
  const tram = (c.tramitationType || '').toLowerCase();
  if (tram.includes('renovaci')) return true;
  if (c.airtableData && typeof c.airtableData === 'object') {
    const adTipo = String(c.airtableData['Tipo'] || '').toLowerCase();
    if (adTipo === 'r' || adTipo.includes('renovaci')) return true;
  }
  return false;
}

/**
 * Agrupa contratos por código base pero separa cualquier Renovación (expresa o tácita) en su propia
 * cadena de comisión de 365 días, manteniendo unidas únicamente modificaciones (M1/M2) y reposiciones (E1/E2).
 */
export function splitContractsIntoCommissionChains(contracts: any[]): Map<string, any[]> {
  const byBaseCode = new Map<string, any[]>();
  for (const c of contracts) {
    const baseCode = c.contractCode ? c.contractCode.split('-V')[0] : c.id;
    if (!byBaseCode.has(baseCode)) byBaseCode.set(baseCode, []);
    byBaseCode.get(baseCode)!.push(c);
  }

  const chains = new Map<string, any[]>();
  for (const [baseCode, list] of byBaseCode.entries()) {
    list.sort((a, b) => {
      const vDiff = (a.version || 0) - (b.version || 0);
      if (vDiff !== 0) return vDiff;
      const aTime = a.activationDate ? new Date(a.activationDate).getTime() : 0;
      const bTime = b.activationDate ? new Date(b.activationDate).getTime() : 0;
      return aTime - bTime;
    });

    let currentChainKey = baseCode;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (i > 0 && isRenewalContract(c)) {
        currentChainKey = `${baseCode}__R_${c.version}_${c.id}`;
      }
      if (!chains.has(currentChainKey)) chains.set(currentChainKey, []);
      chains.get(currentChainKey)!.push(c);
    }
  }

  return chains;
}

const CNMC_DROP_PROCESSES = new Set(['C1', 'C2', 'B1', 'B2', 'E1', 'E2', 'T1']);

/**
 * Calcula los días reales activos de una cadena de contrato.
 * - En bajas CNMC (C1/C2/B1/B2/E1/E2/T1), terminationDate es FechaActivacionBaja (exclusiva: 01/01 -> 01/01 = 365 días).
 * - En cierres por fin de anualidad / renovación (activate-renewals fija terminationDate = expectedEndDate = último día inclusivo, ej. 31/12),
 *   suma +1 día inclusivo cuando no es baja CNMC y alcanzó su expectedEndDate o fue sucedido por renovación, evitando falsas decomisiones de 1 día.
 */
export function computeChainDaysActive(
  v0: any,
  latest: any,
  succeededByRenewal: boolean = false
): number {
  if (!v0?.activationDate || !latest?.terminationDate) return 0;
  const actMs = toMadridDayUtcMs(v0.activationDate);
  const termMs = toMadridDayUtcMs(latest.terminationDate);
  const rawDiff = Math.max(0, Math.round((termMs - actMs) / DAY_MS));

  const isCnmcDrop = latest.bajaProcess && CNMC_DROP_PROCESSES.has(String(latest.bajaProcess).toUpperCase());
  if (!isCnmcDrop) {
    const reachedExpectedEnd =
      v0.expectedEndDate && termMs >= toMadridDayUtcMs(v0.expectedEndDate);
    if (succeededByRenewal || (reachedExpectedEnd && rawDiff >= 364)) {
      return rawDiff + 1;
    }
  }

  return rawDiff;
}

/**
 * Evalúa la regla de "Baja Rápida" (Quick Drop): si el contrato causa baja definitiva antes del día 11
 * del mes siguiente a su activación (o antes de customCutoffDateStr cuando éste corresponde al mes X+1),
 * se anula tanto el devengo inicial como la decomisión.
 */
export function isQuickDropChain(
  actDate: Date,
  termDate: Date | null | undefined,
  customCutoffDateStr?: string
): boolean {
  if (!termDate || !actDate) return false;

  const actYmd = toMadridYmd(actDate);
  const [actYear, actMonth] = actYmd.split('-').map(Number); // actMonth: 1..12

  // Mes siguiente (X + 1)
  const nextMonthYear = actMonth === 12 ? actYear + 1 : actYear;
  const nextMonth = actMonth === 12 ? 1 : actMonth + 1;
  const nextMonthPrefix = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-`;

  let cutoffMs: number;
  if (customCutoffDateStr && customCutoffDateStr.startsWith(nextMonthPrefix)) {
    cutoffMs = toMadridDayUtcMs(customCutoffDateStr);
  } else {
    cutoffMs = Date.UTC(nextMonthYear, nextMonth - 1, 11);
  }

  const termMs = toMadridDayUtcMs(termDate);
  return termMs < cutoffMs;
}

/**
 * Calcula el consumo neto (MWh) y los días facturados efectivos (uniendo intervalos solapados de complementarias
 * y descontando periodos anulados por abonos sin reemplazo) para el True-Up de tarifas >= 3.0TD.
 */
export function summarizeChainInvoicesForTrueUp(
  legacyInvoices: any[],
  internalInvoices: any[]
): { totalMWh: number; totalBillingDays: number } {
  const seenKeys = new Set<string>();
  const normalized: Array<{
    startDay: number;
    endDay: number;
    mwhAbs: number;
    isAbono: boolean;
  }> = [];

  const isCreditNote = (inv: any, isInternal: boolean): boolean => {
    const t = String(inv.invoiceType || '').trim().toUpperCase();
    return (
      (isInternal && inv.status === 'ABONO') ||
      t.includes('ABONO') ||
      t.includes('RECTIFICAT') ||
      t === 'A' ||
      t === 'AR' ||
      t === 'S' ||
      (typeof inv.totalAmount === 'number' && inv.totalAmount < 0) ||
      (typeof inv.totalMWh === 'number' && inv.totalMWh < 0)
    );
  };

  // 1. Procesar primero InternalInvoice (ya está en MWh nativo)
  for (const inv of internalInvoices) {
    const tUpper = String(inv.invoiceType || '').toUpperCase();
    if (tUpper.includes('PENALIZ')) continue;
    if (!inv.billingStart || !inv.billingEnd) continue;

    if (inv.invoiceNumber) seenKeys.add(`NUM:${inv.invoiceNumber}`);
    if (inv.f1InvoiceId) seenKeys.add(`F1:${inv.f1InvoiceId}:${inv.status || ''}`);

    const startDay = Math.floor(toMadridDayUtcMs(inv.billingStart) / DAY_MS);
    const endDay = Math.floor(toMadridDayUtcMs(inv.billingEnd) / DAY_MS);
    if (endDay < startDay) continue;

    normalized.push({
      startDay,
      endDay,
      mwhAbs: Math.abs(Number(inv.totalMWh) || 0),
      isAbono: isCreditNote(inv, true),
    });
  }

  // 2. Procesar Invoice legacy/CSV (totalMWh en kWh -> dividir entre 1000 según Regla 81), evitando duplicados
  for (const inv of legacyInvoices) {
    const tUpper = String(inv.invoiceType || '').toUpperCase();
    if (tUpper.includes('PENALIZ')) continue;
    if (!inv.billingStart || !inv.billingEnd) continue;

    if (inv.invoiceNumber && seenKeys.has(`NUM:${inv.invoiceNumber}`)) continue;

    const startDay = Math.floor(toMadridDayUtcMs(inv.billingStart) / DAY_MS);
    const endDay = Math.floor(toMadridDayUtcMs(inv.billingEnd) / DAY_MS);
    if (endDay < startDay) continue;

    normalized.push({
      startDay,
      endDay,
      mwhAbs: Math.abs(Number(inv.totalMWh) || 0) / 1000,
      isAbono: isCreditNote(inv, false),
    });
  }

  let totalMWh = 0;
  const posDayCounts = new Map<number, number>();
  const abonoDayCounts = new Map<number, number>();

  for (const item of normalized) {
    totalMWh += item.isAbono ? -item.mwhAbs : item.mwhAbs;

    const span = item.endDay - item.startDay + 1;
    // Protección ante posibles fechas corruptas con rangos multi-década
    if (span > 0 && span <= 1500) {
      const targetMap = item.isAbono ? abonoDayCounts : posDayCounts;
      for (let d = item.startDay; d <= item.endDay; d++) {
        targetMap.set(d, (targetMap.get(d) || 0) + 1);
      }
    }
  }

  let totalBillingDays = 0;
  for (const [day, posCount] of posDayCounts.entries()) {
    const abCount = abonoDayCounts.get(day) || 0;
    if (posCount > abCount) {
      totalBillingDays++;
    }
  }

  return { totalMWh, totalBillingDays };
}
