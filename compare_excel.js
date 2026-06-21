const xlsx = require('xlsx');

const oldWorkbook = xlsx.readFile('C:\\Users\\Administrator\\tmp_backup\\260620 FACTURACION ERANOVUM 12JUN26 - 20JUN26.xlsx');
const newWorkbook = xlsx.readFile('C:\\Users\\Administrator\\tmp_backup\\export_facturas.xlsx');

const oldData = xlsx.utils.sheet_to_json(oldWorkbook.Sheets[oldWorkbook.SheetNames[0]], { header: 1 });
const newData = xlsx.utils.sheet_to_json(newWorkbook.Sheets[newWorkbook.SheetNames[0]], { header: 1 });

const headers = oldData[0];
const oldRow = oldData.find(row => row[0] === 'A260614802') || oldData[1];
const newRow = newData.find(row => row[0] === 'A260614802') || newData[1];

if (!newRow) {
  console.log("Invoice A260614802 not found in new export.");
  console.log("New headers:", newData[0]);
  console.log("New row 1:", newData[1]);
  process.exit(1);
}

const diffs = [];
for (let i = 0; i < headers.length; i++) {
  const col = headers[i];
  let vOld = oldRow[i];
  let vNew = newRow[i];
  
  if (vOld !== vNew) {
    // maybe float precision issue
    if (typeof vOld === 'number' && typeof vNew === 'number') {
       if (Math.abs(vOld - vNew) > 0.001) {
          diffs.push({ col, old: vOld, new: vNew });
       }
    } else if (vOld === undefined && vNew === 0) {
       // if old is undefined/empty and new is 0, ignore or log
    } else {
       diffs.push({ col, old: vOld, new: vNew });
    }
  }
}

console.log("Differences:");
console.table(diffs);

