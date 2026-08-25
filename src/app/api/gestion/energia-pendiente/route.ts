import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

    const results = await prisma.pendingEnergySummary.findMany({
      where: { 
        companyId: session.user.companyId,
        month: { lte: lastMonthStr }
      },
      orderBy: { month: 'desc' },
      take: 12
    });

    const enrichedResults = await Promise.all(results.map(async (row) => {
      const [year, month] = row.month.split('-');
      const startDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
      const endDate = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59));
      
      const curves = await prisma.aggregatedLoadCurve.findMany({
        where: {
          date: { gte: startDate, lte: endDate }
        },
        select: { totalConsumption: true }
      });
      
      let rawMwh = 0;
      for (const c of curves) {
        if (Array.isArray(c.totalConsumption)) {
          for (const val of c.totalConsumption as number[]) {
             rawMwh += Number(val) || 0;
          }
        }
      }
      rawMwh = rawMwh / 1000;
      
      let lossRatio = 1.15;
      if (rawMwh > 0 && row.estimatedBcMwh > 0) {
        lossRatio = row.estimatedBcMwh / rawMwh;
      }
      
      return { ...row, lossRatio };
    }));

    return NextResponse.json({ success: true, data: enrichedResults });
  } catch (error: any) {
    console.error('Error recuperando energía pendiente:', error);
    return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
  }
}
