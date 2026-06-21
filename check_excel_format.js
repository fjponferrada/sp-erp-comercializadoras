const xlsx = require('xlsx');
const workbook = xlsx.readFile('C:\\Users\\Administrator\\tmp_backup\\260620 FACTURACION ERANOVUM 12JUN26 - 20JUN26.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log("Headers:");
console.log(data[0]);
console.log("Row 1:");
console.log(data[1]);
