const XLSX = require('xlsx');
const workbook = XLSX.readFile('C:\\Users\\Administrator\\tmp_backup\\202606260644_2.0TD_riesgo_1_fee_0.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);
console.log('PROPUESTA COMERCIAL:');
console.table(data);

const sheetName2 = workbook.SheetNames[1];
const sheet2 = workbook.Sheets[sheetName2];
const data2 = XLSX.utils.sheet_to_json(sheet2);
console.log('\nDETALLE HORARIO (Primeras 5 filas):');
console.table(data2.slice(0, 5));
