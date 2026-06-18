import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { processCchCsv } from '../src/lib/services/cchParser';

const rootDir = 'Z:\\AED\\CCH\\CCH';
// La última actualización fue en Febrero 2026, ignoramos ficheros antiguos
const minDate = new Date('2026-02-01T00:00:00.000Z');

async function *walk(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(entry);
    else if (d.isFile()) yield entry;
  }
}

async function main() {
  console.log(`🔍 Buscando archivos nuevos en: ${rootDir} (posteriores a Febrero 2026)`);
  let processedFiles = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;

  for await (const p of walk(rootDir)) {
    const stat = await fs.promises.stat(p);
    
    // Solo procesar archivos nuevos (para no pisar el PKL ni repetir trabajo)
    if (stat.mtime < minDate) continue;

    const lower = p.toLowerCase();
    
    // Ignoramos ficheros .gz o excel por ahora (el script original los trataba, 
    // pero usualmente los de la distribuidora son zip o csv)
    if (lower.endsWith('.zip')) {
      console.log(`📦 Procesando ZIP: ${p}`);
      try {
        const buffer = await fs.promises.readFile(p);
        const zip = await JSZip.loadAsync(buffer);
        for (const filename of Object.keys(zip.files)) {
          if (!zip.files[filename].dir && (filename.toLowerCase().endsWith('.csv') || filename.toLowerCase().endsWith('.txt'))) {
            const content = await zip.files[filename].async('string');
            const res = await processCchCsv(content, filename, 'LOCAL_SCAN');
            totalSuccess += res.success;
            totalSkipped += res.skipped;
          }
        }
        processedFiles++;
      } catch (e) {
        console.error(`❌ Error en ZIP ${p}:`, e);
      }
    } else if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      console.log(`📄 Procesando CSV: ${p}`);
      try {
        const content = await fs.promises.readFile(p, 'utf8');
        const res = await processCchCsv(content, path.basename(p), 'LOCAL_SCAN');
        totalSuccess += res.success;
        totalSkipped += res.skipped;
        processedFiles++;
      } catch (e) {
        console.error(`❌ Error en CSV ${p}:`, e);
      }
    }
  }

  console.log(`\n🎉 ¡Escaneo completado!`);
  console.log(`Archivos procesados: ${processedFiles}`);
  console.log(`Curvas insertadas/actualizadas: ${totalSuccess}`);
  console.log(`Filas ignoradas: ${totalSkipped}`);
  process.exit(0);
}

main().catch(console.error);
