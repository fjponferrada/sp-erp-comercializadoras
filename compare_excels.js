const XLSX = require('xlsx');

const erpFile = 'C:\\Users\\Administrator\\tmp_backup\\liquidacion_upfront_2026-04-02_a_2026-05-01.xlsx';
const excelFile = 'C:\\Users\\Administrator\\tmp_backup\\Com_PR_2604_.xlsx';

function readSheet(filePath, sheetIndex) {
    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames[sheetIndex];
    if (!sheetName) return [];
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
}

try {
    const erpData = readSheet(erpFile, 0); // Assuming first sheet is Comisiones
    const excelData = readSheet(excelFile, 0); // Assuming first sheet has the data

    console.log(`ERP Data rows: ${erpData.length}`);
    console.log(`Excel Data rows: ${excelData.length}`);

    // Let's print the first row of each to understand the structure
    console.log('\nERP Columns:', Object.keys(erpData[0] || {}));
    console.log('Excel Columns:', Object.keys(excelData[0] || {}));

} catch (e) {
    console.error(e);
}
