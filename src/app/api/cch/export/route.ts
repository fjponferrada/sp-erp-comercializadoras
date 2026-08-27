import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { format, addHours, addMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const cups = url.searchParams.get('cups');
    const startStr = url.searchParams.get('start');
    const endStr = url.searchParams.get('end');

    if (!cups || !startStr || !endStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    // Igual que el script en python, recortamos a 20 caracteres por si acaso 
    // y buscamos con startsWith ya que el histórico del PKL venía sin los dígitos de control
    const searchCups = cups.substring(0, 20);

    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: { startsWith: searchCups },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    if (loadCurves.length === 0) {
      return NextResponse.json({ error: 'No data found for this period' }, { status: 404 });
    }

    const consumptionCurves = loadCurves.filter(lc => lc.type === 'CONSUMPTION');
    const surplusCurves = loadCurves.filter(lc => lc.type === 'SURPLUS');

    let hasSurplus = false;
    for (const sc of surplusCurves) {
      if (sc.readings.some(val => val > 0)) {
        hasSurplus = true;
        break;
      }
    }

    // Prepare CSV content matching the python script format exactly
    let csvContent = hasSurplus 
      ? 'fecha_hora;consumo_kwh;excedentes_kwh;segmento\n' 
      : 'fecha_hora;consumo_kwh;segmento\n';

    const uniqueDates = Array.from(new Set(loadCurves.map(lc => lc.date.toISOString().split('T')[0]))).sort();
    
    const consumptionMap = new Map();
    for (const cc of consumptionCurves) {
      consumptionMap.set(cc.date.toISOString().split('T')[0], cc);
    }
    
    const surplusMap = new Map();
    for (const sc of surplusCurves) {
      surplusMap.set(sc.date.toISOString().split('T')[0], sc);
    }

    for (const ymd of uniqueDates) {
      const cc = consumptionMap.get(ymd);
      const sc = surplusMap.get(ymd);
      const refCurve = cc || sc; // At least one must exist for this date
      
      const localMidnight = fromZonedTime(ymd + ' 00:00:00', 'Europe/Madrid');
      
      const isHourly = refCurve.resolution === 'HOURLY';
      const intervals = refCurve.readings.length;
      const minutesPerInterval = isHourly ? 60 : 15;

      for (let i = 0; i < intervals; i++) {
        // En España el estándar (y REE) suele usar "Hour-Ending" (Fin de hora)
        const intervalTime = addMinutes(localMidnight, (i + 1) * minutesPerInterval);
        const localTime = toZonedTime(intervalTime, 'Europe/Madrid');
        const dateStr = format(localTime, 'yyyy-MM-dd HH:mm:ss');
        
        const consumo = cc ? (cc.readings[i] || 0) : 0;
        const consumoStr = consumo.toString().replace('.', ',');
        
        const segmento = ''; 
        
        if (hasSurplus) {
          const surplus = sc ? (sc.readings[i] || 0) : 0;
          const surplusStr = surplus.toString().replace('.', ',');
          csvContent += `${dateStr};${consumoStr};${surplusStr};${segmento}\n`;
        } else {
          csvContent += `${dateStr};${consumoStr};${segmento}\n`;
        }
      }
    }

    // Nombre idéntico al del script python: curva_CUPS_YYYYMMDD-YYYYMMDD.csv
    const fIni = format(startDate, 'yyyyMMdd');
    const fFin = format(new Date(endStr), 'yyyyMMdd'); // use original end string for filename
    const filename = `curva_${cups}_${fIni}-${fFin}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error: any) {
    console.error('Error exporting CCH:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
