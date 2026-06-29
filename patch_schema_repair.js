const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Add REQUIERE_REPARACION to InternalInvoiceStatus
schema = schema.replace(
  /enum InternalInvoiceStatus \{\s*BORRADOR\s*EMITIDA\s*ABONO\s*\}/m,
  "enum InternalInvoiceStatus {\n  BORRADOR\n  EMITIDA\n  ABONO\n  REQUIERE_REPARACION\n}"
);

// 2. Add repairData to InternalInvoice
const modelRegex = /(model InternalInvoice \{[^}]*)(\})/;
schema = schema.replace(modelRegex, "$1  repairData         Json?\n$2");

fs.writeFileSync(schemaPath, schema);
console.log("Schema patched for repair data successfully!");
