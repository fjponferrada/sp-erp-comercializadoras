import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const f1 = await prisma.f1Invoice.findFirst({
      where: { contract: { supplyPoint: { cups: 'ES0031405446869086QD0F' } } }
    });
    if (!f1) return NextResponse.json({ error: "no f1" });

    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: 'ES0031405446869086QD0F',
        date: {
          gte: f1.fechaInicio || undefined,
          lte: f1.fechaFin || undefined
        }
      }
    });

    return NextResponse.json({
      count: loadCurves.length,
      firstDate: loadCurves[0]?.date,
      lastDate: loadCurves[loadCurves.length - 1]?.date,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
