import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

const PRIORIDAD_MAP: Record<string, number> = {
  F1: 100, C1: 100, Q1: 100, F1H: 100, F1QH: 100,
  F5D: 90, A5D: 80, B5D: 80,
  P5D: 40,
  P1: 20, P1D: 20, P2: 20, P2D: 20,
  P0: 10
};

const UMBRAL_MAX = 2000.0; // Rechazar si un cuarto de hora / hora es > 2000 kWh

export interface ParseResult {
  success: number;
  skipped: number;
  errors: number;
}

export function getFilePriority(filename: string): number {
  const upper = filename.toUpperCase();
  let maxPrio = 0;
  for (const [key, value] of Object.entries(PRIORIDAD_MAP)) {
    if (upper.includes(key) && value > maxPrio) {
      maxPrio = value;
    }
  }
  return maxPrio;
}

export function isFileProvisional(filename: string): boolean {
  return filename.toUpperCase().includes('P');
}

export async function processCchCsv(
  csvContent: string,
  filename: string,
  source: string = 'UPLOAD'
): Promise<ParseResult> {
  const priority = getFilePriority(filename);
  const isProvisional = isFileProvisional(filename);
  
  const parsed = Papa.parse(csvContent, {
    delimiter: ';',
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error('Failed to parse CSV');
  }

  const dailyData = new Map<string, { cups: string, date: string, readings: number[] }>();

  let skipped = 0;
  let errors = 0;

  for (const row of parsed.data as string[][]) {
    if (row.length < 3) {
      skipped++;
      continue;
    }

    const cups = row[0]?.trim()?.substring(0, 20);
    const dateStr = row[1]?.trim();
    const consumoStr = row[2]?.trim()?.replace(',', '.');

    if (!cups || !dateStr || !consumoStr) {
      skipped++;
      continue;
    }

    const consumo = parseFloat(consumoStr);
    if (isNaN(consumo) || consumo > UMBRAL_MAX) {
      skipped++;
      continue;
    }

    let dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      const parts = dateStr.split(' ');
      if (parts.length >= 2) {
        const dParts = parts[0].split('/');
        if (dParts.length === 3) {
          dateObj = new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}T${parts[1]}`);
        }
      }
    }

    if (isNaN(dateObj.getTime())) {
      errors++;
      continue;
    }

    const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const mapKey = `${cups}_${dayKey}`;

    if (!dailyData.has(mapKey)) {
      const emptyReadings = new Array(96).fill(0);
      dailyData.set(mapKey, { cups, date: dayKey, readings: emptyReadings });
    }

    const entry = dailyData.get(mapKey)!;
    
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const index = (hours * 4) + Math.floor(minutes / 15);
    
    entry.readings[index] = consumo;
  }

  let success = 0;
  
  for (const [mapKey, data] of dailyData.entries()) {
    let isQuarterHourly = false;
    for (let i = 0; i < 96; i++) {
      if (i % 4 !== 0 && data.readings[i] !== 0) {
        isQuarterHourly = true;
        break;
      }
    }

    let finalReadings = data.readings;
    let resolution: 'HOURLY' | 'QUARTER_HOURLY' = 'QUARTER_HOURLY';
    if (!isQuarterHourly) {
      finalReadings = finalReadings.filter((_, i) => i % 4 === 0);
      resolution = 'HOURLY';
    }

    const dateIso = new Date(`${data.date}T00:00:00.000Z`);

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.loadCurve.findUnique({
          where: {
            cups_date: {
              cups: data.cups,
              date: dateIso
            }
          }
        });

        if (existing) {
          if (!existing.isProvisional && isProvisional) {
            return;
          }
          await tx.loadCurve.update({
            where: { id: existing.id },
            data: {
              readings: finalReadings,
              resolution,
              isProvisional,
              source
            }
          });
        } else {
          await tx.loadCurve.create({
            data: {
              cups: data.cups,
              date: dateIso,
              readings: finalReadings,
              resolution,
              isProvisional,
              source
            }
          });
        }
      });
      success++;
    } catch (e) {
      console.error(`Error saving load curve for ${data.cups} on ${data.date}:`, e);
      errors++;
    }
  }

  return { success, skipped, errors };
}
