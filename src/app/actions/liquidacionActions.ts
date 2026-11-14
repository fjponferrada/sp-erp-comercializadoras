'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand, getUserVisibilityFilter } from '@/lib/permissions';
import { isInternalBillingProductionEnabled } from '@/lib/services/internalInvoiceMapper';
import {
  calculateAndSnapshotContractCommission,
  computeChainDaysActive,
  getContractConsumoMWh,
  getContractPotencias,
  getContractTarifa,
  getSnapshotMarginFC,
  getSnapshotPotenciaMargins,
  getSnapshotProductType,
  isQuickDropChain,
  isRenewalContract,
  matchBestCommissionRule,
  matchBestServiceRule,
  splitContractsIntoCommissionChains,
  summarizeChainInvoicesForTrueUp,
  toMadridDayUtcMs,
} from '@/lib/services/CommissionEngine';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const CONTRACT_COMMISSION_SELECT = {
  id: true,
  brandId: true,
  productId: true,
  commissionBase: true,
  commissionFinal: true,
  commissionRuleType: true,
  commissionRuleValue: true,
  fee: true,
  marginFC: true,
  ip1: true,
  ip2: true,
  ip3: true,
  ip4: true,
  ip5: true,
  ip6: true,
  productTypeSnapshot: true,
  activationDate: true,
  expectedEndDate: true,
  terminationDate: true,
  bajaProcess: true,
  tipo: true,
  isTacitRenewal: true,
  p1c: true,
  p2c: true,
  p3c: true,
  p4c: true,
  p5c: true,
  p6c: true,
  contractCode: true,
  version: true,
  annualConsumption: true,
  tramitationType: true,
  airtableData: true,
  additionalServicesSnapshot: true,
  permanenceMonths: true,
  client: { select: { businessName: true } },
  supplyPoint: {
    select: {
      cups: true,
      tariff: true,
      annualConsumption: true,
      p1c: true,
      p2c: true,
      p3c: true,
      p4c: true,
      p5c: true,
      p6c: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      type: true,
      tariff: true,
      ip1: true,
      ip2: true,
      ip3: true,
      ip4: true,
      ip5: true,
      ip6: true,
      marginFC: true,
    },
  },
  user: {
    select: {
      channel: { select: { commissionTierId: true } },
    },
  },
  other_Contract: {
    select: {
      id: true,
      tipo: true,
      isTacitRenewal: true,
      status: true,
    },
  },
} as const;

