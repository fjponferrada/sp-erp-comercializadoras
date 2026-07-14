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
    
    const dataByDateRaw = new Map<string, { hour: number, minute: number, value: number }[]>();

    if (rows.length > 0) {
      // Parse ESIOS HTML
      rows.each((i, row) => {
        const tds = $(row).find('td');
        if (tds.length >= 6) {
          let valueStr = $(tds[4]).text().trim();
          if (valueStr.includes(',')) {
            valueStr = valueStr.replace(/\./g, '').replace(',', '.');
          }
          const datetimeStr = $(tds[5]).text().trim();
          
          const value = parseFloat(valueStr);
          if (isNaN(value)) return;

          const match = datetimeStr.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}/);
          if (!match) return;

          const dateKey = match[1];
          const hour = parseInt(match[2], 10);
          const minute = parseInt(match[3], 10);

          if (!dataByDateRaw.has(dateKey)) {
            dataByDateRaw.set(dateKey, []);
          }
          dataByDateRaw.get(dateKey)!.push({ hour, minute, value });
        }
      });
    } else {
      // Try parsing as real Excel / CSV using xlsx library
      try {
        const xlsx = require('xlsx');
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        for (const row of data as any[]) {
          if (!Array.isArray(row)) continue;
          
          let dtMatch = null;
          let value = NaN;
          
          for (let c = 0; c < row.length; c++) {
            const cell = String(row[c]).trim();
            const match = cell.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):\d{2}/);
            if (match) {
              dtMatch = match;
              if (c > 0) {
                if (typeof row[c-1] === 'number') {
                  value = row[c-1];
                } else {
                  let valCell = String(row[c-1]).trim();
                  if (valCell.includes(',')) {
                    valCell = valCell.replace(/\./g, '').replace(',', '.');
                  }
                  value = parseFloat(valCell);
                }
              }
              break;
            }
          }
          
          if (!dtMatch || isNaN(value)) continue;
          
          const dateKey = dtMatch[1];
          const hour = parseInt(dtMatch[2], 10);
          const minute = parseInt(dtMatch[3], 10);
          
          if (!dataByDateRaw.has(dateKey)) {
            dataByDateRaw.set(dateKey, []);
          }
          dataByDateRaw.get(dateKey)!.push({ hour, minute, value });
        }
      } catch (e) {
        console.error('Error parsing xlsx:', e);
      }
    }

    if (dataByDateRaw.size === 0) {
      return NextResponse.json({ error: 'No se pudieron extraer datos de OMIE del fichero.' }, { status: 400 });
    }

    let inserted = 0;

    for (const [dateStr, tuples] of Array.from(dataByDateRaw.entries())) {
      const dateObj = new Date(`${dateStr}T00:00:00.000Z`); // Store in UTC midnight
      
      const isQuarterly = tuples.some(t => t.minute !== 0) || tuples.length > 25;
      let values: number[];
      
      if (isQuarterly) {
        const maxQ = Math.max(95, Math.max(...tuples.map(t => (t.hour * 4) + (t.minute / 15))));
        values = Array(maxQ + 1).fill(0);
        for (const t of tuples) {
          const qIdx = (t.hour * 4) + (t.minute / 15);
          if (qIdx >= 0) values[qIdx] = t.value;
        }
      } else {
        const maxH = Math.max(23, Math.max(...tuples.map(t => t.hour)));
        values = Array(maxH + 1).fill(0);
        for (const t of tuples) {
          if (t.hour >= 0) values[t.hour] = t.value;
        }
      }
      
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
