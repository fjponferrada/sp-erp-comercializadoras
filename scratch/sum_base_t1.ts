import * as fs from 'fs';
import * as path from 'path';

function main() {
  const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2025_T1.txt';
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  let totalBaseImponible = 0;

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length >= 12) {
      const baseImponible = parseFloat(parts[2]) || 0;
      totalBaseImponible += baseImponible;
    }
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  
  console.log(`--- T1 2025 ---`);
  console.log(`Base Imponible: ${round2(totalBaseImponible).toFixed(2)}`);
}

main();
