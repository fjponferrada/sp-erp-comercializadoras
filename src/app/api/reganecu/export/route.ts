import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';

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

    if (!dateStr || !cierre) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const [year, month] = dateStr.split('-');
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 1)); // next month

    const matricial = matricialStr === 'SI';
    const desglosarUpr = uprStr === 'SI';

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

    const records = rawRecords;

    let exportRows: any[] = [];

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

      exportRows = Object.keys(aggregatedData).map(c => {
        const energyVentas = aggregatedData[c].energyVentas;
        const energyCompras = aggregatedData[c].energyCompras;
        const costDerechos = aggregatedData[c].costDerechos;
        const costObligaciones = aggregatedData[c].costObligaciones;
        
        totalVentas += energyVentas;
        totalCompras += energyCompras;
        totalDer += costDerechos;
        totalOblig += costObligaciones;

        // Map description or use raw concept
        const CONCEPT_MAP: Record<string, string> = {
          'BS3': 'Banda Secundaria CF',
          'RAD3': 'Coste a BRP servicio de respuesta activa',
          'CAD': 'Costes asignados a la demanda',
          'PC3': 'Pagos capacidad (Financiación)',
          'DSV': 'Desvíos',
          'CBM': 'Contratos bilaterales mercado'
        };

        return {
          'Concepto': CONCEPT_MAP[c] || c,
          'Energía Ventas (MWh)': energyVentas,
          'Energía Compras (MWh)': energyCompras,
          'Energía Saldo (MWh)': energyVentas - energyCompras,
          'Derechos Cobro (EUR)': costDerechos,
          'Obligaciones Pago (EUR)': costObligaciones,
          'Importe Saldo (EUR)': costDerechos - costObligaciones,
          'Precio Medio Venta (EUR/MWh)': energyVentas > 0 ? costDerechos / energyVentas : 0,
          'Precio Medio Compra (EUR/MWh)': energyCompras > 0 ? costObligaciones / energyCompras : 0,
          '_rawConcept': c // Used for sorting
        };
      }).sort((a, b) => {
        const idxA = ORDER.indexOf(a._rawConcept);
        const idxB = ORDER.indexOf(b._rawConcept);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a._rawConcept.localeCompare(b._rawConcept);
      }).map(r => {
        delete (r as any)._rawConcept;
        return r;
      });

      exportRows.push({
        'Concepto': 'Total',
        'Energía Ventas (MWh)': totalVentas,
        'Energía Compras (MWh)': totalCompras,
        'Energía Saldo (MWh)': totalVentas - totalCompras,
        'Derechos Cobro (EUR)': totalDer,
        'Obligaciones Pago (EUR)': totalOblig,
        'Importe Saldo (EUR)': totalDer - totalOblig,
        'Precio Medio Venta (EUR/MWh)': 0,
        'Precio Medio Compra (EUR/MWh)': 0,
      });


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

      const allRows = Array.from(groupedRows.values());
      allRows.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.period !== b.period) return a.period - b.period;
        if (a.unit !== b.unit) return a.unit.localeCompare(b.unit);
        if (a.upr !== b.upr) return a.upr.localeCompare(b.upr);
        return a.concept.localeCompare(b.concept);
      });

      exportRows = allRows.map(row => {
        const base: any = {
          'Día': row.date,
          'Periodo': row.period,
          'Unidad': row.unit,
        };
        
        if (desglosarUpr) {
          base['UPR'] = row.upr;
        }
        
        base['Concepto'] = row.concept;
        base['Energía Ventas (MWh)'] = row.energyVentas;
        base['Energía Compras (MWh)'] = row.energyCompras;
        base['Energía Saldo (MWh)'] = row.energyVentas - row.energyCompras;
        base['Derechos Cobro (EUR)'] = row.costDerechos;
        base['Obligaciones Pago (EUR)'] = row.costObligaciones;
        base['Importe Saldo (EUR)'] = row.costDerechos - row.costObligaciones;
        base['Precio Medio Venta (EUR/MWh)'] = row.energyVentas > 0 ? row.costDerechos / row.energyVentas : 0;
        base['Precio Medio Compra (EUR/MWh)'] = row.energyCompras > 0 ? row.costObligaciones / row.energyCompras : 0;
        
        return base;
      });
    }

    const worksheet = xlsx.utils.json_to_sheet(exportRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Liquidaciones');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const headers = new Headers();
    headers.set('Content-Disposition', `attachment; filename="reganecu_${matricial ? 'matricial' : 'total'}_${dateStr}.xlsx"`);
    headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    return new NextResponse(buffer, { headers });

  } catch (error: any) {
    console.error('Error exporting Reganecu data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
