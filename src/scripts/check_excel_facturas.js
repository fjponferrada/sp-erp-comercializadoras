const xlsx = require('xlsx');
const path = require('path');

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const file = 'diccionario_facturas.xlsx';

const filePath = path.join(docsDir, file);
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets['Diccionario'];
const data = xlsx.utils.sheet_to_json(sheet);

console.log(`\n--- Descriptions in ${file.toUpperCase()} ---`);
let count = 0;
data.forEach(row => {
    const desc = row['Descripción / Significado'];
    const name = row['Nombre Airtable'];
    if (desc && !desc.includes('Pendiente de definir')) {
        console.log(`Campo: ${name}`);
        console.log(`Desc: ${desc}`);
        console.log('-----------------------------------');
        count++;
    }
});
console.log(`Total fields read in ${file}: ${count}`);
