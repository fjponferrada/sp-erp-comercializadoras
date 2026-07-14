const fs = require('fs');

const providerCsvPath = 'Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv';
const csvContent = fs.readFileSync(providerCsvPath, 'utf8');
const lines = csvContent.split('\n').filter(l => l.trim().length > 0);

console.log(`Provider CSV lines: ${lines.length}`);
