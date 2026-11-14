import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  isComprasAuthorized,
  mergeDailyReganecuRecords,
  resolveActiveCompanyId,
} from '@/lib/reganecuServer';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!isComprasAuthorized(session)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = await resolveActiveCompanyId(session!.user);
    if (!companyId) {
      return NextResponse.json({ summary: {} });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const region = searchParams.get('region');

    if (!dateStr || !/^\d{4}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'Falta mes válido' }, { status: 400 });
    }

    const [year, month] = dateStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10), 1));

    const rawRecords = await prisma.reganecuData.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lt: endDate,
        },
        region: region || 'peninsula',
        total: true,
      },
    });

    const summaryByCierre: Record<string, number> = {};

    const groupedByCierre = new Map<string, any[]>();
    rawRecords.forEach(rec => {
      if (!groupedByCierre.has(rec.cierre)) groupedByCierre.set(rec.cierre, []);
      groupedByCierre.get(rec.cierre)!.push(rec);
    });

    for (const [cierre, recs] of Array.from(groupedByCierre.entries())) {
      const mergedRecords = mergeDailyReganecuRecords(recs, false);

      let totalDer = 0;
      let totalOblig = 0;

      mergedRecords.forEach(rec => {
        const data = rec.jsonData as Record<string, any>;
        for (const concept of Object.keys(data)) {
          const vals = data[concept];
          totalDer += vals.costDerechos || 0;
          totalOblig += vals.costObligaciones || 0;
        }
      });

      summaryByCierre[cierre.toUpperCase()] = totalDer - totalOblig;
    }

    return NextResponse.json({ summary: summaryByCierre });
  } catch (error: any) {
    console.error('Error fetching Reganecu summary:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
