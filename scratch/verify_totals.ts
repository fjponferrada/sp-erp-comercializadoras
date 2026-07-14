import * as fs from 'fs';

const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_AEAT_560_2026_T2 (1).txt';
const content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n').filter(line => line.trim() !== '');

let totalBaseImponible = 0;
let totalCantidad = 0;
let totalCuotaIntegra = 0;
let totalCuotaMinima = 0;

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
  }
}

console.log('--- RESULTADOS DEL FICHERO TXT ---');
console.log(`Total Registros: ${lines.length}`);
console.log(`Total Base Imponible: ${totalBaseImponible.toFixed(2)}`);
console.log(`Total Cantidad (MWh): ${totalCantidad.toFixed(3)}`);
console.log(`Total Cuota Íntegra: ${totalCuotaIntegra.toFixed(2)}`);
console.log(`Total Cuota Mínima: ${totalCuotaMinima.toFixed(2)}`);

// Simulate final total as ERP does (Max between Cuota Integra and Cuota Minima per invoice usually? 
// The ERP screen says: "Total Impuesto = 17.621,03 €"
// Let's sum max(cuotaIntegra, cuotaMinima) per row just to see:
let totalImpuestoCalculado = 0;
for (const line of lines) {
  const cols = line.split(';');
  if (cols.length >= 12) {
    const cuotaIntegra = parseFloat(cols[10]) || 0;
    const cuotaMinima = parseFloat(cols[11]) || 0;
    totalImpuestoCalculado += Math.max(cuotaIntegra, cuotaMinima);
  }
}
console.log(`Total Impuesto a Pagar (Suma de Max por registro): ${totalImpuestoCalculado.toFixed(2)}`);
