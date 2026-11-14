import { PrismaClient } from '@prisma/client';
import { normalizeSpanishPostalCode, pickSpanishPostalCode } from './postalCode';

export async function findOrUpdateSupplyPointByCups(prisma: any, targetCups: string, clientId: string, createData: any) {
  if (!targetCups) return null;
  
  const cups20 = targetCups.substring(0, 20).toUpperCase();
  const normalizedIncomingCp = normalizeSpanishPostalCode(createData?.postalCode, '00000');

  // Buscar por los primeros 20 caracteres y el cliente actual
  let supplyPoint = await prisma.supplyPoint.findFirst({
    where: { 
      cups: { startsWith: cups20 },
      clientId: clientId
    },
    include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  if (supplyPoint) {
    const healedCp = pickSpanishPostalCode(supplyPoint.postalCode, normalizedIncomingCp, supplyPoint.sipsPostalCode) || '00000';
    const needsCupsUpgrade = targetCups.length > supplyPoint.cups.length;
    const needsCpHeal = healedCp !== supplyPoint.postalCode;

    // Si el CUPS llega con más detalle (22 vs 20) o el CP almacenado perdió el cero inicial / era 00000, lo saneamos
    if (needsCupsUpgrade || needsCpHeal) {
      supplyPoint = await prisma.supplyPoint.update({
        where: { id: supplyPoint.id },
        data: {
          ...(needsCupsUpgrade ? { cups: targetCups.toUpperCase() } : {}),
          ...(needsCpHeal ? { postalCode: healedCp } : {}),
        },
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
      postalCode: normalizedIncomingCp,
      ...(createData?.sipsPostalCode ? { sipsPostalCode: normalizeSpanishPostalCode(createData.sipsPostalCode) } : {}),
      segment: newSegment,
      cups: targetCups.toUpperCase(),
      clientId: clientId
    },
    include: { contracts: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  return supplyPoint;
}
