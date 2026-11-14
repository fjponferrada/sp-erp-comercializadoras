'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';
import {
  getContractTarifa,
  isQuickDropChain,
  isRenewalContract,
  splitContractsIntoCommissionChains,
  toMadridDayUtcMs,
} from '@/lib/services/CommissionEngine';

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const ACTIVE_COMM_SELECT = {
  id: true,
  commissionFinal: true,
  activationDate: true,
  terminationDate: true,
  contractCode: true,
  version: true,
  tipo: true,
  isTacitRenewal: true,
  tramitationType: true,
  airtableData: true,
  client: { select: { businessName: true } },
  supplyPoint: { select: { cups: true, tariff: true } },
  product: { select: { name: true, tariff: true } },
  user: { select: { channel: { select: { name: true } } } },
} as const;

export async function getActiveCommissionsAction(targetDateIso: string, channelId?: string) {
  try {
    const session = await auth();
    if (!session?.user || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(session.user.role)) {
      return { success: false, error: 'No autorizado' };
    }

    const brandId = await getActiveBrand();
    if (!brandId) {
      return { success: false, error: 'Marca no seleccionada o sin acceso autorizado' };
    }

    const targetDayMs = toMadridDayUtcMs(targetDateIso);

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
      select: ACTIVE_COMM_SELECT,
    });

    const chains = splitContractsIntoCommissionChains(contracts);

    // Recuperar V0 faltantes de la misma marca para modificaciones (M1/E1/E2)
    const missingBaseCodes: string[] = [];
    for (const [, chainContracts] of chains.entries()) {
      const first = chainContracts[0];
      if (first && (first.version || 0) > 0 && !isRenewalContract(first) && first.contractCode) {
        missingBaseCodes.push(first.contractCode.split('-V')[0]);
      }
    }

    if (missingBaseCodes.length > 0) {
      const v0s = await prisma.contract.findMany({
        where: {
          brandId,
          contractCode: { in: Array.from(new Set(missingBaseCodes)) },
          version: 0,
          activationDate: { not: null },
        },
        select: ACTIVE_COMM_SELECT,
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

    let totalActiveCommission = 0;
    let validContractsCount = 0;
    const details: any[] = [];

    for (const [, chainContracts] of chains.entries()) {
      chainContracts.sort((a, b) => (a.version || 0) - (b.version || 0));

      const v0 = chainContracts[0];
      const latest = chainContracts[chainContracts.length - 1];
      if (!v0?.activationDate) continue;

      const commission = Number(v0.commissionFinal || 0);
      if (commission <= 0) continue;

      const actDayMs = toMadridDayUtcMs(v0.activationDate);
      if (actDayMs > targetDayMs) continue;

      // Excluir bajas rápidas (anteriores al día 11 del mes siguiente al alta)
      if (isQuickDropChain(v0.activationDate, latest.terminationDate)) {
        continue;
      }

      // Debe seguir vigente al cierre de targetDate
      if (latest.terminationDate) {
        const termDayMs = toMadridDayUtcMs(latest.terminationDate);
        if (termDayMs <= targetDayMs) continue;
      }

      // Días transcurridos a cierre de targetDate (inclusivo: 01/01 a cierre 31/01 = 31 días amortizados)
      const elapsedDays = Math.round((targetDayMs - actDayMs) / DAY_MS) + 1;
      if (elapsedDays >= 365) {
        continue;
      }

      const pendingDays = 365 - elapsedDays;
      const dailyCommission = commission / 365;
      const amortizedAmount = round2(dailyCommission * elapsedDays);
      const activeRemaining = round2(commission - amortizedAmount);

      if (activeRemaining > 0) {
        totalActiveCommission += activeRemaining;
        validContractsCount++;
        details.push({
          id: latest.id,
          v0Id: v0.id,
          titular: latest.client?.businessName || v0.client?.businessName || '-',
          codigoContrato: latest.contractCode || v0.contractCode || '-',
          canal: v0.user?.channel?.name || 'Directo',
          tarifa: getContractTarifa(latest),
          producto: latest.product?.name || v0.product?.name || '-',
          cups: latest.supplyPoint?.cups || v0.supplyPoint?.cups || '-',
          fechaAltaV0: v0.activationDate,
          diasTranscurridos: elapsedDays,
          diasPendientes: pendingDays,
          comisionOriginal: round2(commission),
          parteAmortizada: amortizedAmount,
          parteActiva: activeRemaining,
        });
      }
    }

    details.sort((a, b) => b.parteActiva - a.parteActiva);

    return {
      success: true,
      data: {
        totalActiveCommission: round2(totalActiveCommission),
        validContractsCount,
        targetDate: targetDateIso,
        details,
      },
    };
  } catch (error: any) {
    console.error('Error calculando comisiones activas:', error);
    return { success: false, error: error.message };
  }
}
