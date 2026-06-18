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

    // Prepare CSV content matching the python script format exactly
    let csvContent = 'fecha_hora;consumo_kwh;segmento\n';

    for (const lc of loadCurves) {
      // lc.date is a UTC Date representing the day (e.g., 2025-04-12T00:00:00.000Z)
      // We must treat this as "April 12th Local Time" to avoid DST shifts
      const ymd = lc.date.toISOString().split('T')[0];
      const localMidnight = fromZonedTime(ymd + ' 00:00:00', 'Europe/Madrid');
      
      const isHourly = lc.resolution === 'HOURLY';
      const intervals = lc.readings.length;
      const minutesPerInterval = isHourly ? 60 : 15;

      for (let i = 0; i < intervals; i++) {
        const intervalTime = addMinutes(localMidnight, i * minutesPerInterval);
        const localTime = toZonedTime(intervalTime, 'Europe/Madrid');
        const dateStr = format(localTime, 'yyyy-MM-dd HH:mm:ss');
        
        const consumo = lc.readings[i];
        const consumoStr = consumo.toString().replace('.', ',');
        const segmento = ''; 
        
        csvContent += `${dateStr};${consumoStr};${segmento}\n`;
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
