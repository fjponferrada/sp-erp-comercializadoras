const fs = require('fs');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');

const excelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf7f (1).xlsx";
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

let excelArr = excelDataRows.map(r => parseFloat((r[4]||'0').toString().replace(',','.')));
let csvArr = csvDataRows.map(r => parseFloat((r[headerRow.indexOf('OMIE')]||'0').toString().replace(',','.')));

console.log("Excel OMIE first 10:");
console.log(excelArr.slice(0, 10));
console.log("CSV OMIE first 10:");
console.log(csvArr.slice(0, 10));

// Find the offset by finding the best match for the first 20 elements
let bestOffset = 0;
let minDiff = Infinity;
for (let offset = -5; offset <= 5; offset++) {
  let diff = 0;
  for (let i = 0; i < 20; i++) {
    let eIdx = i;
    let cIdx = i + offset;
    if (cIdx >= 0 && cIdx < csvArr.length && eIdx < excelArr.length) {
      diff += Math.abs(excelArr[eIdx] - csvArr[cIdx]);
    }
  }
  if (diff < minDiff) {
    minDiff = diff;
    bestOffset = offset;
  }
}

console.log("Best CSV offset relative to Excel:", bestOffset);

