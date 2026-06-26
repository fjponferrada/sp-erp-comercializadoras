const XLSX = require('xlsx');
const workbook = XLSX.readFile('C:\\Users\\Administrator\\tmp_backup\\202606260707_2.0TD_riesgo_1_fee_0.xlsx');

// Resumen comercial
const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
const data1 = XLSX.utils.sheet_to_json(sheet1);
console.log("=== PROPUESTA COMERCIAL ===");
console.log(data1.filter(row => row['CONCEPTO']).slice(-3));

// Detalle horario
const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
const data2 = XLSX.utils.sheet_to_json(sheet2);
console.log("\n=== DETALLE HORARIO (Primeras 5 horas) ===");
console.log(data2.slice(0, 5).map(r => ({
  dt: r.datetime,
  per: r.per,
  base: r.Unit_Base_Mercado,
  os: r.Unit_OS,
  rest: r.Unit_Restricciones,
  loss: r.loss_f,
  energia: r.Unit_Energia_Pura,
  costePerd: r.Unit_Coste_Con_Perdidas,
  reg: r.Unit_Reg_Total
})));

// Calcular medias del detalle horario
let sumBase = 0, sumOs = 0, sumRest = 0, sumPerd = 0;
data2.forEach(r => {
  sumBase += (r.Unit_Base_Mercado || 0);
  sumOs += (r.Unit_OS || 0);
  sumRest += (r.Unit_Restricciones || 0);
  sumPerd += (r.Unit_Coste_Con_Perdidas || 0) - (r.Unit_Energia_Pura || 0);
});
console.log("\n=== MEDIAS HORARIAS (sin ponderar por consumo) ===");
console.log(`Base Mercado: ${sumBase / data2.length}`);
console.log(`OS: ${sumOs / data2.length}`);
console.log(`Restricciones: ${sumRest / data2.length}`);
console.log(`Sobrecoste Pérdidas: ${sumPerd / data2.length}`);
