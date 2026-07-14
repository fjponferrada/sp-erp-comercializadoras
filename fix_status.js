const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/actions/switchingIngest.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace status: 'ACTIVO' ONLY when it's part of a where clause, or simply replace `status: 'ACTIVO'` with `status: { in: ['ACTIVO', 'Activo'] }` but avoid `data: { ... status: 'ACTIVO' }`.
// A safer way is to match `where: { ... status: 'ACTIVO'` 
// Actually, let's just do a manual replacement using a function

content = content.replace(/(where:\s*\{.*?status:\s*)'ACTIVO'/g, "$1{ in: ['ACTIVO', 'Activo', 'ACTIVE', 'Active'] }");
content = content.replace(/(where:\s*\{.*?status:\s*)'TRAMITANDO'/g, "$1{ in: ['TRAMITANDO', 'Tramitando'] }");

// And for the specific array ones:
content = content.replace(/status:\s*\{\s*in:\s*\['BORRADOR',\s*'ACEPTADO',\s*'TRAMITANDO'\]\s*\}/g, "status: { in: ['BORRADOR', 'Borrador', 'ACEPTADO', 'Aceptado', 'TRAMITANDO', 'Tramitando'] }");
content = content.replace(/status:\s*\{\s*in:\s*\['ACEPTADO',\s*'Rechazo Distribuidora',\s*'RECHAZADO'\]\s*\}/g, "status: { in: ['ACEPTADO', 'Aceptado', 'Rechazo Distribuidora', 'RECHAZADO', 'Rechazado'] }");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed status case sensitivity in queries.');
