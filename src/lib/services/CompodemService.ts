import { prisma } from '@/lib/prisma';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { SETTLEMENT_RANKS } from '@/lib/reganecuShared';

export class CompodemService {
  static getCompodemFiles(zipBuffer: Buffer): { name: string; data: string }[] {
    const result: { name: string; data: string }[] = [];
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (e) {
      console.error('Error reading zip buffer', e);
      return result;
    }

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      if (entry.entryName.includes('__MACOSX')) continue;

      const name = entry.name.toLowerCase();
      if (name.startsWith('._')) continue;

      if (name.endsWith('.zip')) {
        const innerZip = entry.getData();
        result.push(...this.getCompodemFiles(innerZip));
      } else if (
        name.includes('_compodem_') ||
        name.includes('kestimado') ||
        name.includes('kreal') ||
        name.includes('kestmedio') ||
        name.includes('kestimqh') ||
        name.includes('krealqh')
      ) {
        result.push({
          name: entry.name,
          data: entry.getData().toString('latin1'),
        });
      }
    }
    return result;
  }

  static parseReeMatrixFile(fileContent: string, componentName: string, version: string) {
    const lines = fileContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    if (lines.length < 3) return [];

    const dateParts = lines[1].split(';');
    if (dateParts.length < 2) return [];
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);

    if (isNaN(year) || isNaN(month)) return [];

    const jobs = [];

    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(';');
      if (cols.length < 25) continue;

      const dayStrParts = cols[0].split(' ');
      if (dayStrParts.length < 2) continue;

      const day = parseInt(dayStrParts[1], 10);
      if (isNaN(day)) continue;

      const values = [];
      for (let h = 1; h <= 24; h++) {
        const val = parseFloat(cols[h].replace(',', '.'));
        values.push(isNaN(val) ? 0 : val);
      }

      const dateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

      jobs.push({
        componentName,
        dateObj,
        values,
        version,
      });
    }
    return jobs;
  }

  static parseReeQhListFile(fileContent: string, componentName: string, version: string) {
    const lines = fileContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
    let startIndex = 0;
    while (startIndex < lines.length && !lines[startIndex].match(/^\d{2}\/\d{2}\/\d{4}/)) {
      startIndex++;
    }

    const dataByDate = new Map<string, { values: number[]; seen: boolean[] }>();

    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(';');
      if (cols.length < 4) continue;
      const dateStr = cols[0];
      const hStr = cols[1];
      const qStr = cols[2];
      const valStr = cols[3];

      const parts = dateStr.split('/');
      if (parts.length !== 3) continue;
      const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}T00:00:00.000Z`;

      const hour = parseInt(hStr, 10);
      const quarter = parseInt(qStr, 10);
      const val = parseFloat(valStr.replace(',', '.'));

      if (isNaN(hour) || isNaN(quarter) || isNaN(val)) continue;

      const idx = (hour - 1) * 4 + (quarter - 1);
      if (idx < 0 || idx >= 96) continue;

      if (!dataByDate.has(isoDate)) {
        dataByDate.set(isoDate, {
          values: Array(96).fill(0),
          seen: Array(96).fill(false),
        });
      }
      const entry = dataByDate.get(isoDate)!;
      entry.values[idx] = val;
      entry.seen[idx] = true;
    }

    const jobs = [];
    for (const [isoDate, { values, seen }] of dataByDate.entries()) {
      // En el cambio de hora de primavera (día de 23h = 92 cuartos), rellenar huecos finales
      // con el último cuarto válido para mantener longitud exacta 96 sin inyectar K = 0.
      const seenCount = seen.filter(Boolean).length;
      if (seenCount > 0 && seenCount < 96) {
        let lastVal = componentName === 'K' ? 1 : 0;
        for (let q = 0; q < 96; q++) {
          if (seen[q]) {
            lastVal = values[q];
          } else {
            values[q] = lastVal;
          }
        }
      }

      jobs.push({
        componentName,
        dateObj: new Date(isoDate),
        values,
        version,
      });
    }
    return jobs;
  }

  private static getVersionRank(v: string | null | undefined): number {
    if (!v) return 0;
    return SETTLEMENT_RANKS[v.toUpperCase()] || 0;
  }

  static async processZipBuffer(buffer: Buffer): Promise<{
    success: boolean;
    filesProcessed: number;
    rowsInserted: number;
    affectedMonths?: string[];
    message: string;
  }> {
    const files = this.getCompodemFiles(buffer);
    if (files.length === 0) {
      return {
        success: false,
        filesProcessed: 0,
        rowsInserted: 0,
        message: 'No se encontraron ficheros válidos en el ZIP.',
      };
    }

    type UpsertJob = {
      componentName: string;
      dateObj: Date;
      values: number[];
      version: string;
    };
    const jobs: UpsertJob[] = [];
    let validFilesProcessed = 0;

    for (const file of files) {
      const name = file.name.toLowerCase();

      // Matriz de Factor K
      if (
        name.includes('kestimado') ||
        name.includes('kreal') ||
        name.includes('kestmedio') ||
        name.includes('kestimqh') ||
        name.includes('krealqh')
      ) {
        if (name.includes('kestmedio') || name.includes('kestimado') || name.includes('kreal_')) {
          continue; // Priorizamos los cuartohorarios (kestimqh, krealqh) y omitimos los diarios
        }

        const match = file.name.match(/([AC]\d)_/i);
        const version = match ? match[1].toUpperCase() : 'C0';

        // REGLA DE NEGOCIO:
        // A1, C1, A2, C2, A3, C3, A4, C4 -> usar Kestimqh
        // A5, C5, A6, C6, A7, C7, A8, C8 -> usar Krealqh
        const isReal = ['A5', 'C5', 'A6', 'C6', 'A7', 'C7', 'A8', 'C8'].includes(version);
        if (isReal) {
          if (!name.includes('krealqh')) continue;
        } else {
          if (!name.includes('kestimqh')) continue;
        }

        const matrixJobs = this.parseReeQhListFile(file.data, 'K', version);
        if (matrixJobs.length > 0) {
          jobs.push(...matrixJobs);
          validFilesProcessed++;
        }
        continue;
      }

      // Fichero COMPODEM
      if (name.includes('_compodem_')) {
        const match = file.name.match(/([AC]\d)_compodem/i);
        const version = match ? match[1].toUpperCase() : 'C0';

        const lines = file.data.split(/\r?\n/);
        if (lines.length <= 2) continue;
        const textBody = lines.slice(2).join('\n');

        let records: any[];
        try {
          records = parse(textBody, {
            delimiter: ';',
            columns: [
              'Fecha',
              'Hora',
              'Componente',
              'Tipo',
              'Importe_Eur',
              'Energia_MWh',
              'Precio_Unitario',
              'Extra',
            ],
            skip_empty_lines: true,
            relax_column_count: true,
          });
        } catch (e) {
          console.error(`Error parsing ${file.name}`, e);
          continue;
        }

        const dataByDate = new Map<
          string,
          { comps: Map<string, number[]>; maxHourIndex: number }
        >();

        for (const row of records) {
          const tipo = (row.Tipo || '').trim().toUpperCase();
          if (tipo !== 'NOCUR') continue;

          const dateStr = (row.Fecha || '').trim();
          const horaStr = (row.Hora || '').trim();
          const comp = (row.Componente || '').trim().toUpperCase();
          const precioStr = (row.Precio_Unitario || '0').replace(',', '.');
          const precio = parseFloat(precioStr) || 0;

          if (!dateStr || !horaStr || !comp) continue;
          if (comp === 'PC3') continue;

          const parts = dateStr.split('/');
          if (parts.length !== 3) continue;
          const yyyy = parts[2].padStart(4, '0');
          const mm = parts[1].padStart(2, '0');
          const dd = parts[0].padStart(2, '0');
          const isoDate = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;

          let horaIndex = parseInt(horaStr, 10) - 1;
          if (isNaN(horaIndex) || horaIndex < 0) continue;
          if (horaIndex > 24) horaIndex = 24;

          if (!dataByDate.has(isoDate)) {
            dataByDate.set(isoDate, {
              comps: new Map<string, number[]>(),
              maxHourIndex: 0,
            });
          }
          const dailyEntry = dataByDate.get(isoDate)!;
          if (horaIndex > dailyEntry.maxHourIndex) {
            dailyEntry.maxHourIndex = horaIndex;
          }

          if (!dailyEntry.comps.has(comp)) {
            dailyEntry.comps.set(comp, Array(25).fill(0));
          }

          dailyEntry.comps.get(comp)![horaIndex] += precio;
        }

        if (dataByDate.size > 0) {
          validFilesProcessed++;
        }

        for (const [isoDate, { comps: dailyComps, maxHourIndex }] of dataByDate.entries()) {
          const dateObj = new Date(isoDate);
          const colsRestricciones = ['RT3', 'RT6', 'CT2', 'CT3'];
          const colsOs = ['BS3', 'RAD3', 'RAD1', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'MI', 'SECX'];

          const arrRestricciones = Array(25).fill(0);
          const arrOS = Array(25).fill(0);
          const arrTotal = Array(25).fill(0);

          const normalize24 = (arr: number[]) => {
            const out = arr.slice(0, 24);
            // En el día de cambio de hora de primavera (23 horas: índices 0..22),
            // replicamos la hora 23 en el slot 24 para no introducir un 0 artificial.
            if (maxHourIndex === 22) {
              out[23] = out[22];
            }
            return out;
          };

          for (const [comp, values] of dailyComps.entries()) {
            const isRestriccion = colsRestricciones.includes(comp);
            const isOS = colsOs.includes(comp);

            for (let h = 0; h < 25; h++) {
              if (isRestriccion) arrRestricciones[h] += values[h];
              if (isOS) arrOS[h] += values[h];
              arrTotal[h] += values[h];
            }

            jobs.push({
              componentName: comp,
              dateObj,
              values: normalize24(values),
              version,
            });
          }

          jobs.push({
            componentName: 'RESTRICCIONES',
            dateObj,
            values: normalize24(arrRestricciones),
            version,
          });
          jobs.push({
            componentName: 'OS',
            dateObj,
            values: normalize24(arrOS),
            version,
          });
          jobs.push({
            componentName: 'TOTAL_COMPODEM',
            dateObj,
            values: normalize24(arrTotal),
            version,
          });
        }
      }
    }

    if (jobs.length === 0) {
      return {
        success: false,
        filesProcessed: 0,
        rowsInserted: 0,
        message: 'No se extrajeron filas válidas de los ficheros del ZIP.',
      };
    }

    // 1. Deduplicar en memoria por (componentName + fecha) conservando la versión de mayor jerarquía
    const dedupedMap = new Map<string, UpsertJob>();
    for (const job of jobs) {
      const key = `${job.componentName}|${job.dateObj.toISOString()}`;
      const prev = dedupedMap.get(key);
      if (!prev || this.getVersionRank(job.version) >= this.getVersionRank(prev.version)) {
        dedupedMap.set(key, job);
      }
    }

    const finalJobs = Array.from(dedupedMap.values());
    const uniqueComponents = Array.from(new Set(finalJobs.map(j => j.componentName)));
    const timestamps = finalJobs.map(j => j.dateObj.getTime());
    const minDate = new Date(Math.min(...timestamps));
    const maxDate = new Date(Math.max(...timestamps));

    // 2. Precargar registros existentes en una sola consulta para evitar N+1 findUnique
    const existingRows = await prisma.systemComponentPrice.findMany({
      where: {
        component: { in: uniqueComponents },
        date: { gte: minDate, lte: maxDate },
      },
      select: {
        id: true,
        component: true,
        date: true,
        version: true,
      },
    });

    const existingMap = new Map<string, { id: string; version: string | null }>();
    for (const row of existingRows) {
      existingMap.set(`${row.component}|${row.date.toISOString()}`, {
        id: row.id,
        version: row.version,
      });
    }

    const toCreate: Array<{
      component: string;
      date: Date;
      values: number[];
      version: string;
    }> = [];
    const toUpdate: Array<{
      id: string;
      values: number[];
      version: string;
    }> = [];

    for (const job of finalJobs) {
      const key = `${job.componentName}|${job.dateObj.toISOString()}`;
      const existing = existingMap.get(key);
      if (!existing) {
        toCreate.push({
          component: job.componentName,
          date: job.dateObj,
          values: job.values,
          version: job.version,
        });
      } else if (this.getVersionRank(job.version) >= this.getVersionRank(existing.version)) {
        toUpdate.push({
          id: existing.id,
          values: job.values,
          version: job.version,
        });
      }
    }

    let totalAffected = 0;

    // 3. Insertar nuevos en bloque con createMany
    const CREATE_CHUNK_SIZE = 200;
    for (let i = 0; i < toCreate.length; i += CREATE_CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CREATE_CHUNK_SIZE);
      const res = await prisma.systemComponentPrice.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      totalAffected += res.count;
    }

    // 4. Actualizar existentes en lotes pequeños respetando el pool de conexiones (Regla 134)
    const UPDATE_CHUNK_SIZE = 20;
    for (let i = 0; i < toUpdate.length; i += UPDATE_CHUNK_SIZE) {
      const chunk = toUpdate.slice(i, i + UPDATE_CHUNK_SIZE);
      await Promise.all(
        chunk.map(u =>
          prisma.systemComponentPrice.update({
            where: { id: u.id },
            data: { values: u.values, version: u.version },
          })
        )
      );
      totalAffected += chunk.length;
    }

    const affectedMonths = Array.from(
      new Set(finalJobs.map(j => j.dateObj.toISOString().slice(0, 7)))
    ).sort();

    return {
      success: true,
      filesProcessed: validFilesProcessed,
      rowsInserted: totalAffected,
      affectedMonths,
      message: `Se procesaron ${validFilesProcessed} ficheros válidos y se actualizaron/insertaron ${totalAffected} registros en la base de datos.`,
    };
  }
}
