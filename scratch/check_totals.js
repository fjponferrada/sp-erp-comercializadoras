const fs = require('fs');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');

const excelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf7f.xlsx";
const csvPath = "Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv";

const workbook = xlsx.readFile(excelPath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });
let excelDataRows = excelData.slice(3).filter(r => r[0] && r[0].length > 0 && r[0] !== 'Fecha' && r[0] !== 'Totales');

const csvContent = fs.readFileSync(csvPath, 'utf8');
const csvData = parse(csvContent, { delimiter: ';', relax_column_count: true });
let headerRow = csvData[0];
let fechaIdx = headerRow.indexOf('Fecha');
let consumoIdx = headerRow.indexOf('Consumption');

let csvDataRows = csvData.slice(1).filter(r => r[fechaIdx] && r[fechaIdx].includes('/2026'));

let totalErp = 0;
for (let r of excelDataRows) {
  totalErp += parseFloat((r[3] || '0').toString().replace(',', '.'));
}

let totalProv = 0;
for (let r of csvDataRows) {
  totalProv += parseFloat((r[consumoIdx] || '0').toString().replace(',', '.'));
}

console.log("Total ERP Consumo:", totalErp);
console.log("Total PROV Consumo:", totalProv);
