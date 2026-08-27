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
  
  // C1 son cierres mensuales (CIE), no tienen perfil horario. Saltarlos aquí.
  if (filename.toUpperCase().includes('C1')) {
    return { success: 0, skipped: 1, errors: 0 };
  }
  
  // Limpiar caracteres nulos (0x00) que causan errores en PostgreSQL
  const cleanCsvContent = csvContent.replace(/\0/g, '');

  const parsed = Papa.parse(cleanCsvContent, {
    delimiter: ';',
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error('Failed to parse CSV');
  }

  const dailyData = new Map<string, { cups: string, date: string, type: string, readings: number[] }>();

  let skipped = 0;
  let errors = 0;

  const is5D = filename.toUpperCase().includes('5D');

  const uniqueCups = Array.from(new Set((parsed.data as string[][]).map(row => row[0]?.trim()?.substring(0, 20)).filter(Boolean)));
  const sps = await prisma.supplyPoint.findMany({
    where: { cups: { in: uniqueCups as string[] } },
    select: { cups: true, segment: true, tariff: true }
  });
  const segmentMap = new Map<string, string>();
  for (const sp of sps) {
    segmentMap.set(sp.cups, sp.segment || sp.tariff || '');
  }

  for (const row of parsed.data as string[][]) {
    if (row.length < 3) {
      skipped++;
      continue;
    }

    // Lógica CNMC:
    // 5D (F5D/P5D): CUPS(0), Fecha(1), Bandera(2), AE(3), AS(4), R1(5)
    // No-5D (F1/C1): CUPS(0), Tipo(1), Fecha(2), Bandera(3), AE(4), AS(5), R1(6)
    // Diarios (P1/P1D/P2): CUPS(0), Tipo(1), Fecha(2), Bandera(3), AE(4), CalidadAE(5), AS(6), CalidadAS(7)
    const upperName = filename.toUpperCase();
    const isP1 = upperName.includes('P1') || upperName.includes('P2');
    const isF1 = upperName.includes('F1') || upperName.includes('C1') || upperName.includes('Q1');
    
    const idxDate = is5D ? 1 : 2;
    const idxConsumo = is5D ? 3 : 4;
    
    let idxSurplus = -1;
    if (is5D) {
      idxSurplus = 4;
    } else if (isP1) {
      idxSurplus = 6;
    } else if (isF1) {
      idxSurplus = 5;
    }

    const cups = row[0]?.trim()?.substring(0, 20);
    const dateStr = row[idxDate]?.trim();
    const consumoStr = row[idxConsumo]?.trim()?.replace(',', '.');
    const surplusStr = row[idxSurplus]?.trim()?.replace(',', '.');

    if (!cups || !dateStr || !consumoStr) {
      skipped++;
      continue;
    }

    let consumo = parseFloat(consumoStr);
    if (isNaN(consumo) || consumo < 0) {
      consumo = 0; // Fallback para no saltar la fila si hay excedentes válidos
    }

    let surplus = 0;
    let hasSurplusColumn = false;
    if (surplusStr !== undefined && surplusStr !== '') {
      hasSurplusColumn = true;
      surplus = parseFloat(surplusStr);
      if (isNaN(surplus) || surplus < 0) {
        surplus = 0;
      }
    }

    // --- LÓGICA DE UNIDADES ---
    if (is5D) {
      consumo = consumo / 1000.0;
      if (hasSurplusColumn) surplus = surplus / 1000.0;
    } else {
      const seg = (segmentMap.get(cups) || '').toUpperCase();
      const isVip = seg.includes('VIP') || seg.includes('>50');
      const currentUmbral = isVip ? 2000.0 : 300.0;
      
      if (consumo > currentUmbral) {
        consumo = consumo / 1000.0;
      }
      if (hasSurplusColumn && surplus > currentUmbral) {
        surplus = surplus / 1000.0;
      }
    }

    // --- PARSEO Y AJUSTE DE FECHA (UTC -1h) ---
    let dateObj: Date;
    const parts = dateStr.split(' ');
    
    if (parts[0].includes('/')) {
      const dParts = parts[0].split('/');
      if (dParts[0] && dParts[0].length === 4) {
        dateObj = new Date(`${dParts[0]}-${dParts[1]}-${dParts[2]}T${parts[1] || '00:00'}Z`);
      } else if (dParts[2] && dParts[2].length === 4) {
        dateObj = new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}T${parts[1] || '00:00'}Z`);
      } else {
        dateObj = new Date(dateStr); 
      }
    } else if (parts[0].includes('-')) {
      const dParts = parts[0].split('-');
      if (dParts[0] && dParts[0].length === 4) {
        dateObj = new Date(`${dParts[0]}-${dParts[1]}-${dParts[2]}T${parts[1] || '00:00'}Z`);
      } else if (dParts[2] && dParts[2].length === 4) {
        dateObj = new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}T${parts[1] || '00:00'}Z`);
      } else {
        dateObj = new Date(dateStr); 
      }
    } else {
      dateObj = new Date(dateStr);
    }

    if (isNaN(dateObj.getTime())) {
      errors++;
      continue;
    }

    // Restar 1 hora según la lógica V22 del Python (el dato viene marcado al final del periodo)
    dateObj.setHours(dateObj.getHours() - 1);

    const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const index = (hours * 4) + Math.floor(minutes / 15);

    // Consumo (CONSUMPTION)
    const mapKeyConsumo = `${cups}_${dayKey}_CONSUMPTION`;
    if (!dailyData.has(mapKeyConsumo)) {
      dailyData.set(mapKeyConsumo, { cups, date: dayKey, type: 'CONSUMPTION', readings: new Array(96).fill(0) });
    }
    dailyData.get(mapKeyConsumo)!.readings[index] = consumo;

    // Excedentes (SURPLUS) - Solo registrar si la columna existe en el fichero
    if (hasSurplusColumn) {
      const mapKeySurplus = `${cups}_${dayKey}_SURPLUS`;
      if (!dailyData.has(mapKeySurplus)) {
        dailyData.set(mapKeySurplus, { cups, date: dayKey, type: 'SURPLUS', readings: new Array(96).fill(0) });
      }
      dailyData.get(mapKeySurplus)!.readings[index] = surplus;
    }
  }

  let success = 0;
  
  // Transform map to array for batch processing
  const allData = Array.from(dailyData.values()).map(data => {
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

    return {
      cups: data.cups,
      dateIso: new Date(`${data.date}T00:00:00.000Z`),
      type: data.type as 'CONSUMPTION' | 'SURPLUS',
      finalReadings,
      resolution,
      isProvisional,
      source
    };
  });

  // Optimizacion: Si una curva de SURPLUS es 100% ceros, la filtramos para no inundar la BD.
  // Pero OJO: Si ya existe en la BD un archivo con SURPLUS > 0, esto no lo sobreescribirá con ceros.
  // Como los excedentes no suelen "desaparecer", y para no generar un volumen brutal de datos inútiles, filtramos.
  const allDataFiltered = allData.filter(d => {
    if (d.type === 'SURPLUS') {
      return d.finalReadings.some(val => val > 0);
    }
    return true;
  });

  const BATCH_SIZE = 250;
  for (let i = 0; i < allDataFiltered.length; i += BATCH_SIZE) {
    const batch = allDataFiltered.slice(i, i + BATCH_SIZE);
    
    try {
      // 1. Fetch existing records for this batch
      const uniqueCups = Array.from(new Set(batch.map(b => b.cups)));
      const uniqueDates = Array.from(new Set(batch.map(b => b.dateIso.toISOString())));

      const existingRecords = await prisma.loadCurve.findMany({
        where: {
          cups: { in: uniqueCups },
          date: { in: uniqueDates.map(d => new Date(d)) }
        },
        select: { id: true, cups: true, date: true, type: true, isProvisional: true, readings: true, resolution: true, source: true }
      });

      const existingMap = new Map();
      for (const rec of existingRecords) {
        existingMap.set(`${rec.cups}_${rec.date.toISOString()}_${rec.type}`, rec);
      }

      // 2. Separate into creates and updates
      const creates: any[] = [];
      const updates: any[] = [];

      for (const item of batch) {
        const key = `${item.cups}_${item.dateIso.toISOString()}_${item.type}`;
        const existing = existingMap.get(key);

        if (existing) {
          // Proteger los datos del PKL (Prioridad Máxima)
          if (existing.source === 'MIGRACION_PKL') {
            skipped++;
            continue;
          }

          if (!existing.isProvisional && item.isProvisional) {
            skipped++;
            continue; // Skip updating definitive with provisional
          }

          if (existing.source && item.source) {
            const oldPrio = PRIORIDAD_MAP[existing.source.split('_')[0]] || 0;
            const newPrio = PRIORIDAD_MAP[item.source.split('_')[0]] || 0;
            if (oldPrio > newPrio) {
              skipped++;
              continue; // Skip update if old file has higher priority
            }
          }

          // Evitar UPDATE redundante si los datos son idénticos
          let isIdentical = true;
          const exReadings = existing.readings as number[];
          if (!Array.isArray(exReadings) || exReadings.length !== item.finalReadings.length) {
            isIdentical = false;
          } else {
            for (let j = 0; j < exReadings.length; j++) {
              if (exReadings[j] !== item.finalReadings[j]) {
                isIdentical = false;
                break;
              }
            }
          }
          if (isIdentical && existing.resolution === item.resolution && existing.isProvisional === item.isProvisional && existing.source === item.source) {
            // Saltarse la actualización, todo es exactamente igual
            skipped++;
            continue;
          }

          updates.push(
            prisma.loadCurve.update({
              where: { id: existing.id },
              data: {
                readings: item.finalReadings,
                resolution: item.resolution,
                isProvisional: item.isProvisional,
                source: item.source
              }
            })
          );
        } else {
          creates.push({
            cups: item.cups,
            date: item.dateIso,
            type: item.type,
            readings: item.finalReadings,
            resolution: item.resolution,
            isProvisional: item.isProvisional,
            source: item.source
          });
        }
      }

      // 3. Execute all operations for this batch in a single transaction
      const operations: any[] = [];
      if (creates.length > 0) {
        operations.push(prisma.loadCurve.createMany({ data: creates, skipDuplicates: true }));
      }
      operations.push(...updates);

      if (operations.length > 0) {
        await prisma.$transaction(operations, { timeout: 30000 });
      }

      success += creates.length + updates.length;
    } catch (e) {
      console.error(`Error saving batch of load curves starting at index ${i}:`, e);
      errors += batch.length; // Count the whole batch as errors if transaction fails
    }
  }

  return { success, skipped, errors };
}
