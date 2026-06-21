const xlsx = require('xlsx');

const oldWorkbook = xlsx.readFile('Z:\\AED\\Altas nuevas\\Eranovum\\260612 FACTURACION ERANOVUM 1JUN26 - 12JUN26.xlsx');
const newWorkbook = xlsx.readFile('C:\\Users\\Administrator\\tmp_backup\\export_facturas (3).xlsx');

const oldData = xlsx.utils.sheet_to_json(oldWorkbook.Sheets[oldWorkbook.SheetNames[0]], { header: 1 });
const newData = xlsx.utils.sheet_to_json(newWorkbook.Sheets[newWorkbook.SheetNames[0]], { header: 1 });

const headers = oldData[0];
const totalIdx = headers.indexOf('Total');
const baseIdx = headers.indexOf('Base Imponible 21');
const ivaIdx = headers.indexOf('Importe IVA');
const tipoIdx = headers.indexOf('Tipo Factura');

let oldSumTotal = 0;
for (let i = 1; i < oldData.length; i++) {
  const row = oldData[i];
  if (!row[0]) continue;
  oldSumTotal += (Number(row[totalIdx]) || 0);
  if (row[tipoIdx]?.toLowerCase().includes('abono')) {
    console.log("Old Abono:", row[0], "Total:", row[totalIdx]);
  }
}

let newSumTotal = 0;
for (let i = 1; i < newData.length; i++) {
  const row = newData[i];
  if (!row[0]) continue;
  newSumTotal += (Number(row[totalIdx]) || 0);
  if (row[tipoIdx]?.toLowerCase().includes('abono')) {
    console.log("New Abono:", row[0], "Total:", row[totalIdx]);
  }
}

console.log("Old Sum Total:", oldSumTotal);
console.log("New Sum Total:", newSumTotal);
console.log("Difference:", oldSumTotal - newSumTotal);

// Print out exactly what is different in the Total column
const oldRowsByInvoice = {};
for (let i = 1; i < oldData.length; i++) {
  if (oldData[i][0]) oldRowsByInvoice[oldData[i][0]] = oldData[i];
}

for (let i = 1; i < newData.length; i++) {
  const newRow = newData[i];
  const invoiceNum = newRow[0];
  if (!invoiceNum) continue;

  const oldRow = oldRowsByInvoice[invoiceNum];
  if (!oldRow) continue;

  let oT = Number(oldRow[totalIdx]) || 0;
  let nT = Number(newRow[totalIdx]) || 0;
  if (Math.abs(oT - nT) > 0.001) {
    console.log(`Invoice ${invoiceNum} Total diff: Old=${oT}, New=${nT}`);
  }
}
