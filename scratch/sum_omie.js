const fs = require('fs');

const providerCsvPath = 'Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv';
const csvContent = fs.readFileSync(providerCsvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim().length > 0);

for (let i = 15; i < lines.length; i++) {
  const row = lines[i].split(';');
  const hora = row[9];
  const subtotal = parseFloat((row[27] || '0').replace(',', '.'));
  const consumption = parseFloat((row[28] || '0').replace(',', '.'));
  const total = parseFloat((row[29] || '0').replace(',', '.'));
  
  if (hora === '10' && consumption > 0) {
    console.log(`Hora 10: Subtotal=${subtotal}, Consumption=${consumption}, Total=${total}`);
    break;
  }
}
