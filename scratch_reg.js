const fs = require('fs');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(';').map(v => v.trim());
    const obj = {};
    headers.forEach((h, idx) => obj[h] = vals[idx]);
    rows.push(obj);
  }
  return rows;
}

const pyDetalle = parseCSV('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\202606251808_2.0TD_riesgo_1_fee_0_DETALLE_HORARIO_0.csv');
let pyConsumo = 0, pyRegTotal = 0;
let pyReg = {
  cargos: 0,
  peajes: 0,
  capacidad: 0,
  fnee: 0,
  os: 0,
  om: 0
};

pyDetalle.forEach(r => {
  const vol = parseFloat(r.consumo.replace(',', '.'));
  if (!isNaN(vol)) {
    pyConsumo += vol;
    pyRegTotal += parseFloat(r.Unit_Reg_Total.replace(',', '.')) * vol;
    pyReg.cargos += parseFloat((r.Unit_Reg_Cargos_Energia || '0').replace(',', '.')) * vol;
    pyReg.peajes += parseFloat((r.Unit_Reg_Peajes_Energia || '0').replace(',', '.')) * vol;
    pyReg.capacidad += parseFloat((r.Unit_Reg_Pagos_Capacidad || '0').replace(',', '.')) * vol;
    pyReg.fnee += parseFloat((r.Unit_Reg_FNEE || '0').replace(',', '.')) * vol;
    pyReg.os += parseFloat((r.Unit_Reg_Pago_OS || '0').replace(',', '.')) * vol;
    pyReg.om += parseFloat((r.Unit_Reg_Pago_OM || '0').replace(',', '.')) * vol;
  }
});

console.log("=== PY REGULADOS BREAKDOWN ===");
console.log(`Total Regulados: ${(pyRegTotal / pyConsumo).toFixed(2)}`);
console.log(`Cargos: ${(pyReg.cargos / pyConsumo).toFixed(2)}`);
console.log(`Peajes: ${(pyReg.peajes / pyConsumo).toFixed(2)}`);
console.log(`Capacidad: ${(pyReg.capacidad / pyConsumo).toFixed(2)}`);
console.log(`FNEE: ${(pyReg.fnee / pyConsumo).toFixed(2)}`);
console.log(`OS: ${(pyReg.os / pyConsumo).toFixed(2)}`);
console.log(`OM: ${(pyReg.om / pyConsumo).toFixed(2)}`);
