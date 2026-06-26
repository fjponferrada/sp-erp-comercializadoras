const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

// Leer resultados Python
const pyDetalle = parseCSV('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\202606251808_2.0TD_riesgo_1_fee_0_DETALLE_HORARIO_0.csv');
let pyBase = 0, pyOs = 0, pyRest = 0, pyCoste = 0, pyConsumo = 0, pyEnergia = 0, pyReg = 0;
pyDetalle.forEach(r => {
  const vol = parseFloat(r.consumo.replace(',', '.'));
  if (!isNaN(vol)) {
    pyBase += parseFloat(r.Unit_Base_Mercado.replace(',', '.')) * vol;
    pyOs += parseFloat(r.Unit_OS.replace(',', '.')) * vol;
    pyRest += parseFloat(r.Unit_Restricciones.replace(',', '.')) * vol;
    pyEnergia += parseFloat(r.Unit_Energia_Pura.replace(',', '.')) * vol;
    pyCoste += parseFloat(r.Unit_Coste_Con_Perdidas.replace(',', '.')) * vol;
    pyReg += parseFloat(r.Unit_Reg_Total.replace(',', '.')) * vol;
    pyConsumo += vol;
  }
});

// Leer resultados Node
const workbook = XLSX.readFile('C:\\Users\\Administrator\\tmp_backup\\202606260713_2.0TD_riesgo_1_fee_0.xlsx');
const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
const data2 = XLSX.utils.sheet_to_json(sheet2);
let nodeBase = 0, nodeOs = 0, nodeRest = 0, nodeCoste = 0, nodeConsumo = 0, nodeEnergia = 0, nodeReg = 0;
data2.forEach(r => {
  const vol = parseFloat(r.consumo);
  if (!isNaN(vol)) {
    nodeBase += (r.Unit_Base_Mercado || r.baseMercadoEur || r.baseMercado) * vol;
    nodeOs += (r.Unit_OS || r.osEur || r.os) * vol;
    nodeRest += (r.Unit_Restricciones || r.restriccionesEur || r.restricciones) * vol;
    nodeEnergia += (r.Unit_Energia_Pura || r.energiaPuraEur || r.energiaPura) * vol;
    nodeCoste += (r.Unit_Coste_Con_Perdidas || r.costeConPerdidasEur || r.costeConPerdidas) * vol;
    nodeReg += (r.Unit_Reg_Total || r.regTotalEur || r.regTotal) * vol;
    nodeConsumo += vol;
  }
});

console.log("=== COMPARACIÓN DE PONDERADOS (€/MWh) ===");
console.log(`Python Consumo: ${pyConsumo} | Node Consumo: ${nodeConsumo}`);
console.log(`Base Mercado  | Py: ${(pyBase / pyConsumo).toFixed(2)} | Node: ${(nodeBase / nodeConsumo).toFixed(2)}`);
console.log(`OS            | Py: ${(pyOs / pyConsumo).toFixed(2)} | Node: ${(nodeOs / nodeConsumo).toFixed(2)}`);
console.log(`Restricciones | Py: ${(pyRest / pyConsumo).toFixed(2)} | Node: ${(nodeRest / nodeConsumo).toFixed(2)}`);
console.log(`Energia Pura  | Py: ${(pyEnergia / pyConsumo).toFixed(2)} | Node: ${(nodeEnergia / nodeConsumo).toFixed(2)}`);
console.log(`Coste c/Perd  | Py: ${(pyCoste / pyConsumo).toFixed(2)} | Node: ${(nodeCoste / nodeConsumo).toFixed(2)}`);
console.log(`Coste Regulad | Py: ${(pyReg / pyConsumo).toFixed(2)} | Node: ${(nodeReg / nodeConsumo).toFixed(2)}`);

console.log("\n=== DIFF (Py - Node) ===");
console.log(`Faltan en Base Mercado: ${((pyBase / pyConsumo) - (nodeBase / nodeConsumo)).toFixed(2)} €/MWh`);
console.log(`Faltan en OS: ${((pyOs / pyConsumo) - (nodeOs / nodeConsumo)).toFixed(2)} €/MWh`);
console.log(`Faltan en Restricciones: ${((pyRest / pyConsumo) - (nodeRest / nodeConsumo)).toFixed(2)} €/MWh`);
console.log(`Faltan en Perdidas: ${(((pyCoste - pyEnergia) / pyConsumo) - ((nodeCoste - nodeEnergia) / nodeConsumo)).toFixed(2)} €/MWh`);
console.log(`Faltan en Regulados: ${((pyReg / pyConsumo) - (nodeReg / nodeConsumo)).toFixed(2)} €/MWh`);
