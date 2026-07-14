import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { processCchCsv } from '../src/lib/services/cchParser';

const rootDir = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\CCH\\Endesa\\2025\\202510';
// MODO COMPLETO: Importamos todos los ficheros sin límite de fecha
const minDate = new Date('1970-01-01T00:00:00.000Z');

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
    
    const isZip = lower.endsWith('.zip');
    
    // Comprobar si el fichero coincide con los patrones de curvas
    const PRIORIDAD_MAP = ['F1', 'C1', 'Q1', 'F1H', 'F1QH', 'F5D', 'A5D', 'B5D', 'P5D', 'P1', 'P1D', 'P2', 'P2D', 'P0'];
    const filenameUpper = path.basename(p).toUpperCase();
    const isValid = PRIORIDAD_MAP.some(pat => filenameUpper.includes(pat));

    if (isZip) {
      console.log(`📦 Procesando ZIP: ${p}`);
      try {
        const buffer = await fs.promises.readFile(p);
        const zip = await JSZip.loadAsync(buffer);
        for (const filename of Object.keys(zip.files)) {
          if (!zip.files[filename].dir) {
            const innerUpper = filename.toUpperCase();
            if (PRIORIDAD_MAP.some(pat => innerUpper.includes(pat))) {
              const content = await zip.files[filename].async('string');
              const res = await processCchCsv(content, filename, 'LOCAL_SCAN');
              totalSuccess += res.success;
              totalSkipped += res.skipped;
            }
          }
        }
        processedFiles++;
      } catch (e) {
        console.error(`❌ Error en ZIP ${p}:`, e);
      }
    } else if (isValid) {
      console.log(`📄 Procesando fichero de curvas: ${p}`);
      try {
        let content = '';
        if (lower.endsWith('.bz2')) {
          const unbzip2Stream = require('unbzip2-stream');
          content = await new Promise<string>((resolve, reject) => {
            const stream = fs.createReadStream(p).pipe(unbzip2Stream());
            let data = '';
            stream.on('data', chunk => data += chunk);
            stream.on('end', () => resolve(data));
            stream.on('error', reject);
          });
        } else if (lower.endsWith('.gz')) {
          const zlib = require('zlib');
          const buffer = await fs.promises.readFile(p);
          content = zlib.gunzipSync(buffer).toString('utf8');
        } else if (lower.endsWith('.xlsx')) {
          const XLSX = require('xlsx');
          const workbook = XLSX.readFile(p);
          const sheetName = workbook.SheetNames[0];
          content = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { FS: ';' });
        } else {
          content = await fs.promises.readFile(p, 'utf8');
        }
        
        // El nombre real dentro del BZ2 suele ser sin la extensión bz2
        const baseName = lower.endsWith('.bz2') ? path.basename(p, '.bz2') : path.basename(p);
        
        const res = await processCchCsv(content, baseName, 'LOCAL_SCAN');
        totalSuccess += res.success;
        totalSkipped += res.skipped;
        processedFiles++;
      } catch (e) {
        console.error(`❌ Error en fichero ${p}:`, e);
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
