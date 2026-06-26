import { prisma } from '@/lib/prisma';
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';

export class CompodemService {
  static getCompodemFiles(zipBuffer: Buffer): { name: string, data: string }[] {
    const result: { name: string, data: string }[] = [];
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch(e) {
      console.error("Error reading zip buffer", e);
      return result;
    }
    
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      
      if (entry.name.endsWith('.zip')) {
        const innerZip = entry.getData();
        result.push(...this.getCompodemFiles(innerZip));
      } else if (entry.name.toLowerCase().includes('_compodem_') && entry.name.toLowerCase().endsWith('.csv')) {
        result.push({
          name: entry.name,
          data: entry.getData().toString('latin1')
        });
      }
    }
    return result;
  }

  static async processZipBuffer(buffer: Buffer): Promise<{ success: boolean, filesProcessed: number, rowsInserted: number, message: string }> {
    const files = this.getCompodemFiles(buffer);
    if (files.length === 0) {
      return { success: false, filesProcessed: 0, rowsInserted: 0, message: "No se encontraron ficheros compodem válidos en el ZIP." };
    }

    let totalInserted = 0;

    for (const file of files) {
      const match = file.name.match(/C(\d)_compodem/i);
      const version = match ? `C${match[1]}` : 'C0';

      const lines = file.data.split(/\r?\n/);
      if (lines.length <= 2) continue;
      const textBody = lines.slice(2).join('\n');

      let records: any[];
      try {
        records = parse(textBody, {
          delimiter: ';',
          columns: ['Fecha', 'Hora', 'Componente', 'Tipo', 'Importe_Eur', 'Energia_MWh', 'Precio_Unitario', 'Extra'],
          skip_empty_lines: true,
          relax_column_count: true
        });
      } catch(e) {
        console.error(`Error parsing ${file.name}`, e);
        continue;
      }

      // dataByDate: date -> component -> array of 24/25 hours
      const dataByDate = new Map<string, Map<string, number[]>>();

      for (const row of records) {
        const tipo = (row.Tipo || '').trim().toUpperCase();
        if (tipo !== 'NOCUR') continue;

        const dateStr = (row.Fecha || '').trim(); // "DD/MM/YYYY"
        const horaStr = (row.Hora || '').trim();
        const comp = (row.Componente || '').trim().toUpperCase();
        const precioStr = (row.Precio_Unitario || '0').replace(',', '.');
        const precio = parseFloat(precioStr) || 0;

        if (!dateStr || !horaStr) continue;

        // Excluir PC3 como hacía el script de Python
        if (comp === 'PC3') continue;

        const parts = dateStr.split('/');
        if (parts.length !== 3) continue;
        const yyyy = parts[2].padStart(4, '0');
        const mm = parts[1].padStart(2, '0');
        const dd = parts[0].padStart(2, '0');
        const isoDate = `${yyyy}-${mm}-${dd}T00:00:00.000Z`;

        let horaIndex = parseInt(horaStr, 10) - 1; // 0 a 24
        if (isNaN(horaIndex) || horaIndex < 0) continue;
        if (horaIndex > 24) horaIndex = 24;

        if (!dataByDate.has(isoDate)) {
          dataByDate.set(isoDate, new Map<string, number[]>());
        }
        const dailyComps = dataByDate.get(isoDate)!;

        if (!dailyComps.has(comp)) {
          dailyComps.set(comp, Array(25).fill(0));
        }
        
        dailyComps.get(comp)![horaIndex] += precio;
      }

      // Upsert into DB
      for (const [isoDate, dailyComps] of dataByDate.entries()) {
        const dateObj = new Date(isoDate);

        // Calculate RESTRICCIONES, OS, TOTAL_COMPODEM
        const cols_restricciones = ['RT3', 'RT6', 'CT2', 'CT3'];
        const cols_os = ['BS3', 'RAD3', 'RAD1', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP', 'MI', 'SECX'];

        const arrRestricciones = Array(25).fill(0);
        const arrOS = Array(25).fill(0);
        const arrTotal = Array(25).fill(0);

        for (const [comp, values] of dailyComps.entries()) {
          const isRestriccion = cols_restricciones.includes(comp);
          const isOS = cols_os.includes(comp);

          for (let h = 0; h < 25; h++) {
            if (isRestriccion) arrRestricciones[h] += values[h];
            if (isOS) arrOS[h] += values[h];
            arrTotal[h] += values[h];
          }

          // Insert individual pure component (e.g. RT3, BS3, EXD...)
          await this.upsertComponentWithVersion(comp, dateObj, values.slice(0, 24), version);
        }

        // Insert aggregations
        await this.upsertComponentWithVersion('RESTRICCIONES', dateObj, arrRestricciones.slice(0, 24), version);
        await this.upsertComponentWithVersion('OS', dateObj, arrOS.slice(0, 24), version);
        await this.upsertComponentWithVersion('TOTAL_COMPODEM', dateObj, arrTotal.slice(0, 24), version);

        totalInserted++;
      }
    }

    return { success: true, filesProcessed: files.length, rowsInserted: totalInserted, message: `Se procesaron ${files.length} ficheros.` };
  }

  private static async upsertComponentWithVersion(componentName: string, dateObj: Date, values: number[], version: string) {
    const existing = await prisma.systemComponentPrice.findUnique({
      where: {
        component_date: {
          component: componentName,
          date: dateObj
        }
      }
    });

    if (existing) {
      const existingVersion = existing.version || 'C0';
      // Solo actualizamos si la versión entrante es mayor o igual (ej: C4 >= C3)
      if (version.localeCompare(existingVersion) >= 0) {
        await prisma.systemComponentPrice.update({
          where: { id: existing.id },
          data: { values, version }
        });
      }
    } else {
      await prisma.systemComponentPrice.create({
        data: {
          component: componentName,
          date: dateObj,
          values,
          version
        }
      });
    }
  }
}
