import * as fs from 'fs';
import * as path from 'path';

const dir = 'Z:\\Documentos\\Escritorio\\Trimestre 2025\\2025';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  let totalBase = 0;
  let totalCuota = 0;
  
  const lines = content.split('\n').filter(l => l.trim() !== '');
  for (const line of lines) {
    const parts = line.split(';');
    const base = parseFloat(parts[4]) || 0;
    // Assuming field 11 (index 10) is Cuota if 98.1E has it, or index 10 for SBFI
    const cuota = parseFloat(parts[10]) || 0;
    
    totalBase += base;
    totalCuota += cuota;
  }
  
  console.log(`--- ${file} ---`);
  console.log(`Total Base Sujeta: ${totalBase.toFixed(2)}`);
  console.log(`Total Cuota: ${totalCuota.toFixed(2)}`);
}
