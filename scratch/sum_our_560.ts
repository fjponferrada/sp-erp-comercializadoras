import * as fs from 'fs';
import * as path from 'path';

const dir = 'Z:\\AED\\AEAT\\560';
const files = fs.readdirSync(dir).filter(f => f.startsWith('Desglose_560_Espaa_2025_T') && f.endsWith('.txt'));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf-8');
  let totalBase = 0;
  let totalCuota = 0;
  
  const lines = content.split('\n').filter(l => l.trim() !== '');
  for (const line of lines) {
    const parts = line.split(';');
    const base = parseFloat(parts[4]) || 0;
    const cuota = parseFloat(parts[10]) || 0;
    
    totalBase += base;
    totalCuota += cuota;
  }
  
  console.log(`--- ${file} ---`);
  console.log(`Total Base Sujeta: ${totalBase.toFixed(2)}`);
  console.log(`Total Cuota: ${totalCuota.toFixed(2)}`);
}
