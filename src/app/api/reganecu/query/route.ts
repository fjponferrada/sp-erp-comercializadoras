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
    const dateStr = searchParams.get('date'); // e.g. "2026-05"
    const cierre = searchParams.get('cierre');
    const region = searchParams.get('region');
    const matricialStr = searchParams.get('matricial');
    const totalStr = searchParams.get('total');
    const uprStr = searchParams.get('upr');

    if (!dateStr || !cierre) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const [year, month] = dateStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 1)); // next month

    const matricial = matricialStr === 'SI';
    const total = totalStr === 'SI';
    const upr = uprStr === 'SI';

    const records = await prisma.reganecuData.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
        cierre: cierre,
        region: region || 'peninsula',
        matricial: matricial,
        total: total,
        upr: upr
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Aggregate monthly data by concept
    const aggregatedConcepts: Record<string, { energyVentas: number, energyCompras: number, costDerechos: number, costObligaciones: number, count: number }> = {};

    records.forEach(rec => {
      const data = rec.jsonData as Record<string, any>;
      for (const concept of Object.keys(data)) {
        if (!aggregatedConcepts[concept]) {
          aggregatedConcepts[concept] = { energyVentas: 0, energyCompras: 0, costDerechos: 0, costObligaciones: 0, count: 0 };
        }
        
        const vals = data[concept];
        // Handle both old format (energySum, costSum) and new format
        if (vals.energyVentas !== undefined) {
          aggregatedConcepts[concept].energyVentas += (vals.energyVentas || 0);
          aggregatedConcepts[concept].energyCompras += (vals.energyCompras || 0);
          aggregatedConcepts[concept].costDerechos += (vals.costDerechos || 0);
          aggregatedConcepts[concept].costObligaciones += (vals.costObligaciones || 0);
        } else {
          // Old data logic fallback: Assume everything is Ventas/Derechos just to not crash
          aggregatedConcepts[concept].energyVentas += (vals.energySum || 0);
          aggregatedConcepts[concept].costDerechos += (vals.costSum || 0);
        }
        
        aggregatedConcepts[concept].count += (vals.count || 0);
      }
    });

    const tableData = Object.keys(aggregatedConcepts).map(c => ({
      concept: c,
      energyVentas: aggregatedConcepts[c].energyVentas,
      energyCompras: aggregatedConcepts[c].energyCompras,
      energySaldo: aggregatedConcepts[c].energyVentas - aggregatedConcepts[c].energyCompras,
      costDerechos: aggregatedConcepts[c].costDerechos,
      costObligaciones: aggregatedConcepts[c].costObligaciones,
      costSaldo: aggregatedConcepts[c].costDerechos - aggregatedConcepts[c].costObligaciones,
      count: aggregatedConcepts[c].count
    })).sort((a, b) => a.concept.localeCompare(b.concept));

    return NextResponse.json({ data: tableData, rawRecords: records.length });
  } catch (error: any) {
    console.error('Error fetching Reganecu data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
