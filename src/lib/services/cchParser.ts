import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';
import JSZip from 'jszip';
import zlib from 'zlib';
import { Readable } from 'stream';

export const PRIORIDAD_MAP: Record<string, number> = {
  F1QH: 105,
  Q1: 105,
  F1: 100,
  F1H: 100,
  RF5D: 95,
  RF4D: 95,
  F5D: 90,
  F4D: 90,
  F5: 90,
  F4: 90,
  P5D: 40,
  P4D: 40,
  P5: 40,
  P4: 40,
  P2D: 25,
  P2: 25,
  P1D: 20,
  P1: 20,
  P0: 10,
};

const UMBRAL_MAX_ABSOLUTE = 50000.0; // Guard against corrupt meter spikes (> 50 MWh in a single hour/quarter)

// Ordered longest-first so F1QH matches before F1, RF5D/RF4D before F5D/F4D, P1D before P1, P2D before P2, F5D/F4D before F5/F4, P5D/P4D before P5/P4
const CNMC_CURVE_TYPE_REGEX = /(?:^|[_.\-\s])(F1QH|F1H|RF5D|RF4D|F5D|F4D|P5D|P4D|P1D|P2D|F1|Q1|F5|F4|P5|P4|P1|P2|P0)(?:[_.\-\s]|$)/gi;

// Official CNMC/REE non-curve or auxiliary files that appear on distributor FTPs and MUST NOT be imported into LoadCurve(CONSUMPTION/SURPLUS):
// - A5D (CCH_AUTOCONS: energía horaria autoconsumida EAUTOh, NO consumo de red ECh)
// - B5D (CCH_GENNETABETA: generación neta * beta, NO excedente compensable EXCh)
// - C1, C2, C3, S1, S2, S3, SALD (cierres/saldos por periodo tarifario)
// - PMCLIE, CUPS45, CUPSDAT, INMECL, MAGCL, CIRCUITOESPERA (inventarios y agregaciones)
const CNMC_NON_CURVE_REGEX = /(?:^|[_.\-\s])(CIRCUITOESPERA|CUPSDAT|PMCLIE|CUPS45|INMECL|MAGCL|SALD|A5D|B5D|C1|C2|C3|S1|S2|S3)(?:[_.\-\s]|$)/i;

const IGNORED_METADATA_EXT_REGEX = /\.(sha1|sha256|md5|sig|asc|xml|json|pdf|log|html|htm|err)$/i;

export interface ParseResult {
  success: number;
  skipped: number;
  errors: number;
  affectedDates?: string[];
}

export function isNonCurveCnmcFile(filename: string): boolean {
  if (!filename) return false;
  const baseName = (filename.split(/[\\/]/).pop() || filename).trim();
  return CNMC_NON_CURVE_REGEX.test(baseName);
}

/**
 * Extracts the canonical CNMC curve file type token (e.g. 'F5D', 'P2D', 'F1QH', 'P2', 'F1')
 * from a filename or path, ignoring directory prefixes and distributor legal names
 * (such as "VIESGO DISTRIBUCIÓN ELECTRICA, S.L_P2_0027_...").
 */
export function extractCnmcFileType(filename: string): string | null {
  if (!filename) return null;
  const baseName = (filename.split(/[\\/]/).pop() || filename).trim();
  if (!baseName || IGNORED_METADATA_EXT_REGEX.test(baseName) || isNonCurveCnmcFile(baseName)) {
    return null;
  }

  CNMC_CURVE_TYPE_REGEX.lastIndex = 0;
  let bestMatch: string | null = null;
  let bestPrio = -1;

  let match: RegExpExecArray | null;
  while ((match = CNMC_CURVE_TYPE_REGEX.exec(baseName)) !== null) {
    const token = match[1].toUpperCase();
    const prio = PRIORIDAD_MAP[token] ?? 0;
    if (bestMatch === null || prio > bestPrio) {
      bestMatch = token;
      bestPrio = prio;
    }
    // Advance only to the start of the trailing delimiter so adjacent tokens can also match
    if (match[0].length > match[1].length + 1) {
      CNMC_CURVE_TYPE_REGEX.lastIndex -= 1;
    }
  }
  return bestMatch;
}

