import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const region = searchParams.get('region');

    if (!dateStr) {
      return NextResponse.json({ error: 'Falta mes' }, { status: 400 });
    }

    const [year, month] = dateStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 1));

    const rawRecords = await prisma.reganecuData.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
        region: region || 'peninsula',
        total: true,
      }
    });

    const summaryByCierre: Record<string, number> = {};

    // Group by cierre
    const groupedByCierre = new Map<string, any[]>();
    rawRecords.forEach(rec => {
      if (!groupedByCierre.has(rec.cierre)) groupedByCierre.set(rec.cierre, []);
      groupedByCierre.get(rec.cierre)!.push(rec);
    });

    for (const [cierre, recs] of Array.from(groupedByCierre.entries())) {
      // Deduplicate by date (H vs QH logic)
      const groupedByDate = new Map<string, any[]>();
      recs.forEach(rec => {
        const d = rec.date.toISOString().split('T')[0];
        if (!groupedByDate.has(d)) groupedByDate.set(d, []);
        groupedByDate.get(d)!.push(rec);
      });

      const deduplicatedRecords = Array.from(groupedByDate.values()).map(rList => {
        const hRec = rList.find(r => r.resolution === 'H');
        const qhRec = rList.find(r => r.resolution === 'QH');

        if (qhRec && hRec) {
          return {
            ...qhRec,
            jsonData: {
              ...(hRec.jsonData as any),
              ...(qhRec.jsonData as any)
            }
          };
        }
        return qhRec || hRec!;
      });

      // Sum everything for this cierre
      let totalDer = 0;
      let totalOblig = 0;

      deduplicatedRecords.forEach(rec => {
        const data = rec.jsonData as Record<string, any>;
        for (const concept of Object.keys(data)) {
          const vals = data[concept];
          if (vals.costDerechos !== undefined) {
            totalDer += (vals.costDerechos || 0);
            totalOblig += (vals.costObligaciones || 0);
          } else {
            totalDer += (vals.costSum || 0);
          }
        }
      });

      summaryByCierre[cierre] = totalDer - totalOblig;
    }

    return NextResponse.json({ summary: summaryByCierre });
  } catch (error: any) {
    console.error('Error fetching Reganecu summary:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
