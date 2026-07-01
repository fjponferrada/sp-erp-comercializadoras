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

    // If matricial or upr, the jsonData has { [unit]: { [concept]: data } }
    // If total, the jsonData has { [concept]: data }
    const isGrouped = matricial || upr;

    // Aggregate monthly data by concept or by unit->concept
    const aggregatedData: Record<string, any> = {};

    records.forEach(rec => {
      const data = rec.jsonData as Record<string, any>;
      
      if (isGrouped) {
        for (const unit of Object.keys(data)) {
          if (!aggregatedData[unit]) aggregatedData[unit] = {};
          for (const concept of Object.keys(data[unit])) {
            if (!aggregatedData[unit][concept]) {
              aggregatedData[unit][concept] = { energyVentas: 0, energyCompras: 0, costDerechos: 0, costObligaciones: 0, count: 0 };
            }
            
            const vals = data[unit][concept];
            if (vals.energyVentas !== undefined) {
              aggregatedData[unit][concept].energyVentas += (vals.energyVentas || 0);
              aggregatedData[unit][concept].energyCompras += (vals.energyCompras || 0);
              aggregatedData[unit][concept].costDerechos += (vals.costDerechos || 0);
              aggregatedData[unit][concept].costObligaciones += (vals.costObligaciones || 0);
            } else {
              aggregatedData[unit][concept].energyVentas += (vals.energySum || 0);
              aggregatedData[unit][concept].costDerechos += (vals.costSum || 0);
            }
            aggregatedData[unit][concept].count += (vals.count || 0);
          }
        }
      } else {
        for (const concept of Object.keys(data)) {
          if (!aggregatedData[concept]) {
            aggregatedData[concept] = { energyVentas: 0, energyCompras: 0, costDerechos: 0, costObligaciones: 0, count: 0 };
          }
          
          const vals = data[concept];
          if (vals.energyVentas !== undefined) {
            aggregatedData[concept].energyVentas += (vals.energyVentas || 0);
            aggregatedData[concept].energyCompras += (vals.energyCompras || 0);
            aggregatedData[concept].costDerechos += (vals.costDerechos || 0);
            aggregatedData[concept].costObligaciones += (vals.costObligaciones || 0);
          } else {
            aggregatedData[concept].energyVentas += (vals.energySum || 0);
            aggregatedData[concept].costDerechos += (vals.costSum || 0);
          }
          aggregatedData[concept].count += (vals.count || 0);
        }
      }
    });

    const formatTableData = (aggObj: Record<string, any>) => {
      return Object.keys(aggObj).map(c => ({
        concept: c,
        energyVentas: aggObj[c].energyVentas,
        energyCompras: aggObj[c].energyCompras,
        energySaldo: aggObj[c].energyVentas - aggObj[c].energyCompras,
        costDerechos: aggObj[c].costDerechos,
        costObligaciones: aggObj[c].costObligaciones,
        costSaldo: aggObj[c].costDerechos - aggObj[c].costObligaciones,
        count: aggObj[c].count
      })).sort((a, b) => a.concept.localeCompare(b.concept));
    };

    if (isGrouped) {
      const unitsData: Record<string, any> = {};
      for (const unit of Object.keys(aggregatedData)) {
        unitsData[unit] = formatTableData(aggregatedData[unit]);
      }
      return NextResponse.json({ units: unitsData, rawRecords: records.length });
    } else {
      const tableData = formatTableData(aggregatedData);
      return NextResponse.json({ data: tableData, rawRecords: records.length });
    }
  } catch (error: any) {
    console.error('Error fetching Reganecu data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
