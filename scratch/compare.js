const fs = require('fs');
const xlsx = require('xlsx');

// Read Manual CSV
const csvContent = fs.readFileSync('Z:\\AED\\Tera\\Altas TERA\\260721_m1n.csv', 'utf8');
const csvLines = csvContent.split(/\r?\n/);
const csvHeaders = csvLines[0].split(';');
const csvData = csvLines[1].split(';');

// Read Generated XLSX
const workbook = xlsx.readFile('Z:\\AED\\Tera\\Altas TERA\\Exportacion_Contratos_2026-07-21.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const xlsxData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

const xlsxHeaders = xlsxData[0];
// Find the row for PRPR2510301219NM0F in xlsx
let xlsxRow = null;
for(let i = 1; i < xlsxData.length; i++) {
    if(xlsxData[i][0] === 'PRPR2510301219NM0F') {
        xlsxRow = xlsxData[i];
        break;
    }
}

if (!xlsxRow) {
    console.log("Contract PRPR2510301219NM0F not found in the generated XLSX!");
    process.exit(1);
}

console.log("=== COMPARING COLUMNS for PRPR2510301219NM0F ===");
let diffCount = 0;
for (let i = 0; i < csvHeaders.length; i++) {
    const colName = csvHeaders[i];
    const csvVal = String(csvData[i]).trim();
    // find the same column in xlsx
    const xlsxColIndex = xlsxHeaders.indexOf(colName);
    if (xlsxColIndex === -1) {
        console.log(`Column ${colName} is missing in XLSX headers!`);
        diffCount++;
        continue;
    }
    
    let xlsxVal = String(xlsxRow[xlsxColIndex]).trim();
    
    // Normalize both values (empty handling)
    if (csvVal === 'undefined') csvVal = '';
    if (xlsxVal === 'undefined') xlsxVal = '';

    if (csvVal !== xlsxVal) {
        console.log(`Mismatch in [${colName}]:`);
        console.log(`  Manual CSV : "${csvVal}"`);
        console.log(`  Generado   : "${xlsxVal}"`);
        diffCount++;
    }
}

console.log(`\nComparison complete. ${diffCount} differences found.`);
