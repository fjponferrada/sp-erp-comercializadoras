import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se ha adjuntado ningún fichero.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const content = buffer.toString('utf8');

    // The ESIOS XLS files are often HTML tables.
    const $ = cheerio.load(content);
    const rows = $('tr');
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'El fichero no tiene el formato esperado (no se encontraron filas).' }, { status: 400 });
    }

    const dataByDate = new Map<string, number[]>();

    rows.each((i, row) => {
      const tds = $(row).find('td');
      if (tds.length >= 6) {
        const valueStr = $(tds[4]).text().trim().replace('.', '').replace(',', '.');
        const datetimeStr = $(tds[5]).text().trim();
        
        const value = parseFloat(valueStr);
        if (isNaN(value)) return;

        // Parse datetime (e.g. 2026-07-01T09:30:00+02:00)
        // We extract the local date and time parts directly from the string to avoid timezone shifts
        // Format is usually YYYY-MM-DDTHH:mm:ss+TZ:00
        const match = datetimeStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}/);
        if (!match) return;

        const dateKey = match[1]; // YYYY-MM-DD
        const hour = parseInt(match[2], 10);
        const minute = parseInt(match[3], 10);

        const quarterIndex = (hour * 4) + (minute / 15);

        if (!dataByDate.has(dateKey)) {
          dataByDate.set(dateKey, Array(96).fill(0));
        }

        const dailyValues = dataByDate.get(dateKey)!;
        if (quarterIndex >= 0 && quarterIndex < 96) {
          dailyValues[quarterIndex] = value;
        }
      }
    });

    if (dataByDate.size === 0) {
      return NextResponse.json({ error: 'No se pudieron extraer datos de OMIE del fichero.' }, { status: 400 });
    }

    let inserted = 0;

    for (const [dateStr, values] of Array.from(dataByDate.entries())) {
      const dateObj = new Date(`${dateStr}T00:00:00.000Z`); // Store in UTC midnight
      
      const existing = await prisma.systemComponentPrice.findUnique({
        where: {
          component_date: {
            component: 'OMIE',
            date: dateObj
          }
        }
      });

      if (existing) {
        await prisma.systemComponentPrice.update({
          where: { id: existing.id },
          data: { values, version: 'IMPORT' }
        });
      } else {
        await prisma.systemComponentPrice.create({
          data: {
            component: 'OMIE',
            date: dateObj,
            values,
            version: 'IMPORT'
          }
        });
      }
      inserted++;
    }

    return NextResponse.json({ success: true, message: `Se han actualizado ${inserted} días de OMIE.` });
  } catch (error: any) {
    console.error('Error importando OMIE:', error);
    return NextResponse.json({ error: 'Error procesando el fichero: ' + error.message }, { status: 500 });
  }
}
