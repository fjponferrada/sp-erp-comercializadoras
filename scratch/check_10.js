const fs = require('fs');

const providerCsvPath = 'Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv';
const csvContent = fs.readFileSync(providerCsvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim().length > 0);

for (let i = 15; i < 60; i++) {
  const row = lines[i].split(';');
  const hora = row[9];
  const consumption = row[28];
  
  if (hora === '10') {
    console.log(`Hora ${hora}: Consumption = ${consumption}`);
  }
}
