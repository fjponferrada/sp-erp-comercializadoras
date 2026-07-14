import fs from 'fs';
import { CompodemService } from '../lib/services/CompodemService';

const zipPath = 'Z:/AED/REE/Liquidaciones/8-C2_liquicomun-2025-06-01T00-00-00Z_2026-07-13T23-59-59_datos.zip';

try {
  const buffer = fs.readFileSync(zipPath);
  const files = CompodemService.getCompodemFiles(buffer);
  
  console.log(`Found ${files.length} compodem files in zip.`);
  
  for (const file of files.slice(0, 5)) { // Just first 5 for testing
    console.log(`File name: ${file.name}`);
    const match = file.name.match(/([AC]\d)_compodem/i);
    const version = match ? match[1].toUpperCase() : 'C0';
    console.log(`Matched version: ${version}`);
  }
} catch (e) {
  console.error('Error:', e);
}
