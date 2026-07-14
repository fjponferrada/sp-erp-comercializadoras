const fs = require('fs');

const providerCsvPath = 'Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv';
const csvContent = fs.readFileSync(providerCsvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim().length > 0);

const header = lines[0].split(';');
const row1 = lines[18].split(';'); // Data row

for (let i = 0; i < header.length; i++) {
  console.log(`${i}. ${header[i]}: ${row1[i]}`);
}
