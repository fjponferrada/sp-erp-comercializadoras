const fs = require('fs');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');

const excelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf7f (3).xlsx";
const csvPath = "Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv";

const workbook = xlsx.readFile(excelPath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, dateNF: 'dd/mm/yyyy' });

// In the new format, the header is on row 4 (index 3)
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
  
  const hParts = time.split(':');
  let h = parseInt(hParts[0], 10);
  let m = parseInt(hParts[1], 10);
  
  let hora;
  if (m === 0) {
    hora = h;
  } else {
    hora = h + 1;
  }
  
  let keyFecha = fecha;
  if (hora === 0) {
    hora = 24;
    let parts = fecha.split('/');
    let d = new Date(parts[2], parseInt(parts[1])-1, parts[0]);
    d.setDate(d.getDate() - 1);
    keyFecha = d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear();
  }
  
  const key = `${keyFecha}_${hora}`;
  
  if (!excelMap.has(key)) {
    excelMap.set(key, { 
      Fecha: keyFecha, 
      Hora: hora, 
      Periodo: row[2], 
      Consumo: 0, 
      OMIE: 0, 
      SumaAjustes: 0, 
      Capacidad: 0, 
      DSV: 0, 
      FNEE: 0, 
      FEE: 0, 
      PrecioFinalCount: 0, 
      CosteTotal: 0 
    });
  }
  let entry = excelMap.get(key);
  
  const comps = ['RT3', 'RT6', 'CT2', 'CT3', 'BS3', 'RAD3', 'RAD1X', 'BALX', 'EXD', 'IN7', 'CFP'];
  let sumAjustes = 0;
  for (const c of comps) {
      const idx = getColIdx(excelHeader, c);
      if (idx !== -1) {
          sumAjustes += parseFloat((row[idx] || '0').toString().replace(',', '.'));
      }
  }

  entry.Consumo += parseFloat((row[getColIdx(excelHeader, 'Consumo')] || '0').toString().replace(',', '.'));
  entry.OMIE += parseFloat((row[getColIdx(excelHeader, 'OMIE')] || '0').toString().replace(',', '.'));
  entry.SumaAjustes += sumAjustes;
  entry.Capacidad += parseFloat((row[getColIdx(excelHeader, 'Capacidad')] || '0').toString().replace(',', '.'));
  entry.DSV += parseFloat((row[getColIdx(excelHeader, 'DSV')] || '0').toString().replace(',', '.'));
  entry.FNEE += parseFloat((row[getColIdx(excelHeader, 'FNEE')] || '0').toString().replace(',', '.'));
  entry.FEE += parseFloat((row[getColIdx(excelHeader, 'FEE')] || '0').toString().replace(',', '.'));
  entry.CosteTotal += parseFloat((row[getColIdx(excelHeader, 'Coste Total')] || '0').toString().replace(',', '.'));
  entry.PrecioFinalCount++;
}

for (let entry of excelMap.values()) {
  entry.OMIE /= entry.PrecioFinalCount;
  entry.SumaAjustes /= entry.PrecioFinalCount;
  entry.Capacidad /= entry.PrecioFinalCount;
  entry.DSV /= entry.PrecioFinalCount;
  entry.FNEE /= entry.PrecioFinalCount;
  entry.FEE /= entry.PrecioFinalCount;
}

const csvMap = new Map();
for (let row of csvDataRows) {
  const fecha = normDate(row[fechaIdx]);
  const providerHora = parseInt(row[horaIdx], 10);
  if (isNaN(providerHora)) continue;
  const hora = providerHora + 1; // Map Provider 0-23 to ERP 1-24
  const key = `${fecha}_${hora}`;
  
  if (!csvMap.has(key)) {
    csvMap.set(key, {
      Fecha: fecha,
      Hora: hora,
      OMIE: 0,
      Servicio: 0,
      Capacidad: 0,
      count: 0
    });
  }
  
  const entry = csvMap.get(key);
  entry.OMIE += parseFloat((row[csvHeaderRow.indexOf('OMIE')]||"0").replace(',', '.'));
  entry.Servicio += parseFloat((row[csvHeaderRow.indexOf('servicio')]||"0").replace(',', '.'));
  entry.Capacidad += parseFloat((row[csvHeaderRow.indexOf('peninsula_3_0TDVECapacidad')]||"0").replace(',', '.'));
  entry.count++;
}

for (let entry of csvMap.values()) {
    entry.OMIE /= entry.count;
    entry.Servicio /= entry.count;
    entry.Capacidad /= entry.count;
}

let commonKeys = Array.from(excelMap.keys()).filter(k => csvMap.has(k) && excelMap.get(k).Consumo > 0);
let selected = [];
for (let i = 0; i < 5; i++) {
  if (commonKeys.length === 0) break;
  let rIdx = Math.floor(Math.random() * commonKeys.length);
  selected.push(commonKeys[rIdx]);
  commonKeys.splice(rIdx, 1);
}

console.log("# Comparativa de Ajustes para 5 horas\\n");
console.log("| Fecha | Hora | OMIE Prov | OMIE ERP | Servicio Prov | Suma 11 Ajustes ERP | Capacidad ERP | Prov (Servicio + PC3) | ERP (Ajustes + PC3) |");
console.log("|---|---|---|---|---|---|---|---|---|");

for (let k of selected) {
  const erp = excelMap.get(k);
  const prov = csvMap.get(k);
  const provSum = prov.Servicio + prov.Capacidad;
  const erpSum = erp.SumaAjustes + erp.Capacidad;
  console.log(`| ${erp.Fecha} | ${erp.Hora} | ${prov.OMIE.toFixed(3)} | ${erp.OMIE.toFixed(3)} | ${prov.Servicio.toFixed(3)} | ${erp.SumaAjustes.toFixed(3)} | ${erp.Capacidad.toFixed(3)} | ${provSum.toFixed(3)} | ${erpSum.toFixed(3)} |`);
}
