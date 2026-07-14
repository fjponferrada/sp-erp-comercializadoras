import * as fs from 'fs';
import * as path from 'path';

function main() {
  const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2025_T1.txt';
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);

  let totalCuotaIntegra = 0;
  let totalCuotaMinima = 0;

  for (const line of lines) {
    const parts = line.split(';');
    // Columns (0-indexed):
    // 0: RegimenFiscal
    // ...
    // 10: CuotaIntegra
    // 11: CuotaMinima
    if (parts.length >= 12) {
      const cuotaIntegra = parseFloat(parts[10]) || 0;
      const cuotaMinima = parseFloat(parts[11]) || 0;
      totalCuotaIntegra += cuotaIntegra;
      totalCuotaMinima += cuotaMinima;
    }
  }

  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  
  console.log(`--- T1 2025 ---`);
  console.log(`Cuota Íntegra: ${round2(totalCuotaIntegra).toFixed(2)}`);
  console.log(`Cuota Mínima: ${round2(totalCuotaMinima).toFixed(2)}`);
  console.log(`TOTAL LIQUIDACIÓN: ${round2(totalCuotaIntegra + totalCuotaMinima).toFixed(2)}`);
}

main();
