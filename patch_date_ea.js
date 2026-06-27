const fs = require('fs');

const FILE_PATH = 'src/app/(app)/contratos/[id]/ContractDetailClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

content = content.replace(
  "new Date(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA).toLocaleDateString('es-ES')",
  "formatDateUTC(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA)"
);
content = content.replace(
  "new Date(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA).toLocaleDateString('es-ES')",
  "formatDateUTC(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA)"
);

content = content.replace(
  "new Date(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA).toLocaleDateString('es-ES')",
  "formatDateUTC(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA)"
);
content = content.replace(
  "new Date(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA).toLocaleDateString('es-ES')",
  "formatDateUTC(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA)"
);

fs.writeFileSync(FILE_PATH, content);
console.log('Fixed EA dates.');
