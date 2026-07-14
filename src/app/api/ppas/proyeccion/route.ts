import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDaysInMonth } from 'date-fns';

export async function POST(request: Request) {
  try {
    const { ppaId } = await request.json();

    if (!ppaId) {
      return NextResponse.json({ error: 'Falta ppaId' }, { status: 400 });
    }

    const ppa = await prisma.ppa.findUnique({
      where: { id: ppaId }
    });

    if (!ppa) {
      return NextResponse.json({ error: 'PPA no encontrado' }, { status: 404 });
    }

    const now = new Date();
    // Empezamos desde el día 1 del mes actual
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    // 12 meses vista (el día 0 del mes actual + 12 es el último día del mes 11)
    const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 12, 0, 23, 59, 59, 999));

    const futureData = await prisma.portfolioBaseCurve.findMany({
      where: {
        datetime: {
          gte: start,
          lte: end
        }
      },
      orderBy: { datetime: 'asc' }
    });

    if (futureData.length === 0) {
      return NextResponse.json({ error: 'No hay datos de proyección en la curva base. Ejecuta la sincronización del portfolio en Pricing.' }, { status: 404 });
    }

    const monthlySummary: Record<string, any> = {};
    const isFijo = ppa.priceType === 'FIJO';
    const priceValue = ppa.priceValue || 0;
    const profileData = ppa.profileData ? (ppa.profileData as any[]) : null;

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    for (const record of futureData) {
      const date = record.datetime;
      const month = date.getUTCMonth(); // 0-11
      const year = date.getUTCFullYear();
      const hour = date.getUTCHours();
      const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;

      if (!monthlySummary[monthKey]) {
        monthlySummary[monthKey] = {
          monthKey,
          monthStr: `${monthNames[month]} ${year}`,
          totalMwh: 0,
          totalEur: 0,
          omieNumerator: 0,
          hours: 0
        };
      }

      let mwThisHour = 0;
      if (ppa.subtype === 'CARGA_BASE') {
        mwThisHour = ppa.basePowerMw || 0;
      } else if (ppa.subtype === 'PERFIL_FIJO' && profileData) {
        if (profileData[month] && profileData[month][hour] !== undefined) {
           const daysInMonth = getDaysInMonth(date);
           // profileData guarda MWh totales mensuales para esa hora.
           // Para sacar el MW promedio de una hora concreta, dividimos por días del mes.
           mwThisHour = Number(profileData[month][hour]) / daysInMonth;
        }
      }

      const mwh = mwThisHour;
      
      let liquidacionEur = 0;
      if (isFijo) {
        // CfD
        const diferencial = record.omiePriceEurMwh - priceValue;
        liquidacionEur = mwh * diferencial;
      } else {
        const cost = record.omiePriceEurMwh + priceValue;
        liquidacionEur = mwh * cost;
      }

      monthlySummary[monthKey].totalMwh += mwh;
      monthlySummary[monthKey].totalEur += liquidacionEur;
      monthlySummary[monthKey].omieNumerator += (record.omiePriceEurMwh * mwh);
      monthlySummary[monthKey].hours += 1;
    }

    const results = Object.keys(monthlySummary).sort().map(key => {
      const data = monthlySummary[key];
      const omieMedio = data.totalMwh > 0 ? (data.omieNumerator / data.totalMwh) : 0;
      return {
        monthKey: key,
        monthStr: data.monthStr,
        totalMwh: data.totalMwh,
        totalEur: data.totalEur,
        omieMedio,
        isFijo
      };
    });

    return NextResponse.json({ success: true, projection: results });

  } catch (error: any) {
    console.error('Error calculando proyección:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
