const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

function addToModel(modelName, newField) {
  const regex = new RegExp(`(model ${modelName} \\{[^}]*)(\\})`, 'm');
  schema = schema.replace(regex, `$1  ${newField}\n$2`);
}

addToModel('Invoice', 'xmlUrl String?');
addToModel('InternalInvoice', 'xmlUrl String?');

fs.writeFileSync(schemaPath, schema);
console.log("Schema patched with xmlUrl successfully!");
