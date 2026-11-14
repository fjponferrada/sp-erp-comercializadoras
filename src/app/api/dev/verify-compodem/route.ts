import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs';

export async function GET() {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const csvPath = 'Z:/AED/Tarifas/SCRIPT_PERFILADO_AVANZADO/COTIZADOR/COMPODEM/202603/CARGA_BD_REE_AUTOMATICA.csv';
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({ error: 'Archivo CSV de verificación local no disponible en este entorno.' }, { status: 404 });
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim().length > 0);
    const dataRows = csvContent.slice(1);
    const startDate = new Date('2026-03-01T00:00:00.000Z');
    const endDate = new Date('2026-03-31T00:00:00.000Z');

    const dbData = await prisma.systemComponentPrice.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const dbMap = new Map();
    for (const row of dbData) {
      const dStr = row.date.toISOString().split('T')[0];
      if (!dbMap.has(dStr)) dbMap.set(dStr, {});
      dbMap.get(dStr)[row.component] = row.values;
    }

    const row0 = dataRows[0].split(';');
    const dateStr = row0[0];
    const yyyymmdd = dateStr.substring(0, 10);
    const hourMatch = dateStr.match(/T(\d{2}):/);
    const hour = hourMatch ? parseInt(hourMatch[1], 10) : 0;

    const dbDay = dbMap.get(yyyymmdd);
    if (!dbDay) {
      return NextResponse.json({ error: `No DB data for ${yyyymmdd}` });
    }

    const csvRestricciones = parseFloat(row0[1].replace(',', '.'));
    const csvOS = parseFloat(row0[2].replace(',', '.'));
    const csvTotal = parseFloat(row0[3].replace(',', '.'));
    const csvBALX = parseFloat(row0[4].replace(',', '.'));
    const csvCT2 = parseFloat(row0[7].replace(',', '.'));
    const csvCT3 = parseFloat(row0[8].replace(',', '.'));

    const result = {
      date: yyyymmdd,
      hour,
      RESTRICCIONES: { db: dbDay['RESTRICCIONES']?.[hour], csv: csvRestricciones, diff: Math.abs((dbDay['RESTRICCIONES']?.[hour] ?? 0) - csvRestricciones) },
      OS: { db: dbDay['OS']?.[hour], csv: csvOS, diff: Math.abs((dbDay['OS']?.[hour] ?? 0) - csvOS) },
      TOTAL_COMPODEM: { db: dbDay['TOTAL_COMPODEM']?.[hour], csv: csvTotal, diff: Math.abs((dbDay['TOTAL_COMPODEM']?.[hour] ?? 0) - csvTotal) },
      BALX: { db: dbDay['BALX']?.[hour], csv: csvBALX, diff: Math.abs((dbDay['BALX']?.[hour] ?? 0) - csvBALX) },
      CT2: { db: dbDay['CT2']?.[hour], csv: csvCT2, diff: Math.abs((dbDay['CT2']?.[hour] ?? 0) - csvCT2) },
      CT3: { db: dbDay['CT3']?.[hour], csv: csvCT3, diff: Math.abs((dbDay['CT3']?.[hour] ?? 0) - csvCT3) },
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error en /api/dev/verify-compodem:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
