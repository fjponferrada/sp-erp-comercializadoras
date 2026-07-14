const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2026\\Recibidas\\Reene PPA\\Aljaval MSA 202694.xlsx';

if (!fs.existsSync(filePath)) {
    console.log('File does not exist at:', filePath);
    process.exit(1);
}

const wb = xlsx.readFile(filePath);
console.log('Sheets:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const sheet = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let i = 0; i < Math.min(30, data.length); i++) {
        console.log(`Row ${i}:`, data[i]);
    }
}
