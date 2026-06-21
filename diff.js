const XLSX = require('xlsx');

const erpFile = 'C:\\Users\\Administrator\\tmp_backup\\liquidacion_upfront_2026-04-02_a_2026-05-01.xlsx';
const excelFile = 'C:\\Users\\Administrator\\tmp_backup\\Com_PR_2604_.xlsx';

const erpWb = XLSX.readFile(erpFile);
const erpSheet = XLSX.utils.sheet_to_json(erpWb.Sheets['Comisiones']);

const erpContracts = {};
for (const row of erpSheet) {
    const code = row['Codigo Contrato'];
    if (code) {
        erpContracts[code] = row['Importe Liquidado'] || 0;
    }
}

const excelWb = XLSX.readFile(excelFile);
const excelSheetName = excelWb.SheetNames[0];
const rawData = XLSX.utils.sheet_to_json(excelWb.Sheets[excelSheetName], { header: 1 });

let dataStartIndex = -1;
let colContrato = -1;
let colComision = -1;

for (let i = 0; i < rawData.length; i++) {
    if (rawData[i][0] === 'Contrato') {
        colContrato = 0;
        // Find Total Comision index. In row 6 it says "Comisión" starting somewhere, and row 7 says "Total".
        // From inspection, row 7 has 'Total' at index 21 or so.
        colComision = rawData[i+1].findIndex(c => c === 'Total');
        if (colComision === -1) colComision = 21; // fallback
        dataStartIndex = i + 2;
        break;
    }
}

const excelContracts = {};
if (dataStartIndex !== -1) {
    for (let i = dataStartIndex; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        const code = row[colContrato];
        if (code && typeof code === 'string' && code.length > 5) {
            excelContracts[code] = row[colComision] || 0;
        }
    }
}

const erpSet = new Set(Object.keys(erpContracts));
const excelSet = new Set(Object.keys(excelContracts));

const missingInExcel = [...erpSet].filter(x => !excelSet.has(x));
const missingInErp = [...excelSet].filter(x => !erpSet.has(x));

const valueDiffs = [];
for (const code of [...erpSet]) {
    if (excelSet.has(code)) {
        const erpVal = erpContracts[code];
        const excVal = excelContracts[code];
        if (Math.abs(erpVal - excVal) > 1) { // diff more than 1 euro
            valueDiffs.push({
                contrato: code,
                erp: erpVal,
                excel: excVal,
                diff: erpVal - excVal
            });
        }
    }
}

console.log('--- RESUMEN ---');
console.log(`Total contratos en ERP: ${Object.keys(erpContracts).length}`);
console.log(`Total contratos en Excel externo: ${Object.keys(excelContracts).length}`);
console.log(`Suma total ERP: ${Object.values(erpContracts).reduce((a,b)=>a+b,0).toFixed(2)} €`);
console.log(`Suma total Excel: ${Object.values(excelContracts).reduce((a,b)=>a+b,0).toFixed(2)} €`);

console.log(`\nContratos en ERP pero NO en Excel (${missingInExcel.length}):`);
if (missingInExcel.length > 0) console.log(missingInExcel.slice(0, 10).join(', ') + (missingInExcel.length > 10 ? '...' : ''));

console.log(`\nContratos en Excel pero NO en ERP (${missingInErp.length}):`);
if (missingInErp.length > 0) console.log(missingInErp.slice(0, 10).join(', ') + (missingInErp.length > 10 ? '...' : ''));

console.log(`\nDiferencias de importe (> 1€) en contratos comunes (${valueDiffs.length}):`);
for (const d of valueDiffs.slice(0, 15)) {
    console.log(`${d.contrato} -> ERP: ${d.erp.toFixed(2)} €, Excel: ${d.excel.toFixed(2)} € (Diff: ${d.diff.toFixed(2)} €)`);
}
if (valueDiffs.length > 15) console.log('...');
