const fs = require('fs');
const path = require('path');

const schemaPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'prisma', 'schema.prisma');
let content = fs.readFileSync(schemaPath, 'utf8');

const fieldsToRemove = [
    '  p1eCoste Float?',
    '  p2eCoste Float?',
    '  p3eCoste Float?',
    '  p4eCoste Float?',
    '  p5eCoste Float?',
    '  p6eCoste Float?',
    '  ip             Float?',
    '  fc             Float?',
    '  gasIncluido    Boolean @default(false)'
];

fieldsToRemove.forEach(field => {
    content = content.replace(field, `  // REMOVED: ${field.trim()}`);
});

fs.writeFileSync(schemaPath, content);
console.log('Product schema cleaned successfully.');
