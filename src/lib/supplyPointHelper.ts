import { PrismaClient } from '@prisma/client';

export async function findOrUpdateSupplyPointByCups(prisma: any, targetCups: string, clientId: string, createData: any) {
  if (!targetCups) return null;
  
  const cups20 = targetCups.substring(0, 20).toUpperCase();

  // Buscar por los primeros 20 caracteres y el cliente
  let supplyPoint = await prisma.supplyPoint.findFirst({
    where: { 
      cups: { startsWith: cups20 },
      clientId: clientId 
    },
    include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  if (supplyPoint) {
    // Si lo hemos encontrado y el que nos llega tiene más detalle (ej: 22 caracteres vs 20), lo actualizamos
    if (targetCups.length > supplyPoint.cups.length) {
      supplyPoint = await prisma.supplyPoint.update({
        where: { id: supplyPoint.id },
        data: { cups: targetCups.toUpperCase() },
        include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
    }
    return supplyPoint;
  }

  // Si no existe, lo creamos
  const { calculateSegment } = await import('./services/SegmentService');
  const newSegment = calculateSegment(
    createData.tariff || null,
    createData.annualConsumption || null,
    createData.p1c || null,
    createData.cnae || null
  );

  supplyPoint = await prisma.supplyPoint.create({
    data: {
      ...createData,
      segment: newSegment,
      cups: targetCups.toUpperCase(),
      clientId: clientId
    },
    include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  return supplyPoint;
}
