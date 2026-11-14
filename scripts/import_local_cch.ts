import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  getFilePriority,
  isRecognizedCchFilename,
  processCchBuffer,
} from '../src/lib/services/cchParser';

const rootDir = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\CCH\\Endesa\\2025\\202510';
const minDate = new Date('1970-01-01T00:00:00.000Z');

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) await walk(entry, acc);
    else if (d.isFile()) acc.push(entry);
  }
  return acc;
}

function parseSortKeys(filePath: string) {
  const baseName = path.basename(filePath);
  const prio = getFilePriority(baseName);
  const dateMatch = baseName.match(/(?:^|[_.\-\s])(20\d{6})(?:[_.\-\s]|$)/) || baseName.match(/(20\d{6})/);
  const fileDate = dateMatch ? dateMatch[1] : '00000000';
  const verMatch =
    baseName.match(/\.(\d+)\.(?:zip|bz2|gz|csv|txt)$/i) || baseName.match(/\.(\d+)$/);
  const version = verMatch ? parseInt(verMatch[1], 10) : 0;
  return { filePath, baseName, prio, fileDate, version };
}

async function main() {
  console.log(`🔍 Buscando archivos de curvas en: ${rootDir}`);
  const allFiles = await walk(rootDir);
  const candidates = [];

  for (const p of allFiles) {
    const stat = await fs.promises.stat(p);
    if (stat.mtime < minDate) continue;
    const baseName = path.basename(p);
    if (!isRecognizedCchFilename(baseName, false)) continue;
    candidates.push(parseSortKeys(p));
  }

  // Mayor prioridad CNMC primero; dentro de cada tipo, orden cronológico y versión (.0 -> .1) ascendente
  candidates.sort((a, b) => {
    if (b.prio !== a.prio) return b.prio - a.prio;
    if (a.fileDate !== b.fileDate) return a.fileDate.localeCompare(b.fileDate);
    if (a.version !== b.version) return a.version - b.version;
    return a.filePath.localeCompare(b.filePath);
  });

  let processedFiles = 0;
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const item of candidates) {
    console.log(`📄 Procesando: ${item.filePath}`);
    try {
      const buffer = await fs.promises.readFile(item.filePath);
      const res = await processCchBuffer(buffer, item.baseName, 'LOCAL_SCAN', true);
      totalSuccess += res.success;
      totalSkipped += res.skipped;
      totalErrors += res.errors;
      processedFiles++;
    } catch (e) {
      console.error(`❌ Error en fichero ${item.filePath}:`, e);
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
