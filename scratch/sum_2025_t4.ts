import * as fs from 'fs';
import { prisma } from '../src/lib/prisma';

async function main() {
  const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2025_T4.txt';
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  let totalCuotaIntegra = 0;
  let totalCuotaMinima = 0;
  let totalBaseTxt = 0;

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length >= 12) {
      const base = parseFloat(parts[2]) || 0;
      const cuotaIntegra = parseFloat(parts[10]) || 0;
      const cuotaMinima = parseFloat(parts[11]) || 0;
      totalBaseTxt += base;
      totalCuotaIntegra += cuotaIntegra;
      totalCuotaMinima += cuotaMinima;
    }
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  
  console.log(`--- T4 2025 TXT (Solo España) ---`);
  console.log(`Base Imponible TXT: ${round2(totalBaseTxt).toFixed(2)}`);
  console.log(`Cuota Íntegra TXT: ${round2(totalCuotaIntegra).toFixed(2)}`);
  console.log(`Cuota Mínima TXT: ${round2(totalCuotaMinima).toFixed(2)}`);
  console.log(`TOTAL LIQUIDACIÓN TXT: ${round2(totalCuotaIntegra + totalCuotaMinima).toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
