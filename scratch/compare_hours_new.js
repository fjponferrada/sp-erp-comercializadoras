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
let horaIdx = headerRow.indexOf('Hora');
let consumoIdx = headerRow.indexOf('Consumption');
let totalIdx = headerRow.indexOf('total');

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
    excelMap.set(key, { Fecha: keyFecha, Hora: hora, Periodo: row[2], Consumo: 0, OMIE: 0, OS: 0, Restricciones: 0, Capacidad: 0, DSV: 0, FNEE: 0, FEE: 0, PrecioFinalCount: 0, CosteTotal: 0 });
  }
  let entry = excelMap.get(key);
  entry.Consumo += parseFloat((row[3] || '0').toString().replace(',', '.'));
  entry.OMIE += parseFloat((row[4] || '0').toString().replace(',', '.'));
  entry.OS += parseFloat((row[5] || '0').toString().replace(',', '.'));
  entry.Restricciones += parseFloat((row[8] || '0').toString().replace(',', '.'));
  entry.Capacidad += parseFloat((row[9] || '0').toString().replace(',', '.'));
  entry.DSV += parseFloat((row[10] || '0').toString().replace(',', '.'));
  entry.FNEE += parseFloat((row[16] || '0').toString().replace(',', '.'));
  entry.FEE += parseFloat((row[17] || '0').toString().replace(',', '.'));
  entry.CosteTotal += parseFloat((row[20] || '0').toString().replace(',', '.'));
  entry.PrecioFinalCount++;
}

for (let entry of excelMap.values()) {
  entry.OMIE /= entry.PrecioFinalCount;
  entry.OS /= entry.PrecioFinalCount;
  entry.Restricciones /= entry.PrecioFinalCount;
  entry.Capacidad /= entry.PrecioFinalCount;
  entry.DSV /= entry.PrecioFinalCount;
  entry.FNEE /= entry.PrecioFinalCount;
  entry.FEE /= entry.PrecioFinalCount;
}

const csvMap = new Map();
for (let row of csvDataRows) {
  const fecha = normDate(row[fechaIdx]);
  const providerHora = parseInt(row[horaIdx], 10);
  const hora = providerHora + 1; // Map Provider 0-23 to ERP 1-24
  const key = `${fecha}_${hora}`;
  
  csvMap.set(key, {
    Fecha: fecha,
    Hora: hora,
    Periodo: 'P' + row[headerRow.indexOf('peninsula_3_0TDVEPeriod')],
    Consumo: parseFloat((row[consumoIdx]||"0").replace(',', '.')),
    OMIE: parseFloat((row[headerRow.indexOf('OMIE')]||"0").replace(',', '.')),
    OS: parseFloat((row[headerRow.indexOf('servicio')]||"0").replace(',', '.')),
    Capacidad: parseFloat((row[headerRow.indexOf('peninsula_3_0TDVECapacidad')]||"0").replace(',', '.')),
    DSV: parseFloat((row[headerRow.indexOf('desvio')]||"0").replace(',', '.')),
    FNEE: parseFloat((row[headerRow.indexOf('FNEE')]||"0").replace(',', '.')),
    FEE: parseFloat((row[headerRow.indexOf('FEE')]||"0").replace(',', '.')),
    Total: parseFloat((row[totalIdx]||"0").replace(',', '.'))
  });
}

let commonKeys = Array.from(excelMap.keys()).filter(k => csvMap.has(k) && excelMap.get(k).Consumo > 0 && csvMap.get(k).Consumo > 0);
let selected = [];
for (let i = 0; i < 5; i++) {
  if (commonKeys.length === 0) break;
  let rIdx = Math.floor(Math.random() * commonKeys.length);
  selected.push(commonKeys[rIdx]);
  commonKeys.splice(rIdx, 1);
}

const result = selected.map(k => {
  const erp = excelMap.get(k);
  const prov = csvMap.get(k);
  return {
    Date: k,
    Periodo: { ERP: erp.Periodo, PROVEEDOR: prov.Periodo },
    Consumo: { ERP: erp.Consumo.toFixed(3), PROVEEDOR: prov.Consumo.toFixed(3) },
    OMIE: { ERP: erp.OMIE.toFixed(2), PROVEEDOR: prov.OMIE.toFixed(2) },
    OS_Total: { ERP: (erp.OS + erp.Restricciones).toFixed(2), PROVEEDOR: prov.OS.toFixed(2) },
    DSV: { ERP: erp.DSV.toFixed(2), PROVEEDOR: prov.DSV.toFixed(2) },
    Capacidad: { ERP: erp.Capacidad.toFixed(2), PROVEEDOR: prov.Capacidad.toFixed(2) },
    FEE: { ERP: erp.FEE.toFixed(2), PROVEEDOR: prov.FEE.toFixed(2) },
    FNEE: { ERP: erp.FNEE.toFixed(2), PROVEEDOR: prov.FNEE.toFixed(2) },
    Coste_Total: { ERP: erp.CosteTotal.toFixed(4), PROVEEDOR: prov.Total.toFixed(4) }
  };
});
console.log(JSON.stringify(result, null, 2));
