import * as fs from 'fs';
import * as path from 'path';

function sumFile(filePath: string) {
  let totalIntegra = 0;
  let totalMinima = 0;
  if (!fs.existsSync(filePath)) {
    console.log(`Fichero no encontrado: ${filePath}`);
    return { totalIntegra, totalMinima };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  content.trim().split('\n').forEach(line => {
    const parts = line.split(';');
    if (parts.length >= 12) {
      const integra = parseFloat(parts[10]) || 0;
      const minima = parseFloat(parts[11]) || 0;
      totalIntegra += integra;
      totalMinima += minima;
    }
  });
  return { totalIntegra, totalMinima };
}

const dir = 'Z:\\AED\\AEAT (hasta 16jul)\\560';
const file1 = path.join(dir, 'Desglose_560_Espaa_2026_T2_Abril_Mayo_0.5.txt');
const file2 = path.join(dir, 'Desglose_560_Espaa_2026_T2_Junio_5.11.txt');

const sum1 = sumFile(file1);
const sum2 = sumFile(file2);

console.log('--- ABRIL/MAYO (0.5%) ---');
console.log(`Cuota Íntegra: ${sum1.totalIntegra.toFixed(2)}`);
console.log(`Cuota Mínima: ${sum1.totalMinima.toFixed(2)}`);
console.log(`Total Liquidación Abril/Mayo: ${(sum1.totalIntegra + sum1.totalMinima).toFixed(2)}\n`);

console.log('--- JUNIO (5.11%) ---');
console.log(`Cuota Íntegra: ${sum2.totalIntegra.toFixed(2)}`);
console.log(`Cuota Mínima: ${sum2.totalMinima.toFixed(2)}`);
console.log(`Total Liquidación Junio: ${(sum2.totalIntegra + sum2.totalMinima).toFixed(2)}\n`);

console.log('--- SUMA DE AMBOS FICHEROS ---');
const granIntegra = sum1.totalIntegra + sum2.totalIntegra;
const granMinima = sum1.totalMinima + sum2.totalMinima;
const granTotal = granIntegra + granMinima;
console.log(`Cuota Íntegra Global: ${granIntegra.toFixed(2)} (Global Original: 15894.19)`);
console.log(`Cuota Mínima Global: ${granMinima.toFixed(2)} (Global Original: 1676.82)`);
console.log(`TOTAL GLOBAL: ${granTotal.toFixed(2)} (Global Original: 17571.01)`);
