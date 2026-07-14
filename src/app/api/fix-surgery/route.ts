import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const c0True = await prisma.contract.findFirst({
      where: { supplyPoint: { cups: 'ES0031104442493001QW0F' }, version: 0 }
    });

    const c1 = await prisma.contract.findFirst({ 
      where: { supplyPoint: { cups: 'ES0031104442493001QW0F' }, version: 1 },
      include: { client: true }
    });
    
    const c2 = await prisma.contract.findFirst({ 
      where: { supplyPoint: { cups: 'ES0031104442493001QW0F' }, version: 2 },
      include: { client: true }
    });

    const clientB88 = await prisma.client.findFirst({
      where: { vatNumber: 'B88759287' }
    });

    if (c1 && c0True && c2) {
      let v1ActDate = new Date('2026-04-28T00:00:00Z');
      let v1TermDate = new Date(c2.activationDate || '2026-06-23T00:00:00Z');
      v1TermDate.setDate(v1TermDate.getDate() - 1);

      await prisma.contract.update({
        where: { id: c1.id },
        data: {
          status: 'FINALIZADO',
          activationDate: v1ActDate,
          terminationDate: v1TermDate
        }
      });

      if (clientB88) {
        await prisma.contract.update({
          where: { id: c2.id },
          data: {
            clientId: clientB88.id
          }
        });
        
        if (['ACTIVO', 'ACTIVE', 'Activo'].includes(c2.status)) {
          await prisma.supplyPoint.update({
            where: { id: c2.supplyPointId },
            data: {
              clientId: clientB88.id
            }
          });
        }
      }
      return NextResponse.json({ success: true, message: "Surgery completed." });
    } else {
      return NextResponse.json({ success: false, message: "Missing contracts" });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
