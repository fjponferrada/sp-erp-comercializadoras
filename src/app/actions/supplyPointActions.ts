'use server'

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

export async function getPaginatedSupplyPointsAction(page: number, limit: number, search: string = '') {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { success: false, error: 'Usuario no encontrado' };

  try {
    const skip = (page - 1) * limit;

    const { getSupplyPointVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getSupplyPointVisibilityFilter();

    let whereClause: any = {
      AND: [{ ...visibilityFilter }]
    };

    if (search.trim() !== '') {
      const isCupsSearch = search.toUpperCase().startsWith('ES') || /[A-Z0-9]{15,}/i.test(search);
      if (isCupsSearch) {
        whereClause.AND.push({ cups: { contains: search, mode: 'insensitive' } });
      } else {
        whereClause.AND.push({
          OR: [
            { cups: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            {
              client: {
                OR: [
                  { businessName: { contains: search, mode: 'insensitive' } },
                  { vatNumber: { contains: search, mode: 'insensitive' } }
                ]
              }
            }
          ]
        });
      }
    }

    const [totalCount, supplyPoints] = await Promise.all([
      prisma.supplyPoint.count({ where: whereClause }),
      prisma.supplyPoint.findMany({
        where: whereClause,
        include: {
          client: true,
          contracts: {
            where: { status: 'ACTIVO' },
            take: 1
          }
        },
        skip,
        take: limit,
        orderBy: { id: 'desc' }
      })
    ]);

    return { success: true, supplyPoints, totalCount };
  } catch (error: any) {
    console.error('Error in getPaginatedSupplyPointsAction:', error);
    return { success: false, error: error.message };
  }
}

export async function getSupplyPointDetailsAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    const { getSupplyPointVisibilityFilter, getUserVisibilityFilter } = await import('@/lib/permissions');
    const spFilter = await getSupplyPointVisibilityFilter();
    const contractFilter = await getUserVisibilityFilter();

    const supplyPoint = await prisma.supplyPoint.findFirst({
      where: { 
        id,
        AND: [spFilter]
      },
      include: {
        client: true,
        contracts: {
          where: contractFilter,
          orderBy: { createdAt: 'desc' },
          include: {
            product: true,
            user: true
          }
        }
      }
    });

    if (!supplyPoint) {
      return { success: false, error: 'Punto de suministro no encontrado' };
    }

    return { success: true, supplyPoint };
  } catch (error: any) {
    console.error('Error in getSupplyPointDetailsAction:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSupplyPointAction(id: string, data: any) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    const addressParts = [
      data.streetType,
      data.street,
      data.streetNumber ? `NÚM ${data.streetNumber}` : null,
      data.floor ? `Piso ${data.floor}` : null,
      data.door ? `Puerta ${data.door}` : null,
      data.addressAddition
    ].filter(Boolean);
    const computedAddress = addressParts.join(' ').trim();

    const { calculateSegment } = await import('@/lib/services/SegmentService');
    const newSegment = calculateSegment(
      data.tariff || null,
      data.annualConsumption ? parseFloat(data.annualConsumption) : null,
      data.p1c ? parseFloat(data.p1c) : null,
      data.cnae || null
    );

    const updated = await prisma.supplyPoint.update({
      where: { id },
      data: {
        segment: newSegment,
        address: computedAddress,
        streetType: data.streetType,
        street: data.street,
        streetNumber: data.streetNumber,
        floor: data.floor,
        door: data.door,
        addressAddition: data.addressAddition,
        postalCode: data.postalCode,
        city: data.city,
        province: data.province,
        tariff: data.tariff,
        annualConsumption: data.annualConsumption ? parseFloat(data.annualConsumption) : null,
        distributor: data.distributor,
        cnae: data.cnae,
        iban: data.iban,
        swift: data.swift,
        p1c: data.p1c ? parseFloat(data.p1c) : null,
        p2c: data.p2c ? parseFloat(data.p2c) : null,
        p3c: data.p3c ? parseFloat(data.p3c) : null,
        p4c: data.p4c ? parseFloat(data.p4c) : null,
        p5c: data.p5c ? parseFloat(data.p5c) : null,
        p6c: data.p6c ? parseFloat(data.p6c) : null,
        hasSelfConsumption: data.hasSelfConsumption === true || data.hasSelfConsumption === 'true',
        selfConsumptionType: data.selfConsumptionType || null,
        isBimonthly: data.isBimonthly === true || data.isBimonthly === 'true',
      }
    });

    revalidatePath('/puntos-suministro');
    revalidatePath(`/clientes/${updated.clientId}`);
    return { success: true, supplyPoint: updated };
  } catch (error: any) {
    console.error('Error in updateSupplyPointAction:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSupplyPointSipsAction(id: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: 'No autorizado' };
  }

  try {
    const supplyPoint = await prisma.supplyPoint.findUnique({
      where: { id },
      select: { cups: true }
    });

    if (!supplyPoint || !supplyPoint.cups) {
      return { success: false, error: 'Punto de suministro no encontrado o sin CUPS' };
    }

    const { getSipsData } = await import('@/lib/sips');
    const sipsData = await getSipsData(supplyPoint.cups);

    if (!sipsData || sipsData.result === 'ERROR') {
      return { 
        success: false, 
        error: sipsData?.message || 'Error al consultar INGEBAU (SIPS)' 
      };
    }

    // Actualizamos el JSON
    const updated = await prisma.supplyPoint.update({
      where: { id },
      data: {
        sipsRawData: sipsData as any
      }
    });

    revalidatePath(`/puntos-suministro/${id}`);
    
    return { success: true, sipsData: updated.sipsRawData };
  } catch (error: any) {
    console.error('Error in updateSupplyPointSipsAction:', error);
    return { success: false, error: error.message };
  }
}

export async function fetchSipsForPricingAction(cups: string) {
  try {
    const { getSipsData } = await import('@/lib/sips');
    const sipsData = await getSipsData(cups);

    if (!sipsData || sipsData.result === 'ERROR') {
      return { success: false, error: sipsData?.message || 'No hay datos suficientes en SIPS para este CUPS. Por favor, realiza un cálculo genérico.' };
    }

    let psData: any = null;
    const raw: any = sipsData;
    if (raw.data && raw.data.ps && raw.data.ps.length > 0) psData = raw.data.ps[0];
    else if (raw.ps && raw.ps.length > 0) psData = raw.ps[0];
    else if (raw.CUPS || raw.CNAE) psData = raw;

    if (!psData) {
      return { success: false, error: 'No se encontraron datos de suministro en la respuesta de SIPS. Por favor, realiza un cálculo genérico.' };
    }

    const tarifa = psData.TarifaATR || '';
    
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0, p6 = 0;
    
    // Si la API devuelve un desglose de consumos mensuales, calculamos el último año móvil (igual que con el CSV)
    const consumosArr = raw.data?.consumos || raw.consumos || [];
    
    if (consumosArr && Array.isArray(consumosArr) && consumosArr.length > 0) {
      let maxDate = 0;
      for (const row of consumosArr) {
        if (row.LecturaHasta) {
          const d = new Date(row.LecturaHasta).getTime();
          if (!isNaN(d) && d > maxDate) maxDate = d;
        }
      }
      
      const cutoff = maxDate > 0 ? maxDate - (365 * 24 * 60 * 60 * 1000) : 0;
      
      for (const row of consumosArr) {
        let rowMaxDate = 0;
        if (row.LecturaHasta) {
           const d = new Date(row.LecturaHasta).getTime();
           if (!isNaN(d)) rowMaxDate = d;
        }
        
        if (rowMaxDate > 0 && rowMaxDate < cutoff) continue;
        
        p1 += Number(row['EnergiaActivaP1(kWh)'] || row['energiaActivaP1(kWh)'] || 0);
        p2 += Number(row['EnergiaActivaP2(kWh)'] || row['energiaActivaP2(kWh)'] || 0);
        p3 += Number(row['EnergiaActivaP3(kWh)'] || row['energiaActivaP3(kWh)'] || 0);
        p4 += Number(row['EnergiaActivaP4(kWh)'] || row['energiaActivaP4(kWh)'] || 0);
        p5 += Number(row['EnergiaActivaP5(kWh)'] || row['energiaActivaP5(kWh)'] || 0);
        p6 += Number(row['EnergiaActivaP6(kWh)'] || row['energiaActivaP6(kWh)'] || 0);
      }
    } 
    
    // Fallback: si no hay array de consumos válido, usamos el acumulado anual de Ingebau
    if (p1+p2+p3+p4+p5+p6 === 0) {
      p1 = Number(psData.ConsumoAnualP1kWh) || 0;
      p2 = Number(psData.ConsumoAnualP2kWh) || 0;
      p3 = Number(psData.ConsumoAnualP3kWh) || 0;
      p4 = Number(psData.ConsumoAnualP4kWh) || 0;
      p5 = Number(psData.ConsumoAnualP5kWh) || 0;
      p6 = Number(psData.ConsumoAnualP6kWh) || 0;
    }

    if (p1+p2+p3+p4+p5+p6 === 0) {
      return { success: false, error: 'El SIPS no devolvió consumos (0 kWh). Por favor, realiza un cálculo genérico.' };
    }

    return { success: true, tarifa, consumos: { p1, p2, p3, p4, p5, p6 } };
  } catch (error: any) {
    return { success: false, error: 'Error de conexión con SIPS. Por favor, realiza un cálculo genérico.' };
  }
}
