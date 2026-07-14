'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function getActiveCommissionsAction(targetDateIso: string, channelId?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: 'No autorizado' };
    }

    const cookieStore = await cookies();
    const brandId = cookieStore.get('active-brand')?.value || (session.user as any).brandId;
    if (!brandId) {
      return { success: false, error: 'Marca no seleccionada' };
    }

    const targetDate = new Date(targetDateIso);
    targetDate.setHours(23, 59, 59, 999);

    // Filter conditions:
    // 1. Belong to brand
    // 2. commissionFinal > 0
    // 3. activationDate <= targetDate
    // 4. terminationDate is null OR terminationDate > targetDate
    // 5. Optionally filter by channel
    
    const whereClause: any = {
      brandId: brandId,
      commissionFinal: { gt: 0 },
      activationDate: { lte: targetDate },
      OR: [
        { terminationDate: null },
        { terminationDate: { gt: targetDate } }
      ]
    };

    if (channelId && channelId !== 'todos') {
      const userIdsInChannel = await prisma.user.findMany({
        where: { channelId, assignedBrands: { some: { id: brandId } } },
        select: { id: true }
      }).then(users => users.map(u => u.id));

      whereClause.userId = { in: userIdsInChannel };
    }

    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        commissionFinal: true,
        activationDate: true,
        contractCode: true,
        version: true,
        tramitationType: true,
        airtableData: true,
        client: { select: { businessName: true } },
        supplyPoint: { select: { cups: true } }
      }
    });

    const isM1orE1 = (type: string | null, airtableData?: any) => {
      const t1 = type?.toLowerCase() || '';
      const t2 = (airtableData && typeof airtableData === 'object' && airtableData['Tipo']) ? String(airtableData['Tipo']).toLowerCase() : '';
      
      const check = (t: string) => t === 'm1' || t === 'e1' || t.includes('modificación') || t.includes('error');
      
      return check(t1) || check(t2);
    };

    const contractCodesWithHigherVersion = contracts
      .filter(c => c.version > 0 && c.contractCode && isM1orE1(c.tramitationType, c.airtableData))
      .map(c => c.contractCode as string);

    // Some contracts have -V1, -V2 in their code. Version 0 is usually just the baseCode without -V.
    const baseCodes = contractCodesWithHigherVersion.map(c => c.split('-V')[0]);

    let version0ActivationDates = new Map<string, Date>();
    if (baseCodes.length > 0) {
      const v0Contracts = await prisma.contract.findMany({
        where: {
          contractCode: { in: baseCodes },
          version: 0,
          activationDate: { not: null }
        },
        select: {
          contractCode: true,
          activationDate: true
        }
      });
      v0Contracts.forEach(v0 => {
        if (v0.contractCode && v0.activationDate) {
          version0ActivationDates.set(v0.contractCode, v0.activationDate);
        }
      });
    }

    let totalActiveCommission = 0;
    let validContractsCount = 0;
    const details = [];

    for (const contract of contracts) {
      let actDate = contract.activationDate!;
      
      // Override activation date if it's M1/E1 and we found its version 0
      if (contract.version > 0 && contract.contractCode && isM1orE1(contract.tramitationType, contract.airtableData)) {
        const baseCode = contract.contractCode.split('-V')[0];
        const v0Date = version0ActivationDates.get(baseCode);
        if (v0Date) {
          actDate = v0Date;
        }
      }

      // Calculate days elapsed between activation and targetDate
      const diffTime = targetDate.getTime() - actDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 365) {
        // Fully amortized
        continue;
      }

      const commission = contract.commissionFinal!;
      const dailyCommission = commission / 365;
      const amortizedAmount = dailyCommission * diffDays;
      const activeRemaining = commission - amortizedAmount;

      if (activeRemaining > 0) {
        totalActiveCommission += activeRemaining;
        validContractsCount++;
        details.push({
          titular: contract.client?.businessName || '-',
          codigoContrato: contract.contractCode || '-',
          cups: contract.supplyPoint?.cups || '-',
          comisionOriginal: commission,
          parteAmortizada: amortizedAmount,
          parteActiva: activeRemaining
        });
      }
    }

    return { 
      success: true, 
      data: {
        totalActiveCommission,
        validContractsCount,
        targetDate: targetDate.toISOString(),
        details
      }
    };
  } catch (error: any) {
    console.error('Error calculando comisiones activas:', error);
    return { success: false, error: error.message };
  }
}
