import * as fs from 'fs';

const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2026_T2.txt';
const content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n').filter(line => line.trim() !== '');

let totalBaseImponible = 0;
let totalCantidad = 0;
let totalCuotaIntegra = 0;
let totalCuotaMinima = 0;
let totalImpuestoCalculado = 0;

for (const line of lines) {
  const cols = line.split(';');
  if (cols.length >= 12) {
    const base = parseFloat(cols[2]) || 0;
    const cantidad = parseFloat(cols[5]) || 0;
    const cuotaIntegra = parseFloat(cols[10]) || 0;
    const cuotaMinima = parseFloat(cols[11]) || 0;
    
    totalBaseImponible += base;
    totalCantidad += cantidad;
    totalCuotaIntegra += cuotaIntegra;
    totalCuotaMinima += cuotaMinima;
    totalImpuestoCalculado += Math.max(cuotaIntegra, cuotaMinima);
  }
}

console.log('--- RESULTADOS DEL FICHERO TXT (ESPAÑA) ---');
console.log(`Total Registros: ${lines.length}`);
console.log(`Total Base Imponible: ${totalBaseImponible.toFixed(2)}`);
console.log(`Total Cantidad (MWh): ${totalCantidad.toFixed(3)}`);
console.log(`Total Cuota Íntegra: ${totalCuotaIntegra.toFixed(2)}`);
console.log(`Total Cuota Mínima: ${totalCuotaMinima.toFixed(2)}`);
console.log(`Total Impuesto a Pagar (Suma de Max por registro): ${totalImpuestoCalculado.toFixed(2)}`);
