const fs = require('fs');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');

const excelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf7f (3).xlsx";
const csvPath = "Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv";

const workbook = xlsx.readFile(excelPath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });

const headerRowIndex = 4;
const excelHeader = excelData[headerRowIndex];
let excelDataRows = excelData.slice(headerRowIndex + 1).filter(r => r[0] && r[0].length > 0 && r[0] !== 'Fecha' && r[0] !== 'TOTALES');

const csvContent = fs.readFileSync(csvPath, 'utf8');
const csvData = parse(csvContent, { delimiter: ';', relax_column_count: true });
let csvHeaderRow = csvData[0];
let fechaIdx = csvHeaderRow.indexOf('Fecha');
let horaIdx = csvHeaderRow.indexOf('Hora');

let csvDataRows = csvData.slice(1).filter(r => r[fechaIdx] && r[fechaIdx].includes('/2026'));

function normDate(d) {
  if (typeof d !== 'string') return d;
  let parts = d.split('/');
  if (parts.length === 3) {
    return parts[0].padStart(2, '0') + '/' + parts[1].padStart(2, '0') + '/' + parts[2];
  }
  return d;
}

function getColIdx(headerArray, colName) {
    for (let i=0; i<headerArray.length; i++) {
        if (headerArray[i] && headerArray[i].includes(colName)) return i;
    }
    return -1;
}

const excelMap = new Map();
for (let row of excelDataRows) {
  const fecha = normDate(row[0]);
  const time = row[1];
  if (!time || !time.includes(':')) continue;
  
  const key = `${fecha}_${time}`; // e.g. 01/06/2026_00:15
  
  const comps = ['RT3', 'RT6', 'CT2', 'CT3', 'BS3', 'RAD3', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP'];
  let sumAjustes = 0;
  for (const c of comps) {
      const idx = getColIdx(excelHeader, c);
      if (idx !== -1) {
          sumAjustes += parseFloat((row[idx] || '0').toString().replace(',', '.'));
      }
  }

  excelMap.set(key, { 
    Fecha: fecha, 
    Time: time, 
    SumaAjustes: sumAjustes
  });
}

const csvMap = new Map();
let dateHourCount = {};

for (let row of csvDataRows) {
  const fecha = normDate(row[fechaIdx]);
  const providerHora = parseInt(row[horaIdx], 10);
  if (isNaN(providerHora)) continue;
  
  const dhKey = `${fecha}_${providerHora}`;
  if (!dateHourCount[dhKey]) dateHourCount[dhKey] = 0;
  
  const q = dateHourCount[dhKey];
  dateHourCount[dhKey]++;
  
  const hStr = providerHora.toString().padStart(2, '0');
  const mStr = (q * 15).toString().padStart(2, '0');
  const time = `${hStr}:${mStr}`;
  
  const key = `${fecha}_${time}`;
  
  csvMap.set(key, {
    Fecha: fecha,
    Time: time,
    Servicio: parseFloat((row[csvHeaderRow.indexOf('servicio')]||"0").replace(',', '.'))
  });
}

let commonKeys = Array.from(excelMap.keys()).filter(k => csvMap.has(k));
let diffs = [];
for (let k of commonKeys) {
  const erp = excelMap.get(k);
  const prov = csvMap.get(k);
  const diff = prov.Servicio - erp.SumaAjustes;
  diffs.push(diff);
}

diffs.sort((a,b) => a-b);
console.log("Min diff:", diffs[0]);
console.log("Max diff:", diffs[diffs.length-1]);
console.log("Avg diff:", diffs.reduce((a,b)=>a+b,0)/diffs.length);
