import * as fs from 'fs';

function getSums(file: string) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  let baseTotal = 0;
  let baseLiquidableTotal = 0;
  let cuotaIntegraTotal = 0;
  let cuotaMinimaTotal = 0;
  let mwhTotal = 0;

  for (const line of lines) {
    const parts = line.split(';');
    const base = parseFloat(parts[2]) || 0;
    const baseLiq = parseFloat(parts[4]) || 0;
    const mwh = parseFloat(parts[5]) || 0;
    const cuotaIntegra = parseFloat(parts[10]) || 0;
    const cuotaMinima = parseFloat(parts[11]) || 0;

    baseTotal += base;
    baseLiquidableTotal += baseLiq;
    mwhTotal += mwh;
    cuotaIntegraTotal += cuotaIntegra;
    cuotaMinimaTotal += cuotaMinima;
  }
  return { 
    baseTotal: Math.round(baseTotal * 100) / 100, 
    baseLiquidableTotal: Math.round(baseLiquidableTotal * 100) / 100,
    cuotaIntegraTotal: Math.round(cuotaIntegraTotal * 100) / 100, 
    cuotaMinimaTotal: Math.round(cuotaMinimaTotal * 100) / 100,
    mwhTotal: Math.round(mwhTotal * 1000) / 1000,
    cuotaIngresar: Math.round((cuotaIntegraTotal + cuotaMinimaTotal) * 100) / 100
  };
}

const sumAM = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_PERFECT.txt');
const sumJun = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_PERFECT.txt');

console.log("Declaracion Abril-Mayo:");
console.log(sumAM);

console.log("\nDeclaracion Junio:");
console.log(sumJun);
