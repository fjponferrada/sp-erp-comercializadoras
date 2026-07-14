const fs = require('fs');
const providerCsvPath = "Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv";
const lines = fs.readFileSync(providerCsvPath, 'utf8').split('\n');
console.log(lines[12]);
console.log(lines[13]);
