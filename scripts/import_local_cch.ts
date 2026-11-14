import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { isRecognizedCchFilename, processCchBuffer } from '../src/lib/services/cchParser';

const rootDir = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\CCH\\Endesa\\2025\\202510';
const minDate = new Date('1970-01-01T00:00:00.000Z');

async function* walk(dir: string): AsyncGenerator<string> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(entry);
    else if (d.isFile()) yield entry;
  }
}

async function main() {
  console.log(`🔍 Buscando archivos de curvas en: ${rootDir}`);
  let processedFiles = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for await (const p of walk(rootDir)) {
    const stat = await fs.promises.stat(p);
    if (stat.mtime < minDate) continue;

    const baseName = path.basename(p);
    if (!isRecognizedCchFilename(baseName, false)) continue;

    console.log(`📄 Procesando: ${p}`);
    try {
      const buffer = await fs.promises.readFile(p);
      const res = await processCchBuffer(buffer, baseName, 'LOCAL_SCAN', true);
      totalSuccess += res.success;
      totalSkipped += res.skipped;
      totalErrors += res.errors;
      processedFiles++;
    } catch (e) {
      console.error(`❌ Error en fichero ${p}:`, e);
      totalErrors++;
    }
  }

  console.log(`\n🎉 ¡Escaneo completado!`);
  console.log(`Archivos procesados: ${processedFiles}`);
  console.log(`Curvas insertadas/actualizadas: ${totalSuccess}`);
  console.log(`Ignoradas: ${totalSkipped}`);
  console.log(`Errores: ${totalErrors}`);
  process.exit(0);
}

main().catch(console.error);