export function getFilePriority(filenameOrSource: string): number {
  if (!filenameOrSource) return 0;
  if (filenameOrSource === 'MIGRACION_PKL') return 999;

  const prefix = filenameOrSource.split('_')[0]?.toUpperCase();
  if (prefix && PRIORIDAD_MAP[prefix] !== undefined) {
    return PRIORIDAD_MAP[prefix];
  }

  const extracted = extractCnmcFileType(filenameOrSource);
  if (extracted && PRIORIDAD_MAP[extracted] !== undefined) {
    return PRIORIDAD_MAP[extracted];
  }

  return 0;
}

export function isFileProvisional(filename: string): boolean {
  const fileType = extractCnmcFileType(filename);
  if (!fileType) return false;
  return fileType.startsWith('P');
}

export function isRecognizedCchFilename(filename: string, allowGenericExtensions = false): boolean {
  if (!filename) return false;
  const baseName = (filename.split(/[\\/]/).pop() || filename).trim();
  if (!baseName || baseName.startsWith('.') || filename.includes('__MACOSX')) return false;
  if (IGNORED_METADATA_EXT_REGEX.test(baseName)) return false;
  if (isNonCurveCnmcFile(baseName)) return false;

  const lower = baseName.toLowerCase();
  if (lower.endsWith('.zip')) return true;
  if (extractCnmcFileType(baseName) !== null) return true;

  if (allowGenericExtensions) {
    return (
      lower.endsWith('.csv') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.gz') ||
      lower.endsWith('.bz2') ||
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls') ||
      /\.\d+$/.test(lower)
    );
  }
  return false;
}

function parseStrictNumber(raw?: string): { value: number; hasDecimal: boolean } | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return { value, hasDecimal: normalized.includes('.') };
}

interface ParsedLocalTimestamp {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-24
  minute: number; // 0-59
}

/**
 * Parses a CNMC local Spanish timestamp ("YYYY/MM/DD HH:MM[:SS]", "DD/MM/YYYY HH:MM[:SS]",
 * "YYYY-MM-DD HH:MM[:SS]", or "DD-MM-YYYY HH:MM[:SS]") into raw numeric components
 * WITHOUT applying the host OS timezone.
 */
function parseRawTimestamp(dateStr: string): ParsedLocalTimestamp | null {
  const clean = dateStr.trim();
  const parts = clean.split(/\s+/);
  if (!parts[0]) return null;

  const sep = parts[0].includes('/') ? '/' : parts[0].includes('-') ? '-' : null;
  if (!sep) return null;

  const dParts = parts[0].split(sep);
  if (dParts.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;

  if (dParts[0].length === 4) {
    year = parseInt(dParts[0], 10);
    month = parseInt(dParts[1], 10);
    day = parseInt(dParts[2], 10);
  } else if (dParts[2].length === 4) {
    day = parseInt(dParts[0], 10);
    month = parseInt(dParts[1], 10);
    year = parseInt(dParts[2], 10);
  } else {
    return null;
  }

  const timePart = parts[1] || '00:00';
  const tParts = timePart.split(':');
  const hour = parseInt(tParts[0] || '0', 10);
  const minute = parseInt(tParts[1] || '0', 10);

  if (
    isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute) ||
    month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 24 || minute < 0 || minute > 59
  ) {
    return null;
  }

  return { year, month, day, hour, minute };
}

function decompressBz2Buffer(buffer: Buffer): Promise<string> {
  const bz2 = require('unbzip2-stream');
  return new Promise<string>((resolve, reject) => {
    const stream = Readable.from(buffer);
    const dest = bz2();
    const chunks: Buffer[] = [];
    dest.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    dest.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    dest.on('error', reject);
    stream.on('error', reject);
    stream.pipe(dest);
  });
}

/**
 * Unified archive/file processor supporting .zip (including nested .zip/.gz/.bz2/.xlsx),
 * standalone .gz, .bz2, .xlsx/.xls, and plain CSV/TXT/CNMC files.
 */
