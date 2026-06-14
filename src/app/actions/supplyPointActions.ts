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

    const { getClientVisibilityFilter } = await import('@/lib/permissions');
    const visibilityFilter = await getClientVisibilityFilter();

    const whereClause: any = {
      client: visibilityFilter
    };

    if (search.trim() !== '') {
      const isCupsSearch = search.toUpperCase().startsWith('ES') || /[A-Z0-9]{15,}/i.test(search);
      if (isCupsSearch) {
        whereClause.cups = { contains: search, mode: 'insensitive' };
      } else {
        whereClause.OR = [
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
        ];
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
    const supplyPoint = await prisma.supplyPoint.findUnique({
      where: { id },
      include: {
        client: true,
        contracts: {
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

    const updated = await prisma.supplyPoint.update({
      where: { id },
      data: {
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
