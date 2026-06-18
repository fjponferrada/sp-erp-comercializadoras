import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { format, addHours, addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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
    // Include the whole end day
    endDate.setUTCHours(23, 59, 59, 999);

    const loadCurves = await prisma.loadCurve.findMany({
      where: {
        cups: cups,
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
      const baseDate = new Date(lc.date);
      const isHourly = lc.resolution === 'HOURLY';
      const intervals = lc.readings.length;
      const minutesPerInterval = isHourly ? 60 : 15;

      for (let i = 0; i < intervals; i++) {
        // En España el primer periodo suele ser la hora 1 (de 00:00 a 01:00)
        // La etiqueta temporal suele marcar el inicio o el fin de la hora. El script en python lo dejaba como string.
        // Vamos a calcular el momento exacto. Si el array tiene 24 items, i=0 es la primera hora.
        // Asumiendo que el "fecha_hora" marca el INICIO del periodo:
        const intervalTime = addMinutes(baseDate, i * minutesPerInterval);
        
        // Convert to local time string '%Y-%m-%d %H:%M:%S'
        const localTime = toZonedTime(intervalTime, 'Europe/Madrid');
        const dateStr = format(localTime, 'yyyy-MM-dd HH:mm:ss');
        
        const consumo = lc.readings[i];
        // Formato español: decimal con coma
        const consumoStr = consumo.toString().replace('.', ',');
        
        // El script de python tenia segmento, aquí lo dejamos vacío por ahora ya que no hay info de segmento
        // O ponemos el source temporalmente
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
