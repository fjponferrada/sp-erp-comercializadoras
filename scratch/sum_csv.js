const fs = require('fs');

const providerCsvPath = 'Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv';
const csvContent = fs.readFileSync(providerCsvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim().length > 0);

const header = lines[0].split(';');

let sumSubtotal = 0;
let sumTotal = 0;
let sumConsumption = 0;

for (let i = 15; i < lines.length; i++) {
  const row = lines[i].split(';');
  if (row.length < 25) continue;
  
  const subtotal = parseFloat((row[27] || '0').replace(',', '.'));
  const consumption = parseFloat((row[28] || '0').replace(',', '.'));
  const total = parseFloat((row[29] || '0').replace(',', '.'));
  
  if (!isNaN(subtotal)) sumSubtotal += subtotal;
  if (!isNaN(total)) sumTotal += total;
  if (!isNaN(consumption)) sumConsumption += consumption;
}

console.log(`sumSubtotal: ${sumSubtotal}`);
console.log(`sumTotal: ${sumTotal}`);
console.log(`sumConsumption: ${sumConsumption}`);
