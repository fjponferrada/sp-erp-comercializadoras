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
let horaIdx = headerRow.indexOf('Hora');
let consumoIdx = headerRow.indexOf('Consumption');

let csvDataRows = csvData.slice(1).filter(r => r[fechaIdx] && r[fechaIdx].includes('/2026'));

function normDate(d) {
  if (typeof d !== 'string') return d;
  let parts = d.split('/');
  if (parts.length === 3) {
    return parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[2];
  }
  return d;
}

const excelMap = new Map();
for (let row of excelDataRows) {
  const fecha = normDate(row[0]);
  if (fecha !== '26/06/2026') continue;
  const time = row[1];
  if (!time || !time.includes(':')) continue;
  
  const hParts = time.split(':');
  let h = parseInt(hParts[0], 10);
  let m = parseInt(hParts[1], 10);
  
  let hora;
  if (m === 0) { hora = h; } else { hora = h + 1; }
  
  let keyFecha = fecha;
  if (hora === 0) {
    hora = 24;
    keyFecha = '25/06/2026'; // previous day, skip mapping for 26/06 list
  }
  
  const key = `${keyFecha}_${hora}`;
  
  if (!excelMap.has(key)) {
    excelMap.set(key, 0);
  }
  excelMap.set(key, excelMap.get(key) + parseFloat((row[3] || '0').toString().replace(',', '.')));
}

const csvMap = new Map();
for (let row of csvDataRows) {
  const fecha = normDate(row[fechaIdx]);
  if (fecha !== '26/06/2026') continue;
  const providerHora = parseInt(row[horaIdx], 10);
  const hora = providerHora + 1;
  const key = `${fecha}_${hora}`;
  
  csvMap.set(key, parseFloat((row[consumoIdx]||"0").replace(',', '.')));
}

console.log("Date: 26/06/2026");
console.log("Hora\tERP\tPROV");
for (let i = 1; i <= 24; i++) {
  let key = `26/06/2026_${i}`;
  console.log(`${i}\t${(excelMap.get(key)||0).toFixed(3)}\t${(csvMap.get(key)||0).toFixed(3)}`);
}
