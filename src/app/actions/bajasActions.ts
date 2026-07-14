'use server';

import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';

export async function getPaginatedBajasAction(
  page: number,
  itemsPerPage: number,
  search: string,
  motivoFilter: string
) {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    let whereClause: any = {
      ...visibilityFilter,
      status: { in: ['BAJA', 'FINALIZADO'] },
      supplyPoint: {
        contracts: {
          none: {
            status: { in: ['ACTIVO', 'TRAMITANDO', 'VERIFICANDO_FIRMA', 'ACEPTADO'] }
          }
        }
      }
    };

    if (search) {
      whereClause.OR = [
        { contractCode: { contains: search, mode: 'insensitive' } },
        { supplyPoint: { cups: { contains: search, mode: 'insensitive' } } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } },
        { client: { firstName: { contains: search, mode: 'insensitive' } } },
        { client: { lastName: { contains: search, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Puesto que motivoFilter actual está hardcodeado a "Fin de permanencia", simulamos:
    if (motivoFilter !== 'TODOS') {
      if (motivoFilter !== 'Fin de permanencia') {
        return { success: true, bajas: [], totalCount: 0 };
      }
    }

    const totalCount = await prisma.contract.count({ where: whereClause });

    const dbBajas = await prisma.contract.findMany({
      where: whereClause,
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        user: { include: { channel: true } },
        Lead: true
      },
      orderBy: { terminationDate: 'desc' },
      skip: (page - 1) * itemsPerPage,
      take: itemsPerPage
    });

    const bajasData = dbBajas.map((b: any) => {
      const dAlta = b.activationDate ? new Date(b.activationDate) : new Date();
      const dBaja = b.terminationDate ? new Date(b.terminationDate) : new Date();
      const diffTime = Math.abs(dBaja.getTime() - dAlta.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: b.id,
        cups: b.supplyPoint?.cups || 'Desconocido',
        cliente: b.client?.businessName || `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim() || 'Desconocido',
        clientId: b.clientId,
        telefono: b.client?.contactPhone || null,
        email: b.client?.contactEmail || null,
        tarifa: b.supplyPoint?.tariff || '2.0TD',
        mwh: b.supplyPoint?.annualConsumption || 0,
        fechaAlta: b.activationDate?.toISOString().split('T')[0] || '-',
        fechaBaja: b.terminationDate?.toISOString().split('T')[0] || '-',
        motivo: 'Fin de permanencia', // Airtable no tiene este campo exacto
        canal: b.user?.channel?.name || b.Lead?.source || 'Directo',
        producto: b.product?.name || 'Desconocido',
        diasVida: diffDays,
        hasSelfConsumption: b.supplyPoint?.hasSelfConsumption || false
      };
    });

    return { success: true, bajas: bajasData, totalCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getBajasStatsAction() {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    const dbBajas = await prisma.contract.findMany({
      where: {
        ...visibilityFilter,
        status: { in: ['BAJA', 'FINALIZADO'] },
        supplyPoint: {
          contracts: {
            none: {
              status: { in: ['ACTIVO', 'TRAMITANDO', 'VERIFICANDO_FIRMA', 'ACEPTADO'] }
            }
          }
        }
      },
      select: {
        activationDate: true,
        terminationDate: true,
        supplyPointId: true,
        supplyPoint: { select: { annualConsumption: true } }
      }
    });

    const totalCount = dbBajas.length;
    let totalMwhPerdido = 0;
    let totalDiasVidaContrato = 0;
    let bajasEsteMes = 0;

    const now = new Date();
    
    // Agrupar por CUPS para calcular vida real del cliente
    const cupsLifespan: Record<string, { minAlta: Date, maxBaja: Date }> = {};

    for (const b of dbBajas) {
      totalMwhPerdido += b.supplyPoint?.annualConsumption || 0;
      
      const dAlta = b.activationDate ? new Date(b.activationDate) : new Date();
      const dBaja = b.terminationDate ? new Date(b.terminationDate) : new Date();
      const diffTime = Math.abs(dBaja.getTime() - dAlta.getTime());
      totalDiasVidaContrato += Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (b.supplyPointId) {
        if (!cupsLifespan[b.supplyPointId]) {
          cupsLifespan[b.supplyPointId] = { minAlta: dAlta, maxBaja: dBaja };
        } else {
          if (dAlta < cupsLifespan[b.supplyPointId].minAlta) {
            cupsLifespan[b.supplyPointId].minAlta = dAlta;
          }
          if (dBaja > cupsLifespan[b.supplyPointId].maxBaja) {
            cupsLifespan[b.supplyPointId].maxBaja = dBaja;
          }
        }
      }

      if (
        b.terminationDate &&
        b.terminationDate.getMonth() === now.getMonth() &&
        b.terminationDate.getFullYear() === now.getFullYear()
      ) {
        bajasEsteMes++;
      }
    }

    let totalClientDias = 0;
    let cupsCount = 0;
    for (const [, span] of Object.entries(cupsLifespan)) {
      const diffTime = Math.abs(span.maxBaja.getTime() - span.minAlta.getTime());
      totalClientDias += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      cupsCount++;
    }

    const avgDiasContrato = totalCount > 0 ? Math.round(totalDiasVidaContrato / totalCount) : 0;
    const avgDiasCliente = cupsCount > 0 ? Math.round(totalClientDias / cupsCount) : 0;

    return {
      success: true,
      stats: {
        totalBajas: totalCount,
        bajasEsteMes,
        totalMwhPerdido,
        avgDias: avgDiasContrato,
        avgClientDias: avgDiasCliente
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
