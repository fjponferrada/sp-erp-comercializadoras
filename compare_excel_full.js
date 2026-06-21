const xlsx = require('xlsx');

const oldWorkbook = xlsx.readFile('Z:\\AED\\Altas nuevas\\Eranovum\\260612 FACTURACION ERANOVUM 1JUN26 - 12JUN26.xlsx');
const newWorkbook = xlsx.readFile('C:\\Users\\Administrator\\tmp_backup\\export_facturas (3).xlsx');

const oldData = xlsx.utils.sheet_to_json(oldWorkbook.Sheets[oldWorkbook.SheetNames[0]], { header: 1 });
const newData = xlsx.utils.sheet_to_json(newWorkbook.Sheets[newWorkbook.SheetNames[0]], { header: 1 });

const headers = oldData[0];
const oldRowsByInvoice = {};
for (let i = 1; i < oldData.length; i++) {
  if (oldData[i][0]) oldRowsByInvoice[oldData[i][0]] = oldData[i];
}

const diffs = [];

for (let i = 1; i < newData.length; i++) {
  const newRow = newData[i];
  const invoiceNum = newRow[0];
  if (!invoiceNum) continue;

  const oldRow = oldRowsByInvoice[invoiceNum];
  if (!oldRow) continue; // ignore missing

  for (let j = 0; j < headers.length; j++) {
    const col = headers[j];
    if (['Fecha Factura', 'Desde', 'Hasta'].includes(col)) continue; // ignore dates

    let vOld = oldRow[j];
    let vNew = newRow[j];
    
    // Normalize empty values
    if (vOld === undefined || vOld === null || vOld === '') vOld = 0;
    if (vNew === undefined || vNew === null || vNew === '') vNew = 0;
    
    if (vOld !== vNew) {
      if (typeof vOld === 'number' && typeof vNew === 'number') {
         if (Math.abs(vOld - vNew) > 0.001) {
            diffs.push({ invoice: invoiceNum, col, old: vOld, new: vNew });
         }
      } else if (String(vOld).trim() !== String(vNew).trim()) {
         diffs.push({ invoice: invoiceNum, col, old: vOld, new: vNew });
      }
    }
  }
}

console.log("Total non-date differences found:", diffs.length);
if (diffs.length > 0) {
  const limitedDiffs = diffs.slice(0, 50);
  console.table(limitedDiffs);
}