export async function processCchBuffer(
  buffer: Buffer,
  filename: string,
  source: string = 'UPLOAD',
  allowGenericExtensions = false,
  depth = 0
): Promise<ParseResult> {
  const totals: ParseResult = { success: 0, skipped: 0, errors: 0 };
  if (depth > 3) return totals; // Prevent zip-bomb recursion

  const baseName = (filename.split(/[\\/]/).pop() || filename).trim();
  const lower = baseName.toLowerCase();

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(buffer);
    const zipAffectedSet = new Set<string>();
    for (const entryName of Object.keys(zip.files)) {
      const entry = zip.files[entryName];
      if (entry.dir) continue;
      if (!isRecognizedCchFilename(entryName, allowGenericExtensions)) continue;

      try {
        const entryBuffer = await entry.async('nodebuffer');
        const subResult = await processCchBuffer(
          entryBuffer,
          entryName,
          source,
          allowGenericExtensions,
          depth + 1
        );
        totals.success += subResult.success;
        totals.skipped += subResult.skipped;
        totals.errors += subResult.errors;
        if (subResult.affectedDates) {
          for (const d of subResult.affectedDates) zipAffectedSet.add(d);
        }
      } catch (err) {
        console.error(`Error processing ZIP entry ${entryName} in ${filename}:`, err);
        totals.errors += 1;
      }
    }
    if (zipAffectedSet.size > 0) {
      totals.affectedDates = Array.from(zipAffectedSet);
    }
    return totals;
  }

  let csvContent = '';
  let effectiveName = baseName;

  if (lower.endsWith('.gz')) {
    csvContent = zlib.gunzipSync(buffer).toString('utf8');
    effectiveName = baseName.slice(0, -3);
  } else if (lower.endsWith('.bz2')) {
    csvContent = await decompressBz2Buffer(buffer);
    effectiveName = baseName.slice(0, -4);
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return totals;
    csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: ';' });
  } else {
    csvContent = buffer.toString('utf8');
  }

  return processCchCsv(csvContent, effectiveName, source);
}

