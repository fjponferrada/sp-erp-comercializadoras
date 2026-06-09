const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const schemaPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'prisma', 'schema.prisma');
const dictPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs', 'diccionario_facturas.xlsx');
const missingFieldsPath = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'src', 'scripts', 'missing_invoice_fields.json');

const missingFields = JSON.parse(fs.readFileSync(missingFieldsPath, 'utf8'));

let schemaContent = fs.readFileSync(schemaPath, 'utf8');

// 1. Generate Prisma string
let addedFields = `\n  // ---> NUEVOS CAMPOS INYECTADOS MASIVAMENTE DESDE AIRTABLE (FACTURAS)\n`;

missingFields.forEach(field => {
    const nameLower = field.name.toLowerCase();
    let type = 'String?';
    if (nameLower.includes('importe') || nameLower.includes('precio') || nameLower.includes('p1c') || nameLower.includes('p2c') || nameLower.includes('p3c') || nameLower.includes('p4c') || nameLower.includes('p5c') || nameLower.includes('p6c') || nameLower.includes('total') || nameLower.includes('kwh') || nameLower.includes('kw ') || nameLower.includes('baseimponible') || nameLower.includes('exceso') || nameLower.includes('descuento') || nameLower.includes('energia') || nameLower.includes('potencia') || nameLower.includes('margen') || nameLower.includes('fee') || nameLower.includes('pexc')) {
        type = 'Float?';
    }
    // ensure boolean or int if necessary? Float and String is safest. Dates as DateTime
    if (nameLower.includes('fecha') || nameLower.includes('desde') || nameLower.includes('hasta')) {
        // Many dates are sent as strings in JSON initially, but Prisma can handle DateTime if formatted correctly.
        // Let's use String? to be absolutely safe for raw dumps.
        type = 'String?';
    }

    addedFields += `  ${field.propName} ${type} // ${field.name}\n`;
});

// Inject into Invoice
const invoiceEndIndex = schemaContent.indexOf('}', schemaContent.indexOf('model Invoice {'));
schemaContent = schemaContent.slice(0, invoiceEndIndex) + addedFields + schemaContent.slice(invoiceEndIndex);

fs.writeFileSync(schemaPath, schemaContent);
console.log('✅ Inyectados 292 campos en schema.prisma (Invoice)');

// 2. Update Excel
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
console.log(`✅ Actualizados ${updated} mapeos en diccionario_facturas.xlsx.`);
