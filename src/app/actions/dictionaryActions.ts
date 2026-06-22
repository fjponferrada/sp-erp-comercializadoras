'use server';

import { prisma } from '@/lib/prisma';

export async function getProvincesAction() {
  try {
    const provinces = await prisma.province.findMany({
      orderBy: { name: 'asc' }
    });
    return { success: true, data: provinces };
  } catch (error: any) {
    console.error("Error fetching provinces:", error);
    return { error: error.message || 'Error al obtener provincias' };
  }
}

export async function getMunicipalitiesAction(provinceId?: string) {
  try {
    const whereClause = provinceId ? { provinceId } : {};
    const municipalities = await prisma.municipality.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });
    return { success: true, data: municipalities };
  } catch (error: any) {
    console.error("Error fetching municipalities:", error);
    return { error: error.message || 'Error al obtener poblaciones' };
  }
}

export async function getAdditionalServicesAction() {
  try {
    const services = await prisma.additionalService.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    return { success: true, data: services };
  } catch (error: any) {
    console.error("Error fetching services:", error);
    return { error: error.message || 'Error al obtener servicios' };
  }
}
