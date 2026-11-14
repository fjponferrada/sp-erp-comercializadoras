import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import * as xlsx from 'xlsx';
import { REGANECU_CONCEPT_MAP, REGANECU_CONCEPT_ORDER } from '@/lib/reganecuShared';
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
      return NextResponse.json({ error: 'No se encontró comercializadora activa' }, { status: 400 });
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
    const startDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10), 1));

    const matricial = matricialStr === 'SI';
    const desglosarUpr = uprStr === 'SI';

    const rawRecords = await prisma.reganecuData.findMany({
      where: {
        companyId,
        date: {
          gte: startDate,
          lt: endDate,
        },
        cierre,
        region: region || 'peninsula',
        matricial,
        total: !matricial,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Regla 137: Fusión inteligente H + QH idéntica al visor para evitar duplicar CBM o perder CAD/PC3
    const records = mergeDailyReganecuRecords(rawRecords, matricial);

    let exportRows: any[] = [];

    if (!matricial) {
      const aggregatedData: Record<string, any> = {};

      records.forEach(rec => {
        const data = rec.jsonData as Record<string, any>;
        for (const concept of Object.keys(data)) {
          if (!aggregatedData[concept]) {
            aggregatedData[concept] = {
              energyVentas: 0,
              energyCompras: 0,
              costDerechos: 0,
              costObligaciones: 0,
              count: 0,
            };
          }

          const vals = data[concept];
          aggregatedData[concept].energyVentas += vals.energyVentas || 0;
          aggregatedData[concept].energyCompras += vals.energyCompras || 0;
          aggregatedData[concept].costDerechos += vals.costDerechos || 0;
          aggregatedData[concept].costObligaciones += vals.costObligaciones || 0;
          aggregatedData[concept].count += vals.count || 0;
        }
      });

      let totalVentas = 0;
      let totalCompras = 0;
      let totalDer = 0;
      let totalOblig = 0;

      exportRows = Object.keys(aggregatedData)
        .map(c => {
          const energyVentas = aggregatedData[c].energyVentas;
          const energyCompras = aggregatedData[c].energyCompras;
          const costDerechos = aggregatedData[c].costDerechos;
          const costObligaciones = aggregatedData[c].costObligaciones;

          totalVentas += energyVentas;
          totalCompras += energyCompras;
          totalDer += costDerechos;
          totalOblig += costObligaciones;

          return {
            Concepto: REGANECU_CONCEPT_MAP[c] || c,
            'Energía Ventas (MWh)': energyVentas,
            'Energía Compras (MWh)': energyCompras,
            'Energía Saldo (MWh)': energyVentas - energyCompras,
            'Derechos Cobro (EUR)': costDerechos,
            'Obligaciones Pago (EUR)': costObligaciones,
            'Importe Saldo (EUR)': costDerechos - costObligaciones,
            'Precio Medio Venta (EUR/MWh)': energyVentas > 0 ? costDerechos / energyVentas : 0,
            'Precio Medio Compra (EUR/MWh)': energyCompras > 0 ? costObligaciones / energyCompras : 0,
            _rawConcept: c,
          };
        })
        .sort((a, b) => {
          const idxA = REGANECU_CONCEPT_ORDER.indexOf(a._rawConcept);
          const idxB = REGANECU_CONCEPT_ORDER.indexOf(b._rawConcept);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a._rawConcept.localeCompare(b._rawConcept);
        })
        .map(({ _rawConcept, ...rest }) => rest);

      if (exportRows.length > 0) {
        exportRows.push({
          Concepto: 'Total',
          'Energía Ventas (MWh)': totalVentas,
          'Energía Compras (MWh)': totalCompras,
          'Energía Saldo (MWh)': totalVentas - totalCompras,
          'Derechos Cobro (EUR)': totalDer,
          'Obligaciones Pago (EUR)': totalOblig,
          'Importe Saldo (EUR)': totalDer - totalOblig,
          'Precio Medio Venta (EUR/MWh)': totalVentas > 0 ? totalDer / totalVentas : 0,
          'Precio Medio Compra (EUR/MWh)': totalCompras > 0 ? totalOblig / totalCompras : 0,
        });
      }
    } else {
      const groupedRows = new Map<string, any>();

      records.forEach(rec => {
        const dateFormatted = rec.date.toISOString().split('T')[0];
        const arr = rec.jsonData as any[];

        if (Array.isArray(arr)) {
          arr.forEach(row => {
            const uprVal = desglosarUpr ? row.upr || '' : '';
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
                costObligaciones: 0,
              });
            }
            const existing = groupedRows.get(key)!;
            existing.energyVentas += row.energyVentas || 0;
            existing.energyCompras += row.energyCompras || 0;
            existing.costDerechos += row.costDerechos || 0;
            existing.costObligaciones += row.costObligaciones || 0;
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

      let totalVentas = 0;
      let totalCompras = 0;
      let totalDer = 0;
      let totalOblig = 0;

      exportRows = allRows.map(row => {
        totalVentas += row.energyVentas;
        totalCompras += row.energyCompras;
        totalDer += row.costDerechos;
        totalOblig += row.costObligaciones;

        const base: any = {
          Día: row.date,
          Periodo: row.period,
          Unidad: row.unit,
        };

        if (desglosarUpr) {
          base['UPR'] = row.upr;
        }

        base['Concepto'] = REGANECU_CONCEPT_MAP[row.concept] || row.concept;
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

      if (exportRows.length > 0) {
        const totalRow: any = {
          Día: 'Total',
          Periodo: '',
          Unidad: '',
        };
        if (desglosarUpr) {
          totalRow['UPR'] = '';
        }
        totalRow['Concepto'] = 'Total';
        totalRow['Energía Ventas (MWh)'] = totalVentas;
        totalRow['Energía Compras (MWh)'] = totalCompras;
        totalRow['Energía Saldo (MWh)'] = totalVentas - totalCompras;
        totalRow['Derechos Cobro (EUR)'] = totalDer;
        totalRow['Obligaciones Pago (EUR)'] = totalOblig;
        totalRow['Importe Saldo (EUR)'] = totalDer - totalOblig;
        totalRow['Precio Medio Venta (EUR/MWh)'] = totalVentas > 0 ? totalDer / totalVentas : 0;
        totalRow['Precio Medio Compra (EUR/MWh)'] = totalCompras > 0 ? totalOblig / totalCompras : 0;
        exportRows.push(totalRow);
      }
    }

    const worksheet = xlsx.utils.json_to_sheet(exportRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Liquidaciones');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const headers = new Headers();
    headers.set(
      'Content-Disposition',
      `attachment; filename="reganecu_${matricial ? 'matricial' : 'total'}_${dateStr}_${cierre}.xlsx"`
    );
    headers.set(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return new NextResponse(buffer, { headers });
  } catch (error: any) {
    console.error('Error exporting Reganecu data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
