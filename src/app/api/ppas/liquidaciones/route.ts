import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDaysInMonth } from 'date-fns';

export async function POST(request: Request) {
  try {
    const { ppaId, startDate, endDate } = await request.json();

    if (!ppaId || !startDate || !endDate) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const ppa = await prisma.ppa.findUnique({
      where: { id: ppaId }
    });

    if (!ppa) {
      return NextResponse.json({ error: 'PPA no encontrado' }, { status: 404 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Ensure end date includes the whole day
    if (start.getTime() === end.getTime()) {
      end.setHours(23, 59, 59, 999);
    } else {
      end.setHours(23, 59, 59, 999);
    }

    // Fetch OMIE prices for the date range
    const omiePrices = await prisma.systemComponentPrice.findMany({
      where: {
        component: 'OMIE',
        date: {
          gte: start,
          lte: end
        }
      },
      orderBy: { date: 'asc' }
    });

    if (omiePrices.length === 0) {
      return NextResponse.json({ error: 'No hay precios de OMIE para este rango de fechas' }, { status: 404 });
    }

    let totalMwh = 0;
    let totalEur = 0;
    let omieMedioPpaNumerator = 0;
    const detailedRows = [];

    const profileData = ppa.profileData ? (ppa.profileData as any) : null;
    const isFijo = ppa.priceType === 'FIJO';
    const priceValue = ppa.priceValue || 0;

    for (const dailyData of omiePrices) {
      const dateStr = dailyData.date.toISOString().split('T')[0];
      const month = dailyData.date.getMonth(); // 0-11
      const daysInMonth = getDaysInMonth(dailyData.date);
      
      const values = dailyData.values; // 96 values usually
      
      for (let i = 0; i < values.length; i++) {
        const omiePrice = values[i];
        const hour = Math.floor(i / 4);
        
        let mwhQuarter = 0;

        if (ppa.type === 'FISICO' && ppa.subtype === 'CARGA_BASE') {
          const mw = ppa.basePowerMw || 0;
          mwhQuarter = mw / 4; // 15 mins
        } else if (ppa.type === 'FINANCIERO' && ppa.subtype === 'PERFIL_FIJO' && profileData) {
          // profileData is a 12x24 array.
          // Handle DST edge cases if there are more than 24 hours (e.g. 25h = 100 intervals)
          const profileHour = Math.min(hour, 23); 
          const monthlyMwhForHour = profileData[month] ? profileData[month][profileHour] || 0 : 0;
          const dailyMwhForHour = monthlyMwhForHour / daysInMonth;
          mwhQuarter = dailyMwhForHour / 4; 
        }

        let liquidacionEur = 0;
        let appliedPrice = 0;

        if (isFijo) {
          // CfD
          const diferencial = omiePrice - priceValue;
          liquidacionEur = mwhQuarter * diferencial;
          appliedPrice = diferencial;
        } else {
          // Indexado
          const cost = omiePrice + priceValue; // fee
          liquidacionEur = mwhQuarter * cost;
          appliedPrice = cost;
        }

        totalMwh += mwhQuarter;
        totalEur += liquidacionEur;
        omieMedioPpaNumerator += (omiePrice * mwhQuarter);

        // Generate a datetime string for the row
        const minutes = (i % 4) * 15;
        const hourStr = hour.toString().padStart(2, '0');
        const minStr = minutes.toString().padStart(2, '0');
        const dtString = `${dateStr} ${hourStr}:${minStr}`;

        detailedRows.push({
          datetime: dtString,
          omie: omiePrice,
          mwh: mwhQuarter,
          appliedPrice,
          liquidacionEur
        });
      }
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const expectedDays = Math.round((end.getTime() - start.getTime() + 1) / msPerDay);
    const calculatedDays = omiePrices.length;
    const missingDays = expectedDays > calculatedDays ? expectedDays - calculatedDays : 0;

    const omieMedioPpa = totalMwh > 0 ? (omieMedioPpaNumerator / totalMwh) : 0;

    return NextResponse.json({
      summary: {
        totalMwh,
        totalEur,
        omieMedioPpa,
        isFijo,
        missingDays
      },
      details: detailedRows
    });

  } catch (error: any) {
    console.error('Error calculando liquidacion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
