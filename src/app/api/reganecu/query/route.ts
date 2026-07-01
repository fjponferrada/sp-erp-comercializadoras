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
    const uprStr = searchParams.get('upr');
    const pageStr = searchParams.get('page');
    const limitStr = searchParams.get('limit');

    if (!dateStr || !cierre) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const [year, month] = dateStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 1));

    const matricial = matricialStr === 'SI';
    const desglosarUpr = uprStr === 'SI';
    const page = pageStr ? parseInt(pageStr) : 1;
    const limit = limitStr ? parseInt(limitStr) : 100;

    const rawRecords = await prisma.reganecuData.findMany({
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
        cierre: cierre,
        region: region || 'peninsula',
        matricial: matricial,
        total: !matricial, // If not matricial, fetch TOTAL
      },
      orderBy: {
        date: 'asc'
      }
    });

    const groupedByDate = new Map<string, any[]>();
    rawRecords.forEach(rec => {
      const d = rec.date.toISOString().split('T')[0];
      if (!groupedByDate.has(d)) groupedByDate.set(d, []);
      groupedByDate.get(d)!.push(rec);
    });

    const records = Array.from(groupedByDate.values()).map(recs => {
      const hRec = recs.find(r => r.resolution === 'H');
      const qhRec = recs.find(r => r.resolution === 'QH');

      if (matricial) {
        return qhRec || hRec!;
      } else {
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
      }
    });

    if (!matricial) {
      // TOTAL EMPRESA: Aggregate monthly data by concept
      const aggregatedData: Record<string, any> = {};

      records.forEach(rec => {
        const data = rec.jsonData as Record<string, any>;
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
      });

      let totalVentas = 0;
      let totalCompras = 0;
      let totalDer = 0;
      let totalOblig = 0;

      const ORDER = ['BS3', 'CBM', 'RAD3', 'CAD', 'DSV', 'PC3'];

      const tableData = Object.keys(aggregatedData).map(c => {
        totalVentas += aggregatedData[c].energyVentas;
        totalCompras += aggregatedData[c].energyCompras;
        totalDer += aggregatedData[c].costDerechos;
        totalOblig += aggregatedData[c].costObligaciones;
        
        return {
          concept: c,
          energyVentas: aggregatedData[c].energyVentas,
          energyCompras: aggregatedData[c].energyCompras,
          energySaldo: aggregatedData[c].energyVentas - aggregatedData[c].energyCompras,
          costDerechos: aggregatedData[c].costDerechos,
          costObligaciones: aggregatedData[c].costObligaciones,
          costSaldo: aggregatedData[c].costDerechos - aggregatedData[c].costObligaciones,
          count: aggregatedData[c].count
        };
      }).sort((a, b) => {
        const idxA = ORDER.indexOf(a.concept);
        const idxB = ORDER.indexOf(b.concept);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.concept.localeCompare(b.concept);
      });

      tableData.push({
        concept: 'Total',
        energyVentas: totalVentas,
        energyCompras: totalCompras,
        energySaldo: totalVentas - totalCompras,
        costDerechos: totalDer,
        costObligaciones: totalOblig,
        costSaldo: totalDer - totalOblig,
        count: 0
      });

      return NextResponse.json({ data: tableData, rawRecords: records.length });
    } else {
      // MATRICIAL: Aggregate quarter-hourly records by date, period, unit, (upr), concept
      const groupedRows = new Map<string, any>();

      records.forEach(rec => {
        const dateFormatted = rec.date.toISOString().split('T')[0]; // "YYYY-MM-DD"
        const arr = rec.jsonData as any[];
        
        if (Array.isArray(arr)) {
          arr.forEach(row => {
            const uprVal = desglosarUpr ? (row.upr || '') : '';
            const key = `${dateFormatted}_${row.period}_${row.unit}_${uprVal}_${row.concept}`;
            
            if (!groupedRows.has(key)) {
              groupedRows.set(key, {
                date: dateFormatted,
                period: row.period,
                unit: row.unit,
                upr: uprVal,
                concept: row.concept,
                energyVentas: 0,
                energyCompras: 0,
                costDerechos: 0,
                costObligaciones: 0
              });
            }
            const existing = groupedRows.get(key)!;
            existing.energyVentas += (row.energyVentas || 0);
            existing.energyCompras += (row.energyCompras || 0);
            existing.costDerechos += (row.costDerechos || 0);
            existing.costObligaciones += (row.costObligaciones || 0);
          });
        }
      });

      // Convert to array and sort
      const allRows = Array.from(groupedRows.values());
      allRows.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.period !== b.period) return a.period - b.period;
        if (a.unit !== b.unit) return a.unit.localeCompare(b.unit);
        if (a.upr !== b.upr) return a.upr.localeCompare(b.upr);
        return a.concept.localeCompare(b.concept);
      });

      // Pagination
      const totalRows = allRows.length;
      const totalPages = Math.ceil(totalRows / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedRows = allRows.slice(startIndex, endIndex);

      // Add pre-calculated derived fields
      const processedRows = paginatedRows.map(row => ({
        ...row,
        energySaldo: row.energyVentas - row.energyCompras,
        costSaldo: row.costDerechos - row.costObligaciones
      }));

      return NextResponse.json({ 
        data: processedRows, 
        pagination: {
          page,
          limit,
          totalRecords: totalRows,
          totalPages
        },
        rawRecords: records.length 
      });
    }
  } catch (error: any) {
    console.error('Error fetching Reganecu data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
