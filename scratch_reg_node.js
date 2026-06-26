const fs = require('fs');
const XLSX = require('xlsx');
const workbook = XLSX.readFile('C:\\Users\\Administrator\\tmp_backup\\202606260713_2.0TD_riesgo_1_fee_0.xlsx');
const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
const data2 = XLSX.utils.sheet_to_json(sheet2);
let nodeConsumo = 0;
let nReg = {
  cargos: 0,
  peajes: 0,
  capacidad: 0,
  fnee: 0,
  os: 0,
  om: 0
};

data2.forEach(r => {
  const vol = parseFloat(r.consumo);
  if (!isNaN(vol)) {
    nodeConsumo += vol;
    nReg.cargos += (r.cargosEnergiaEur || 0) * vol;
    nReg.peajes += (r.peajesEnergiaEur || 0) * vol;
    nReg.capacidad += (r.pagosCapacidadEur || 0) * vol;
    nReg.fnee += (r.fneeEur || 0) * vol;
    nReg.os += (r.pagoOsEur || 0) * vol;
    nReg.om += (r.pagoOmEur || 0) * vol;
  }
});

console.log("=== NODE REGULADOS BREAKDOWN ===");
console.log(`Cargos: ${(nReg.cargos / nodeConsumo).toFixed(2)}`);
console.log(`Peajes: ${(nReg.peajes / nodeConsumo).toFixed(2)}`);
console.log(`Capacidad: ${(nReg.capacidad / nodeConsumo).toFixed(2)}`);
console.log(`FNEE: ${(nReg.fnee / nodeConsumo).toFixed(2)}`);
console.log(`OS: ${(nReg.os / nodeConsumo).toFixed(2)}`);
console.log(`OM: ${(nReg.om / nodeConsumo).toFixed(2)}`);
