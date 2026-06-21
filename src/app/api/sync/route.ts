import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET() {
  try {
    const service = await prisma.additionalService.findFirst({
      where: { name: { contains: 'Factura', mode: 'insensitive' } }
    });

    if (!service) {
      return NextResponse.json({ error: "Servicio no encontrado" });
    }

    const contracts = await prisma.contract.findMany({
      where: {
        airtableData: { not: Prisma.AnyNull }
      },
      include: {
        AdditionalService: true
      }
    });

    let updatedCount = 0;
    const results = [];

    for (const c of contracts) {
      const data = c.airtableData as any;
      if (!data || typeof data !== 'object') continue;

      const servicioField = data['Servicio'];
      if (!servicioField) continue;

      let hasTargetService = false;
      const targetIds = ['recQ2kTt4tTJLimlb', 'rec4m16hzWuPSCFC7'];

      if (Array.isArray(servicioField)) {
        hasTargetService = servicioField.some(id => targetIds.includes(id));
      } else if (typeof servicioField === 'string') {
        hasTargetService = targetIds.some(id => servicioField.includes(id));
      }

      if (hasTargetService) {
        const alreadyConnected = c.AdditionalService.some(s => s.id === service.id);
        
        let snapshot = c.additionalServicesSnapshot;
        let snapshotArr: any[] = [];
        if (snapshot && Array.isArray(snapshot)) {
          snapshotArr = snapshot;
        }

        const alreadyInSnapshot = snapshotArr.some(s => s.id === service.id);

        if (!alreadyConnected || !alreadyInSnapshot) {
          if (!alreadyInSnapshot) {
            snapshotArr.push({
              id: service.id,
              name: service.name,
              monthlyPrice: service.monthlyPrice,
              dailyPrice: service.dailyPrice,
              isCommissionable: service.isCommissionable
            });
          }

          await prisma.contract.update({
            where: { id: c.id },
            data: {
              AdditionalService: {
                connect: [{ id: service.id }]
              },
              additionalServicesSnapshot: snapshotArr
            }
          });
          updatedCount++;
          results.push(`Updated ${c.contractCode || c.id}`);
        }
      }
    }

    return NextResponse.json({ success: true, updatedCount, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