export async function getLiquidacionComisionesAction(
  startDateStr: string,
  endDateStr: string,
  decommStartDateStr: string,
  decommEndDateStr: string,
  channelId: string = 'todos',
  mode: 'upfront' | 'carterizada' = 'upfront',
  customCutoffDateStr?: string
) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return { success: false, error: 'No autorizado' };
    }

    const brandId = await getActiveBrand();
    if (!brandId) {
      return { success: false, error: 'Marca no seleccionada o sin acceso autorizado' };
    }

    const whereClause: any = {
      brandId,
      status: { in: ['ACTIVO', 'Activo', 'BAJA', 'FINALIZADO', 'Finalizado'] },
      activationDate: { not: null },
    };

    if (channelId && channelId !== 'todos') {
      whereClause.user = { channelId };
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: CONTRACT_COMMISSION_SELECT,
    });

    const actStartMs = toMadridDayUtcMs(startDateStr);
    const actEndMs = toMadridDayUtcMs(endDateStr);
    const actEndExclusiveMs = actEndMs + DAY_MS;

    const termStartMs = toMadridDayUtcMs(decommStartDateStr);
    const termEndMs = toMadridDayUtcMs(decommEndDateStr);

    // Separar cadenas respetando que las Renovaciones (Regla 135) inician su propio ciclo de 365 días
    const chains = splitContractsIntoCommissionChains(contracts);

    // Si una cadena de modificaciones (M1/E1/E2) no incluye su V0 porque pertenecía a otro filtro, cargamos el V0 de la misma marca
    const missingBaseCodes: string[] = [];
    for (const [, chainContracts] of chains.entries()) {
      const first = chainContracts[0];
      if (first && (first.version || 0) > 0 && !isRenewalContract(first) && first.contractCode) {
        missingBaseCodes.push(first.contractCode.split('-V')[0]);
      }
    }

    if (missingBaseCodes.length > 0) {
      const uniqueMissing = Array.from(new Set(missingBaseCodes));
      const v0s = await prisma.contract.findMany({
        where: {
          brandId,
          contractCode: { in: uniqueMissing },
          version: 0,
          activationDate: { not: null },
        },
        select: CONTRACT_COMMISSION_SELECT,
      });

      for (const v0 of v0s) {
        if (v0.contractCode && chains.has(v0.contractCode)) {
          const arr = chains.get(v0.contractCode)!;
          if (!arr.some((x) => x.id === v0.id)) {
            arr.unshift(v0);
          }
        }
      }
    }

    // Precargar todas las reglas de los niveles involucrados en una sola consulta (0 N+1)
    const tierIdsSet = new Set<string>();
    const restoEarlyTermChainIds = new Set<string>();

    for (const [, chainContracts] of chains.entries()) {
      chainContracts.sort((a, b) => (a.version || 0) - (b.version || 0));
      const v0 = chainContracts[0];
      if (!v0?.activationDate) continue;

      const tId = v0.user?.channel?.commissionTierId;
      if (tId) tierIdsSet.add(tId);

      const latest = chainContracts[chainContracts.length - 1];
      if (mode === 'upfront' && latest?.terminationDate) {
        const termMs = toMadridDayUtcMs(latest.terminationDate);
        if (termMs >= termStartMs && termMs <= termEndMs) {
          if (!isQuickDropChain(v0.activationDate, latest.terminationDate, customCutoffDateStr)) {
            const succeededByRenewal = Boolean(
              latest.other_Contract &&
                isRenewalContract(latest.other_Contract) &&
                !['RECHAZADO', 'Rechazado', 'ANULADO', 'CANCELADO'].includes(latest.other_Contract.status)
            );
            const daysActive = computeChainDaysActive(v0, latest, succeededByRenewal);
            const tarifa = getContractTarifa(latest);
            if (daysActive < 365 && tarifa !== '2.0TD') {
              for (const c of chainContracts) restoEarlyTermChainIds.add(c.id);
            }
          }
        }
      }
    }

    const rulesByTier = new Map<string, any[]>();
    if (tierIdsSet.size > 0) {
      const allTierRules = await prisma.commissionRule.findMany({
        where: { tierId: { in: Array.from(tierIdsSet) } },
        include: {
          products: { select: { id: true } },
          additionalServices: { select: { id: true } },
        },
      });
      for (const r of allTierRules) {
        if (!rulesByTier.has(r.tierId)) rulesByTier.set(r.tierId, []);
        rulesByTier.get(r.tierId)!.push(r);
      }
    }

    // Precargar en bloque facturas legacy/CSV + facturas internas nativas para True-Up (0 N+1)
    const legacyInvoicesByContract = new Map<string, any[]>();
    const internalInvoicesByContract = new Map<string, any[]>();

    if (restoEarlyTermChainIds.size > 0) {
      const targetIds = Array.from(restoEarlyTermChainIds);
      const [legacyInvs, internalInvs] = await Promise.all([
        prisma.invoice.findMany({
          where: { contractId: { in: targetIds } },
          select: {
            id: true,
            contractId: true,
            invoiceNumber: true,
            f1InvoiceId: true,
            totalMWh: true,
            totalAmount: true,
            billingStart: true,
            billingEnd: true,
            invoiceType: true,
          },
        }),
        isInternalBillingProductionEnabled()
          ? prisma.internalInvoice.findMany({
              where: {
                contractId: { in: targetIds },
                status: { in: ['EMITIDA', 'ABONO'] },
                hidden: false,
              },
              select: {
                id: true,
                contractId: true,
                invoiceNumber: true,
                f1InvoiceId: true,
                totalMWh: true,
                totalAmount: true,
                billingStart: true,
                billingEnd: true,
                invoiceType: true,
                status: true,
              },
            })
          : Promise.resolve([]),
      ]);

      for (const inv of legacyInvs) {
        if (!inv.contractId) continue;
        if (!legacyInvoicesByContract.has(inv.contractId)) legacyInvoicesByContract.set(inv.contractId, []);
        legacyInvoicesByContract.get(inv.contractId)!.push(inv);
      }
      for (const inv of internalInvs) {
        if (!inv.contractId) continue;
        if (!internalInvoicesByContract.has(inv.contractId)) internalInvoicesByContract.set(inv.contractId, []);
        internalInvoicesByContract.get(inv.contractId)!.push(inv);
      }
    }

    const getProductoLabel = (c: any) => {
      const base = c.product?.name || '-';
      if (c.additionalServicesSnapshot && Array.isArray(c.additionalServicesSnapshot) && c.additionalServicesSnapshot.length > 0) {
        const services = c.additionalServicesSnapshot.map((s: any) => s.name).join(' + ');
        return `${base} + ${services}`;
      }
      return base;
    };

    let totalLiquidacion = 0;
    const commissions: any[] = [];
    const decommissions: any[] = [];
    const carterizadas: any[] = [];

    for (const [, chainContracts] of chains.entries()) {
      chainContracts.sort((a, b) => (a.version || 0) - (b.version || 0));

      const v0 = chainContracts[0];
      if (!v0 || !v0.activationDate) continue;

      const actDate: Date = v0.activationDate;
      const actDayMs = toMadridDayUtcMs(actDate);
      const commission = Number(v0.commissionFinal || 0);
      const dailyCommission = commission / 365;

      const latest = chainContracts[chainContracts.length - 1];
      const termDate: Date | null = latest.terminationDate;

      // Filtro de Bajas Rápidas (antes del día 11 del mes siguiente a la activación o customCutoffDateStr aplicable)
      if (isQuickDropChain(actDate, termDate, customCutoffDateStr)) {
        continue;
      }

      const succeededByRenewal = Boolean(
        latest.other_Contract &&
          isRenewalContract(latest.other_Contract) &&
          !['RECHAZADO', 'Rechazado', 'ANULADO', 'CANCELADO'].includes(latest.other_Contract.status)
      );

      if (mode === 'upfront') {
        // 1. Alta / Comisión Upfront (100% por horizonte anual de 365 días)
        if (actDayMs >= actStartMs && actDayMs <= actEndMs) {
          const potenciasV0 = getContractPotencias(v0);
          const liquidado = round2(commission);
          commissions.push({
            id: v0.id,
            v0Id: v0.id,
            titular: v0.client?.businessName || '-',
            codigoContrato: v0.contractCode || '-',
            fechaAltaV0: v0.activationDate,
            producto: getProductoLabel(v0),
            cups: v0.supplyPoint?.cups || '-',
            tarifa: getContractTarifa(v0),
            consumoAnual: getContractConsumoMWh(v0),
            p1c: potenciasV0[0],
            potencias: potenciasV0,
            comisionOriginal: round2(commission),
            diasComputados: 365,
            importeLiquidado: liquidado,
            tipo: 'COMISION',
          });
          totalLiquidacion += liquidado;
        }

        // 2. Baja Anticipada / Decomisión (independiente de si el cliente tenía permanencia o no: horizonte comisión = 365 días)
        if (termDate) {
          const termDayMs = toMadridDayUtcMs(termDate);
          if (termDayMs >= termStartMs && termDayMs <= termEndMs) {
            const daysActive = computeChainDaysActive(v0, latest, succeededByRenewal);

            // Si cumplió los 365 días completos (1 año), la comisión anual ya está 100% devengada -> NO decomisiona
            if (daysActive < 365) {
              const tarifa = getContractTarifa(latest);
              const potenciasLatest = getContractPotencias(latest);

              if (tarifa === '2.0TD') {
                const daysToReturn = 365 - daysActive;
                const decommissionAmount = round2(daysToReturn * dailyCommission);

                // Omitir decomisiones menores a 1 € en 2.0TD
                if (decommissionAmount >= 1) {
                  decommissions.push({
                    id: latest.id,
                    v0Id: v0.id,
                    titular: latest.client?.businessName || '-',
                    codigoContrato: latest.contractCode || '-',
                    fechaAltaV0: v0.activationDate,
                    fechaBajaVFinal: latest.terminationDate,
                    producto: getProductoLabel(latest),
                    cups: latest.supplyPoint?.cups || '-',
                    tarifa,
                    consumoAnual: getContractConsumoMWh(latest),
                    p1c: potenciasLatest[0],
                    potencias: potenciasLatest,
                    comisionOriginal: round2(commission),
                    diasComputados: daysToReturn,
                    importeLiquidado: decommissionAmount,
                    tipo: 'DECOMISION',
                    diasActivos: daysActive,
                  });
                  totalLiquidacion -= decommissionAmount;
                }
              } else {
                // Resto Tarifas (>= 3.0TD): True-Up por consumo real facturado + potencias por tramo temporal usando snapshots del contrato
                const tierId = v0.user?.channel?.commissionTierId;
                const tierRules = tierId ? rulesByTier.get(tierId) || [] : [];

                const potenciasV0 = getContractPotencias(v0);
                const avgPowerV0 = (potenciasV0[0] + potenciasV0[1]) / 2;
                const snapProductType = getSnapshotProductType(v0);

                // Priorizar snapshot inmutable de regla en V0; fallback a reglas del tier sólo si fuera nulo
                let ruleType: string | null = v0.commissionRuleType || null;
                let ruleValue: number | null =
                  v0.commissionRuleValue !== null && v0.commissionRuleValue !== undefined
                    ? Number(v0.commissionRuleValue)
                    : null;

                if (!ruleType || ruleValue === null) {
                  const fallbackRule = matchBestCommissionRule(tierRules, {
                    tarifa,
                    productType: snapProductType,
                    productId: v0.productId,
                    avgPower: avgPowerV0,
                  });
                  if (fallbackRule) {
                    ruleType = fallbackRule.commissionType;
                    ruleValue = fallbackRule.value;
                  }
                }

                if (ruleType && ruleValue !== null) {
                  const chainLegacyInvs: any[] = [];
                  const chainInternalInvs: any[] = [];
                  for (const cVer of chainContracts) {
                    const lInvs = legacyInvoicesByContract.get(cVer.id);
                    if (lInvs) chainLegacyInvs.push(...lInvs);
                    const iInvs = internalInvoicesByContract.get(cVer.id);
                    if (iInvs) chainInternalInvs.push(...iInvs);
                  }

                  const { totalMWh, totalBillingDays } = summarizeChainInvoicesForTrueUp(
                    chainLegacyInvs,
                    chainInternalInvs
                  );

                  const dailyMWh =
                    totalBillingDays > 0
                      ? totalMWh / totalBillingDays
                      : getContractConsumoMWh(latest) / 365;

                  const billableDays = Math.min(daysActive, 365);
                  const extrapolatedConsumo = Math.max(0, dailyMWh * billableDays);

                  // Margen de energía y potencia ponderando cada versión por sus días reales sin huecos de 1 día en M1
                  const startLifeMs = actDayMs;
                  const endOfBillableMs = startLifeMs + billableDays * DAY_MS;

                  let powerMargin = 0;
                  let weightedMarginFCNumerator = 0;
                  let totalVersionDays = 0;

                  for (let idx = 0; idx < chainContracts.length; idx++) {
                    const cVersion = chainContracts[idx];
                    const nextVersion = chainContracts[idx + 1];

                    const startVMs = cVersion.activationDate
                      ? Math.max(startLifeMs, toMadridDayUtcMs(cVersion.activationDate))
                      : startLifeMs;

                    let rawEndVMs = endOfBillableMs;
                    if (nextVersion?.activationDate) {
                      rawEndVMs = toMadridDayUtcMs(nextVersion.activationDate);
                    } else if (cVersion.terminationDate) {
                      rawEndVMs = toMadridDayUtcMs(cVersion.terminationDate);
                    }

                    const endVMs = Math.min(rawEndVMs, endOfBillableMs);
                    if (endVMs > startVMs) {
                      const daysV = Math.round((endVMs - startVMs) / DAY_MS);
                      const potV = getContractPotencias(cVersion);
                      const ipV = getSnapshotPotenciaMargins(cVersion);
                      const annualPowerMarginV =
                        potV[0] * ipV[0] +
                        potV[1] * ipV[1] +
                        potV[2] * ipV[2] +
                        potV[3] * ipV[3] +
                        potV[4] * ipV[4] +
                        potV[5] * ipV[5];

                      powerMargin += annualPowerMarginV * (daysV / 365);
                      weightedMarginFCNumerator += getSnapshotMarginFC(cVersion) * daysV;
                      totalVersionDays += daysV;
                    }
                  }

                  const effectiveMarginFC =
                    totalVersionDays > 0
                      ? weightedMarginFCNumerator / totalVersionDays
                      : getSnapshotMarginFC(latest);

                  const energyMargin = extrapolatedConsumo * effectiveMarginFC;

                  let comisionReal = 0;
                  let comisionMargenEnergia = 0;
                  let comisionMargenPotencia = 0;

                  if (ruleType === 'FIXED') {
                    comisionReal = ruleValue * (billableDays / 365);
                    comisionMargenEnergia = comisionReal;
                  } else if (ruleType === 'PERCENTAGE') {
                    comisionMargenEnergia = energyMargin * (ruleValue / 100);
                    comisionMargenPotencia = powerMargin * (ruleValue / 100);
                    comisionReal = comisionMargenEnergia + comisionMargenPotencia;
                  }

                  // Servicios adicionales: horizonte anual fijo de 365 días / 12 meses
                  let serviceCommission = 0;
                  if (v0.additionalServicesSnapshot && Array.isArray(v0.additionalServicesSnapshot)) {
                    const svcMatchParams = {
                      tarifa,
                      productType: snapProductType,
                      productId: v0.productId,
                      avgPower: avgPowerV0,
                    };
                    for (const s of v0.additionalServicesSnapshot as any[]) {
                      if (s?.isCommissionable) {
                        const serviceRule = matchBestServiceRule(tierRules, s.id, svcMatchParams);
                        if (serviceRule) {
                          if (serviceRule.commissionType === 'FIXED') {
                            serviceCommission += serviceRule.value * (billableDays / 365);
                          } else if (serviceRule.commissionType === 'PERCENTAGE') {
                            const monthlyPrice =
                              s.monthlyPrice !== null && s.monthlyPrice !== undefined
                                ? Number(s.monthlyPrice)
                                : s.dailyPrice !== null && s.dailyPrice !== undefined
                                  ? Number(s.dailyPrice) * (365 / 12)
                                  : 0;
                            const trueUpServiceMargin = monthlyPrice * 12 * (billableDays / 365);
                            serviceCommission += trueUpServiceMargin * (serviceRule.value / 100);
                          }
                        }
                      }
                    }
                  }

                  comisionReal += serviceCommission;
                  const diferencia = round2(comisionReal - commission);

                  if (Math.abs(diferencia) >= 0.01 || commission > 0 || comisionReal > 0) {
                    decommissions.push({
                      id: latest.id,
                      v0Id: v0.id,
                      titular: latest.client?.businessName || '-',
                      codigoContrato: latest.contractCode || '-',
                      fechaAltaV0: v0.activationDate,
                      fechaBajaVFinal: latest.terminationDate,
                      producto: getProductoLabel(latest),
                      cups: latest.supplyPoint?.cups || '-',
                      tarifa,
                      consumoAnual: getContractConsumoMWh(latest),
                      p1c: potenciasLatest[0],
                      potencias: potenciasLatest,
                      comisionOriginal: round2(commission),
                      diasComputados: billableDays,
                      diasActivos: daysActive,
                      comisionReal: round2(comisionReal),
                      comisionMargenEnergia: round2(comisionMargenEnergia),
                      comisionMargenPotencia: round2(comisionMargenPotencia),
                      energiaConsiderada: round2(extrapolatedConsumo),
                      comisionResto: round2(serviceCommission),
                      importeLiquidado: diferencia,
                      tipo: 'DECOMISION_RESTO',
                    });
                    totalLiquidacion += diferencia;
                  }
                }
              }
            }
          }
        }
      } else {
        // Modo Carterizada (devengo lineal diario sobre los primeros 365 días de la cadena)
        const commissionHorizonEndExclusiveMs = actDayMs + 365 * DAY_MS;
        let actualEndExclusiveMs = commissionHorizonEndExclusiveMs;

        if (termDate) {
          const daysActive = computeChainDaysActive(v0, latest, succeededByRenewal);
          const chainEndExclusiveMs = actDayMs + Math.min(daysActive, 365) * DAY_MS;
          if (chainEndExclusiveMs < actualEndExclusiveMs) {
            actualEndExclusiveMs = chainEndExclusiveMs;
          }
        }

        const pStartMs = Math.max(actDayMs, actStartMs);
        const pEndMs = Math.min(actualEndExclusiveMs, actEndExclusiveMs);

        if (pEndMs > pStartMs) {
          const diffDays = Math.round((pEndMs - pStartMs) / DAY_MS);
          const liquidacionAmount = round2(dailyCommission * diffDays);

          if (diffDays > 0 && liquidacionAmount >= 0) {
            const potenciasLatest = getContractPotencias(latest);
            carterizadas.push({
              id: latest.id,
              v0Id: v0.id,
              titular: latest.client?.businessName || '-',
              codigoContrato: latest.contractCode || '-',
              producto: getProductoLabel(latest),
              cups: latest.supplyPoint?.cups || '-',
              tarifa: getContractTarifa(latest),
              consumoAnual: getContractConsumoMWh(latest),
              p1c: potenciasLatest[0],
              potencias: potenciasLatest,
              comisionOriginal: round2(commission),
              diasComputados: diffDays,
              importeLiquidado: liquidacionAmount,
            });
            totalLiquidacion += liquidacionAmount;
          }
        }
      }
    }

    const sortFn = (a: any, b: any) => {
      const tarifaCompare = (a.tarifa || '').localeCompare(b.tarifa || '');
      if (tarifaCompare !== 0) return tarifaCompare;

      const productoCompare = (a.producto || '').localeCompare(b.producto || '');
      if (productoCompare !== 0) return productoCompare;

      return (a.p1c || 0) - (b.p1c || 0);
    };

    commissions.sort(sortFn);
    decommissions.sort(sortFn);
    carterizadas.sort(sortFn);

    return {
      success: true,
      data: {
        totalLiquidacion: round2(totalLiquidacion),
        commissions,
        decommissions,
        carterizadas,
      },
    };
  } catch (error: any) {
    console.error('Error en getLiquidacionComisionesAction:', error);
    return { success: false, error: error.message };
  }
}

