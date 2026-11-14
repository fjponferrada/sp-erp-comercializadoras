import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { REGANECU_CONCEPT_ORDER } from '@/lib/reganecuShared';
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
      return NextResponse.json({ data: [], rawRecords: 0 });
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
    const startDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10), 1));

    const matricial = matricialStr === 'SI';
    const desglosarUpr = uprStr === 'SI';
    const page = Math.max(1, pageStr ? parseInt(pageStr, 10) || 1 : 1);
    const limit = Math.max(1, limitStr ? parseInt(limitStr, 10) || 100 : 100);

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

    const records = mergeDailyReganecuRecords(rawRecords, matricial);

    if (!matricial) {
      if (records.length === 0) {
        return NextResponse.json({ data: [], rawRecords: 0 });
      }

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

      if (Object.keys(aggregatedData).length === 0) {
        return NextResponse.json({ data: [], rawRecords: records.length });
      }

      let totalVentas = 0;
      let totalCompras = 0;
      let totalDer = 0;
      let totalOblig = 0;

      const tableData = Object.keys(aggregatedData)
        .map(c => {
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
            count: aggregatedData[c].count,
          };
        })
        .sort((a, b) => {
          const idxA = REGANECU_CONCEPT_ORDER.indexOf(a.concept);
          const idxB = REGANECU_CONCEPT_ORDER.indexOf(b.concept);
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
        count: 0,
      });

      return NextResponse.json({ data: tableData, rawRecords: records.length });
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

      const totalRows = allRows.length;
      const totalPages = Math.ceil(totalRows / limit);
      const startIndex = (page - 1) * limit;
      const paginatedRows = allRows.slice(startIndex, startIndex + limit);

      const processedRows = paginatedRows.map(row => ({
        ...row,
        energySaldo: row.energyVentas - row.energyCompras,
        costSaldo: row.costDerechos - row.costObligaciones,
      }));

      return NextResponse.json({
        data: processedRows,
        pagination: {
          page,
          limit,
          totalRecords: totalRows,
          totalPages,
        },
        rawRecords: records.length,
      });
    }
  } catch (error: any) {
    console.error('Error fetching Reganecu data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
