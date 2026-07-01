import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { processCchCsv } from './src/lib/services/cchParser';
import { AggregationService } from './src/lib/services/AggregationService';
import { runCalculatePendingEnergy } from './src/scripts/calculate_pending_energy';

async function processFile(filePath: string, filename: string, content: string) {
  try {
    const result = await processCchCsv(content, filename, 'BULK_DESKTOP');
    console.log(`[OK] ${filename}: ${result.success} procesadas, ${result.skipped} saltadas, ${result.errors} errores.`);
  } catch (err: any) {
    console.error(`[ERR] Fallo al procesar ${filename}: ${err.message}`);
  }
}

async function walkDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      await walkDir(fullPath);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.zip') {
        console.log(`Abriendo ZIP: ${fullPath}`);
        try {
          const zip = new AdmZip(fullPath);
          const zipEntries = zip.getEntries();
          for (const entry of zipEntries) {
            if (!entry.isDirectory && (entry.entryName.toLowerCase().endsWith('.csv') || entry.entryName.toLowerCase().endsWith('.txt'))) {
              const content = zip.readAsText(entry);
              await processFile(fullPath + '::' + entry.entryName, entry.name, content);
            }
          }
        } catch (e: any) {
          console.error(`Error leyendo ZIP ${fullPath}: ${e.message}`);
        }
      } else if (ext === '.csv' || ext === '.txt') {
        const content = fs.readFileSync(fullPath, 'utf8');
        await processFile(fullPath, file, content);
      }
    }
  }
}

async function main() {
  const targetDir = 'C:\\Users\\Administrator\\Desktop\\CCH\\Endesa\\nuevas';
  console.log(`Iniciando importación masiva desde: ${targetDir}`);
  
  if (!fs.existsSync(targetDir)) {
    console.error(`La carpeta ${targetDir} no existe.`);
    process.exit(1);
  }

  await walkDir(targetDir);
  
  console.log('\n--- IMPORTACIÓN FINALIZADA ---');
  console.log('Forzando reagrupación de consumos (150 días)...');
  await AggregationService.regenerateAggregates(150);
  
  console.log('Recalculando energía pendiente...');
  await runCalculatePendingEnergy();
  
  console.log('¡Todo completado!');
}

main().catch(console.error);
