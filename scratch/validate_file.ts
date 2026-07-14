import * as fs from 'fs';

const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2026_T2.txt';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n').filter(line => line.trim() !== '');

let totalBaseImponible = 0;
let totalCuotaIntegra = 0;
let totalCuotaMinima = 0;
let totalMwh = 0;
let validLines = 0;
let errorLines = 0;
let sampleLine = '';

for (const line of lines) {
  const cols = line.split(';');
  if (cols.length !== 12) {
    errorLines++;
    continue;
  }
  
  validLines++;
  if (!sampleLine) sampleLine = line; // Save first valid line

  const base = parseFloat(cols[2]) || 0;
  const mwh = parseFloat(cols[5]) || 0;
  const cuotaIntegra = parseFloat(cols[10]) || 0;
  const cuotaMinima = parseFloat(cols[11]) || 0;
  
  totalBaseImponible += base;
  totalMwh += mwh;
  totalCuotaIntegra += cuotaIntegra;
  totalCuotaMinima += cuotaMinima;
}

console.log('--- VALIDACIÓN DEL FICHERO DESCARGADO ---');
console.log(`Líneas totales: ${lines.length}`);
console.log(`Líneas válidas (12 campos exactos): ${validLines}`);
console.log(`Líneas con error de formato: ${errorLines}`);
console.log('-----------------------------------------');
console.log(`Total Base Imponible: ${totalBaseImponible.toFixed(2)} €`);
console.log(`Total Consumo: ${totalMwh.toFixed(3)} MWh`);
console.log(`Total Cuota Íntegra: ${totalCuotaIntegra.toFixed(2)} €`);
console.log(`Total Cuota Mínima: ${totalCuotaMinima.toFixed(2)} €`);
console.log(`SUMA TOTAL IMPUESTO: ${(totalCuotaIntegra + totalCuotaMinima).toFixed(2)} €`);
console.log('-----------------------------------------');
console.log('Ejemplo de línea extraída del archivo:');
console.log(sampleLine);
