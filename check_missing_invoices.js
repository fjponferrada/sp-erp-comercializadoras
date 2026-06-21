const xlsx = require('xlsx');

const oldWorkbook = xlsx.readFile('Z:\\AED\\Altas nuevas\\Eranovum\\260612 FACTURACION ERANOVUM 1JUN26 - 12JUN26.xlsx');
const newWorkbook = xlsx.readFile('C:\\Users\\Administrator\\tmp_backup\\export_facturas (3).xlsx');

const oldData = xlsx.utils.sheet_to_json(oldWorkbook.Sheets[oldWorkbook.SheetNames[0]], { header: 1 });
const newData = xlsx.utils.sheet_to_json(newWorkbook.Sheets[newWorkbook.SheetNames[0]], { header: 1 });

const oldInvoices = new Set(oldData.map(r => r[0]));
const newInvoices = new Set(newData.map(r => r[0]));

const headers = oldData[0];

let missingOld = 0;
let missingNew = 0;

console.log("Invoices in New but not in Old:");
let extraSum = 0;
for (let r of newData) {
  if (r[0] && !oldInvoices.has(r[0])) {
    console.log(r[0], "Total:", r[headers.indexOf('Total')]);
    extraSum += Number(r[headers.indexOf('Total')]) || 0;
  }
}
console.log("Extra sum in New:", extraSum);


let missingSum = 0;
for (let r of oldData) {
  if (r[0] && !newInvoices.has(r[0]) && r[0] !== 'Numero Factura') {
    console.log(r[0], "Total:", r[headers.indexOf('Total')]);
    missingSum += Number(r[headers.indexOf('Total')]) || 0;
  }
}
console.log("Missing sum in New:", missingSum);

