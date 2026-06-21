const XLSX = require('xlsx');

const excelFile = 'C:\\Users\\Administrator\\tmp_backup\\Com_PR_2604_.xlsx';

const wb = XLSX.readFile(excelFile);
const sheetName = wb.SheetNames[0];
const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

for (let i = 0; i < Math.min(15, rawData.length); i++) {
    console.log(`Row ${i}:`, rawData[i]);
}
