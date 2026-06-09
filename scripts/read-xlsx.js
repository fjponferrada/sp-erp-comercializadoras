const xlsx = require('xlsx');

const filePath = 'C:\\\\Users\\\\Administrator\\\\sp-erp-comercializadoras\\\\docs\\\\diccionario_productos.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log(JSON.stringify(data, null, 2));