export async function processCchCsv(
  csvContent: string,
  filename: string,
  source: string = 'UPLOAD'
): Promise<ParseResult> {
  // Descartar ficheros CNMC que NO son curvas de consumo/excedente de red (C1/C2/C3, S1/S2/S3, SALD, PMCLIE, CUPS45, INMECL, MAGCL, A5D=EAUTOh, B5D=EGENh*beta) y ficheros de checksum/metadatos
  if (isNonCurveCnmcFile(filename) || IGNORED_METADATA_EXT_REGEX.test(filename)) {
    return { success: 0, skipped: 1, errors: 0 };
  }

  const fileType = extractCnmcFileType(filename);
  const isProvisional = isFileProvisional(filename);

  // Prefijar source con el tipo CNMC real para que la jerarquía de prioridades funcione en BD
  const cleanSource = source.trim() || 'UPLOAD';
  const effectiveSource =
    fileType && !cleanSource.toUpperCase().startsWith(`${fileType}_`) && cleanSource !== 'MIGRACION_PKL'
      ? `${fileType}_${cleanSource}`
      : cleanSource;

  // Limpiar caracteres nulos (0x00) y BOM que causan errores en PostgreSQL / PapaParse
  const cleanCsvContent = csvContent.replace(/^\uFEFF/, '').replace(/\0/g, '');

  const parsed = Papa.parse<string[]>(cleanCsvContent, {
    delimiter: ';',
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error('Failed to parse CSV');
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return { success: 0, skipped: 0, errors: 0 };
  }

  // Determinar familia de columnas CNMC (con fallback por estructura si el nombre de archivo fue renombrado)
  let is5D = fileType ? ['F5D', 'RF5D', 'P5D', 'F5', 'P5', 'F4D', 'RF4D', 'P4D', 'F4', 'P4'].includes(fileType) : false;
  let isP1OrP2 = fileType ? ['P1', 'P1D', 'P2', 'P2D', 'P0'].includes(fileType) : false;
  let isF1Family = fileType ? ['F1', 'F1H', 'F1QH', 'Q1'].includes(fileType) : false;

  if (!fileType) {
    const sampleRow = rows.find(r => r.length >= 4 && r[0]?.trim()?.toUpperCase().startsWith('ES'));
    if (sampleRow) {
      if (parseRawTimestamp(sampleRow[1] || '') !== null) {
        is5D = true;
      } else if (parseRawTimestamp(sampleRow[2] || '') !== null) {
        // En curvas CNMC F1/P1/P2 el campo B (col[1]) es Tipo de medida = '11' (incremental) y col[4] es numérico;
        // en cierres C1/C2/S1 renombrados col[1] vale 20..29 y col[4] es otra fecha.
        const sampleTipoMedida = sampleRow[1]?.trim() || '';
        if ((sampleTipoMedida && sampleTipoMedida !== '11') || parseStrictNumber(sampleRow[4]) === null) {
          return { success: 0, skipped: rows.length, errors: 0 };
        }
        // En F1 col[6] es R1 pero en P1/P2 col[5] es CalidadAE y col[7] es CalidadAS (>= 21 cols en P1/P2, 14 cols en F1)
        if (sampleRow.length >= 18) {
          isP1OrP2 = true;
        } else if (sampleRow.length >= 11) {
          isF1Family = true;
        } else {
          isP1OrP2 = true;
        }
      }
    }
  }

  const idxDate = is5D ? 1 : 2;
  const idxBandera = is5D ? 2 : 3;
  const idxConsumo = is5D ? 3 : 4;
  let idxSurplus = -1;
  if (is5D) {
    idxSurplus = 4;
  } else if (isP1OrP2) {
    idxSurplus = 6;
  } else if (isF1Family) {
    idxSurplus = 5;
  }

  // Detectar si el fichero viene en resolución cuarto-horaria (-15 min) u horaria (-60 min).
  // Verificado sobre ficheros reales de distribuidoras (Endesa, Iberdrola, UFD, CIDE, ASEME, Viesgo):
  // - Cuarto-horarios (P2, P2D, F1QH, Q1 o cualquier curva con minutos :15/:30/:45): 00:15 .. 00:00(D+1) -> restar 15 min.
  // - Horarios (F5D, P5D, F1, P1, P1D con minutos :00): 01:00 .. 00:00(D+1) -> restar 60 min.
  let isQuarterHourlyFile = fileType ? ['F1QH', 'P2', 'P2D', 'Q1'].includes(fileType) : false;
  if (!isQuarterHourlyFile) {
    const scanLimit = Math.min(rows.length, 200);
    for (let i = 0; i < scanLimit; i++) {
      const r = rows[i];
      if (!r || r.length <= idxDate) continue;
      const ts = parseRawTimestamp(r[idxDate] || '');
      if (ts && ts.minute % 60 !== 0) {
        isQuarterHourlyFile = true;
        break;
      }
    }
  }
  const shiftMinutes = isQuarterHourlyFile ? 15 : 60;

  // Solo necesitamos consultar SupplyPoint cuando el fichero es un CSV genérico sin tipo CNMC oficial
  // (en CNMC v4.3 oficial: F5/F5D/RF5D/P5/P5D vienen 100% en Wh; F1/F1QH/Q1/P1/P1D/P2/P2D vienen 100% en kWh).
  const uniqueCups = Array.from(
    new Set(
      rows
        .map(row => row[0]?.trim()?.substring(0, 20))
        .filter((c): c is string => Boolean(c && c.length >= 18))
    )
  );

  const segmentMap = new Map<string, string>();
  if (!is5D && !fileType && uniqueCups.length > 0) {
    const CHUNK = 1000;
    for (let i = 0; i < uniqueCups.length; i += CHUNK) {
      const slice = uniqueCups.slice(i, i + CHUNK);
      const sps = await prisma.$queryRaw<Array<{ base_cups: string; segment: string | null; tariff: string | null }>>`
        SELECT SUBSTRING("cups", 1, 20) AS base_cups, "segment", "tariff"
        FROM "SupplyPoint"
        WHERE SUBSTRING("cups", 1, 20) = ANY(${slice})
      `;
      for (const sp of sps) {
        if (sp.base_cups) {
          segmentMap.set(sp.base_cups, `${sp.segment || ''} ${sp.tariff || ''}`.trim());
        }
      }
    }
  }

  const dailyData = new Map<
    string,
    {
      cups: string;
      date: string;
      type: 'CONSUMPTION' | 'SURPLUS';
      readings: number[];
      seenFlags: Map<number, Set<string>>;
      hasDecimal: boolean;
    }
  >();

  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    if (!row || row.length <= idxConsumo) {
      skipped++;
      continue;
    }

    const cups = row[0]?.trim()?.substring(0, 20);
    if (!cups || !cups.toUpperCase().startsWith('ES')) {
      // Ignorar cabeceras eventuales o líneas vacías sin CUPS válido
      skipped++;
      continue;
    }

    // En formatos CNMC no-5D (F1/F1QH/P1/P1D/P2/P2D), col[1] es Tipo de medida y vale siempre '11' (incremental)
    if (!is5D && (isF1Family || isP1OrP2)) {
      const tipoMedida = row[1]?.trim();
      if (tipoMedida && tipoMedida !== '11') {
        skipped++;
        continue;
      }
    }

    const dateStr = row[idxDate]?.trim();
    const bandera = row[idxBandera]?.trim() || '0';
    const parsedConsumo = parseStrictNumber(row[idxConsumo]);
    const parsedSurplus = idxSurplus >= 0 ? parseStrictNumber(row[idxSurplus]) : null;

    if (!dateStr || (parsedConsumo === null && parsedSurplus === null)) {
      skipped++;
      continue;
    }

    const hasConsumoColumn = parsedConsumo !== null;
    const consumo = parsedConsumo && parsedConsumo.value >= 0 ? parsedConsumo.value : 0;

    const hasSurplusColumn = parsedSurplus !== null && parsedSurplus.value >= 0;
    const surplus = hasSurplusColumn && parsedSurplus ? parsedSurplus.value : 0;

    const rawTs = parseRawTimestamp(dateStr);
    if (!rawTs) {
      errors++;
      continue;
    }

    // Cálculo agnóstico a zona horaria usando Date.UTC puro:
    // Desplaza el instante final de periodo (-15 min en QH, -60 min en H) al inicio del periodo local español.
    const shiftedMs =
      Date.UTC(rawTs.year, rawTs.month - 1, rawTs.day, rawTs.hour, rawTs.minute, 0, 0) -
      shiftMinutes * 60 * 1000;
    const shifted = new Date(shiftedMs);

    const dayKey = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
    const hours = shifted.getUTCHours();
    const minutes = shifted.getUTCMinutes();
    const index = hours * 4 + Math.floor(minutes / 15);

    if (index < 0 || index >= 96) {
      errors++;
      continue;
    }

    // Consumo (CONSUMPTION)
    if (hasConsumoColumn) {
      const mapKeyConsumo = `${cups}_${dayKey}_CONSUMPTION`;
      let entry = dailyData.get(mapKeyConsumo);
      if (!entry) {
        entry = {
          cups,
          date: dayKey,
          type: 'CONSUMPTION',
          readings: new Array(96).fill(0),
          seenFlags: new Map(),
          hasDecimal: false,
        };
        dailyData.set(mapKeyConsumo, entry);
      }
      if (parsedConsumo?.hasDecimal) entry.hasDecimal = true;
      const flagsForSlot = entry.seenFlags.get(index) || new Set<string>();
      if (flagsForSlot.size > 0 && !flagsForSlot.has(bandera)) {
        // Día de cambio horario de octubre (25h / 100qh): misma hora local con bandera verano (1) e invierno (0) -> sumar ambas
        entry.readings[index] += consumo;
      } else {
        entry.readings[index] = consumo;
      }
      flagsForSlot.add(bandera);
      entry.seenFlags.set(index, flagsForSlot);
    }

    // Excedentes (SURPLUS)
    if (hasSurplusColumn) {
      const mapKeySurplus = `${cups}_${dayKey}_SURPLUS`;
      let entrySurplus = dailyData.get(mapKeySurplus);
      if (!entrySurplus) {
        entrySurplus = {
          cups,
          date: dayKey,
          type: 'SURPLUS',
          readings: new Array(96).fill(0),
          seenFlags: new Map(),
          hasDecimal: false,
        };
        dailyData.set(mapKeySurplus, entrySurplus);
      }
      if (parsedSurplus?.hasDecimal) entrySurplus.hasDecimal = true;
      const flagsForSlot = entrySurplus.seenFlags.get(index) || new Set<string>();
      if (flagsForSlot.size > 0 && !flagsForSlot.has(bandera)) {
        entrySurplus.readings[index] += surplus;
      } else {
        entrySurplus.readings[index] = surplus;
      }
      flagsForSlot.add(bandera);
      entrySurplus.seenFlags.set(index, flagsForSlot);
    }
  }

  // Normalización de unidades (Wh -> kWh) a nivel de curva diaria completa y compactación de resolución
  const allData: Array<{
    cups: string;
    dateIso: Date;
    type: 'CONSUMPTION' | 'SURPLUS';
    finalReadings: number[];
    resolution: 'HOURLY' | 'QUARTER_HOURLY';
    isProvisional: boolean;
    source: string;
  }> = [];

  for (const data of dailyData.values()) {
    let normalized = data.readings;

    if (is5D) {
      // Según especificación CNMC v4.3, F5/F5D/RF5D/P5/P5D vienen siempre en Wh enteros
      normalized = normalized.map(v => v / 1000.0);
    } else if (!fileType && !data.hasDecimal) {
      // Solo para CSVs genéricos/renombrados sin prefijo CNMC oficial ni decimales: heurística Wh vs kWh
      const seg = (segmentMap.get(data.cups) || '').toUpperCase();
      const isHighPower =
        seg.includes('VIP') ||
        seg.includes('>50') ||
        seg.includes('6.1') ||
        seg.includes('6.2') ||
        seg.includes('6.3') ||
        seg.includes('6.4');
      const currentUmbral = isHighPower ? 2000.0 : 300.0;

      let maxVal = 0;
      for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] > maxVal) maxVal = normalized[i];
      }
      if (maxVal > currentUmbral) {
        normalized = normalized.map(v => v / 1000.0);
      }
    }

    // Guardia de sanidad frente a lecturas corruptas extremas
    let hasCorruptSpike = false;
    for (let i = 0; i < normalized.length; i++) {
      if (!Number.isFinite(normalized[i]) || normalized[i] > UMBRAL_MAX_ABSOLUTE) {
        hasCorruptSpike = true;
        break;
      }
    }
    if (hasCorruptSpike) {
      errors++;
      continue;
    }

    // Redondear ruido de coma flotante a 6 decimales (precisión de Wh exacto en kWh)
    normalized = normalized.map(v => Math.round(v * 1e6) / 1e6);

    let hasSubHourData = isQuarterHourlyFile;
    if (!hasSubHourData) {
      for (let i = 0; i < 96; i++) {
        if (i % 4 !== 0 && normalized[i] !== 0) {
          hasSubHourData = true;
          break;
        }
      }
    }

    const resolution: 'HOURLY' | 'QUARTER_HOURLY' = hasSubHourData ? 'QUARTER_HOURLY' : 'HOURLY';
    const finalReadings = hasSubHourData ? normalized : normalized.filter((_, i) => i % 4 === 0);

    allData.push({
      cups: data.cups,
      dateIso: new Date(`${data.date}T00:00:00.000Z`),
      type: data.type,
      finalReadings,
      resolution,
      isProvisional,
      source: effectiveSource,
    });
  }

  // Filtrar curvas de SURPLUS 100% ceros para no inundar la BD con suministros sin autoconsumo
  const allDataFiltered = allData.filter(d => {
    if (d.type === 'SURPLUS') {
      return d.finalReadings.some(val => val > 0);
    }
    return true;
  });

  let success = 0;
  const affectedDateSet = new Set<string>();
  const BATCH_SIZE = 250;

  for (let i = 0; i < allDataFiltered.length; i += BATCH_SIZE) {
    const batch = allDataFiltered.slice(i, i + BATCH_SIZE);

    try {
      const batchCups = Array.from(new Set(batch.map(b => b.cups)));
      const batchDates = Array.from(new Set(batch.map(b => b.dateIso.toISOString())));

      const existingRecords = await prisma.loadCurve.findMany({
        where: {
          cups: { in: batchCups },
          date: { in: batchDates.map(d => new Date(d)) },
        },
        select: {
          id: true,
          cups: true,
          date: true,
          type: true,
          isProvisional: true,
          readings: true,
          resolution: true,
          source: true,
        },
      });

      const existingMap = new Map<string, (typeof existingRecords)[number]>();
      for (const rec of existingRecords) {
        existingMap.set(`${rec.cups}_${rec.date.toISOString()}_${rec.type}`, rec);
      }

      const creates: any[] = [];
      const updates: any[] = [];

      for (const item of batch) {
        const key = `${item.cups}_${item.dateIso.toISOString()}_${item.type}`;
        const existing = existingMap.get(key);

        if (existing) {
          if (existing.source === 'MIGRACION_PKL') {
            skipped++;
            continue;
          }

          if (!existing.isProvisional && item.isProvisional) {
            skipped++;
            continue;
          }

          const oldPrio = getFilePriority(existing.source || '');
          const newPrio = getFilePriority(item.source || '');
          if (oldPrio > newPrio) {
            skipped++;
            continue;
          }

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

          if (
            isIdentical &&
            existing.resolution === item.resolution &&
            existing.isProvisional === item.isProvisional &&
            existing.source === item.source
          ) {
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
                source: item.source,
              },
            })
          );
          affectedDateSet.add(item.dateIso.toISOString().slice(0, 10));
        } else {
          creates.push({
            cups: item.cups,
            date: item.dateIso,
            type: item.type,
            readings: item.finalReadings,
            resolution: item.resolution,
            isProvisional: item.isProvisional,
            source: item.source,
          });
          affectedDateSet.add(item.dateIso.toISOString().slice(0, 10));
        }
      }

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
      errors += batch.length;
    }
  }

  return { success, skipped, errors, affectedDates: Array.from(affectedDateSet) };
}
