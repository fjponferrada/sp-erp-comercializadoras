const fs = require('fs');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');

const excelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf7f.xlsx";
const csvPath = "Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv";

const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

console.log("EXCEL DATA:");
console.log("Headers:", excelData[2]);
let excelDataRows = excelData.slice(3).filter(r => r[0] && r[0].length > 0);
console.log("First data row:", excelDataRows[0]);

const csvContent = fs.readFileSync(csvPath, 'utf8');
const csvData = parse(csvContent, { delimiter: ';', relax_column_count: true });

console.log("\nCSV DATA:");
let headerRow = csvData[0];
let fechaIdx = headerRow.indexOf('Fecha');
let horaIdx = headerRow.indexOf('Hora');
let consumoIdx = headerRow.indexOf('Consumption');
let totalIdx = headerRow.indexOf('total');
let subtotalIdx = headerRow.indexOf('Subtotal');

console.log(`Indices: Fecha=${fechaIdx}, Hora=${horaIdx}, Consumo=${consumoIdx}, Total=${totalIdx}`);

let csvDataRows = csvData.slice(1).filter(r => r[fechaIdx] && r[fechaIdx].includes('/2026'));
console.log("First data row:", csvDataRows[0]);
