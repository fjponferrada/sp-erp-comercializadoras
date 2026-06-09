const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const schemaPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'prisma', 'schema.prisma');
const missingFieldsPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'src', 'scripts', 'missing_invoice_fields.json');

// 1. Revert schema.prisma
let schemaContent = fs.readFileSync(schemaPath, 'utf8');
const injectionMarker = '  // ---> NUEVOS CAMPOS INYECTADOS MASIVAMENTE DESDE AIRTABLE (FACTURAS)';
const injectionStartIndex = schemaContent.indexOf(injectionMarker);
if (injectionStartIndex > 0) {
    // Find the end of the Invoice block
    const invoiceEndIndex = schemaContent.indexOf('}', injectionStartIndex);
    schemaContent = schemaContent.slice(0, injectionStartIndex) + schemaContent.slice(invoiceEndIndex);
}

// 2. Filter missing fields
const missingFields = JSON.parse(fs.readFileSync(missingFieldsPath, 'utf8'));
let addedFields = `  // ---> NUEVOS CAMPOS INYECTADOS MASIVAMENTE DESDE AIRTABLE (FACTURAS)\n`;

missingFields.forEach(field => {
    // If the propName has a dot or slash, we just create a clean camelCase version of the Airtable name instead
    let propName = field.propName;
    if (propName.includes('.') || propName.includes('/')) {
        propName = field.name.replace(/[^a-zA-Z0-9]/g, ' ').trim().replace(/\s+(.)/g, (match, group1) => group1.toUpperCase()).replace(/\s/g, '');
        propName = propName.charAt(0).toLowerCase() + propName.slice(1);
        field.propName = propName; // update for dictionary
    }

    const nameLower = field.name.toLowerCase();
    let type = 'String?';
    if (nameLower.includes('importe') || nameLower.includes('precio') || nameLower.includes('p1c') || nameLower.includes('p2c') || nameLower.includes('p3c') || nameLower.includes('p4c') || nameLower.includes('p5c') || nameLower.includes('p6c') || nameLower.includes('total') || nameLower.includes('kwh') || nameLower.includes('kw ') || nameLower.includes('baseimponible') || nameLower.includes('exceso') || nameLower.includes('descuento') || nameLower.includes('energia') || nameLower.includes('potencia') || nameLower.includes('margen') || nameLower.includes('fee') || nameLower.includes('pexc')) {
        type = 'Float?';
    }
    if (nameLower.includes('fecha') || nameLower.includes('desde') || nameLower.includes('hasta')) {
        type = 'String?';
    }

    addedFields += `  ${propName} ${type} // ${field.name}\n`;
});

// Inject again
const invoiceEndIndex2 = schemaContent.indexOf('}', schemaContent.indexOf('model Invoice {'));
schemaContent = schemaContent.slice(0, invoiceEndIndex2) + addedFields + schemaContent.slice(invoiceEndIndex2);

fs.writeFileSync(schemaPath, schemaContent);
console.log('✅ Inyectados campos corregidos en schema.prisma (Invoice)');

// 3. Update Excel mapping
const dictPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs', 'diccionario_facturas.xlsx');
const workbook = xlsx.readFile(dictPath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

let updated = 0;
data.forEach(row => {
    const missingFieldMatch = missingFields.find(f => f.name === row['Nombre Airtable']);
    if (missingFieldMatch) {
        row['Campo Equivalente PostgreSQL'] = `invoice.${missingFieldMatch.propName}`;
        updated++;
    }
});

const worksheet = xlsx.utils.json_to_sheet(data);
worksheet['!cols'] = [ {wch: 35}, {wch: 80}, {wch: 40} ];
workbook.Sheets[sheetName] = worksheet;
xlsx.writeFile(workbook, dictPath);
console.log(`✅ Actualizados ${updated} mapeos corregidos en diccionario_facturas.xlsx.`);