export async function recalculateCommissionAction(contractId: string) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return { success: false, error: 'No autorizado' };
    }

    const visibilityFilter = await getUserVisibilityFilter();
    const authorized = await prisma.contract.findFirst({
      where: { id: contractId, ...visibilityFilter },
      select: { id: true },
    });

    if (!authorized) {
      return { success: false, error: 'Contrato no encontrado o sin acceso autorizado.' };
    }

    return await calculateAndSnapshotContractCommission(contractId);
  } catch (error: any) {
    console.error('Error en recalculateCommissionAction:', error);
    return { success: false, error: error.message };
  }
}

export async function recalculateCommissionsBatchAction(contractIds: string[]) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return { success: false, error: 'No autorizado' };
    }

    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      return { success: true, successCount: 0, failedCount: 0 };
    }

    const uniqueIds = Array.from(new Set(contractIds.filter(Boolean)));
    const visibilityFilter = await getUserVisibilityFilter();

    const authorizedContracts = await prisma.contract.findMany({
      where: { id: { in: uniqueIds }, ...visibilityFilter },
      select: {
        id: true,
        user: { select: { channel: { select: { commissionTierId: true } } } },
      },
    });

    const tierIds = Array.from(
      new Set(
        authorizedContracts
          .map((c) => c.user?.channel?.commissionTierId)
          .filter((t): t is string => Boolean(t))
      )
    );

    const rulesByTier = new Map<string, any[]>();
    if (tierIds.length > 0) {
      const rules = await prisma.commissionRule.findMany({
        where: { tierId: { in: tierIds } },
        include: {
          products: { select: { id: true } },
          additionalServices: { select: { id: true } },
        },
      });
      for (const r of rules) {
        if (!rulesByTier.has(r.tierId)) rulesByTier.set(r.tierId, []);
        rulesByTier.get(r.tierId)!.push(r);
      }
    }

    let successCount = 0;
    let failedCount = 0;
    const CONCURRENCY = 10;

    for (let i = 0; i < authorizedContracts.length; i += CONCURRENCY) {
      const batch = authorizedContracts.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((c) =>
          calculateAndSnapshotContractCommission(c.id, { preloadedRulesByTier: rulesByTier })
        )
      );
      for (const res of results) {
        if (res.success) successCount++;
        else failedCount++;
      }
    }

    return { success: true, successCount, failedCount };
  } catch (error: any) {
    console.error('Error en recalculateCommissionsBatchAction:', error);
    return { success: false, error: error.message };
  }
}

export async function updateManualCommissionAction(contractId: string, manualValue: number) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return { success: false, error: 'No autorizado' };
    }

    if (!Number.isFinite(manualValue)) {
      return { success: false, error: 'Importe no válido.' };
    }

    const visibilityFilter = await getUserVisibilityFilter();
    const authorized = await prisma.contract.findFirst({
      where: { id: contractId, ...visibilityFilter },
      select: { id: true },
    });

    if (!authorized) {
      return { success: false, error: 'Contrato no encontrado o sin acceso autorizado.' };
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: { commissionFinal: manualValue },
    });

    return { success: true, commissionFinal: manualValue };
  } catch (error: any) {
    console.error('Error en updateManualCommissionAction:', error);
    return { success: false, error: error.message };
  }
}
