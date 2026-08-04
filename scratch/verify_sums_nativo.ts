import * as fs from 'fs';

function getSums(file: string) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  let baseTotal = 0;
  let cuotaIntegraTotal = 0;
  let cuotaMinimaTotal = 0;
  let mwhTotal = 0;

  for (const line of lines) {
    const parts = line.split(';');
    const base = parseFloat(parts[2]) || 0;
    const mwh = parseFloat(parts[5]) || 0;
    const cuotaIntegra = parseFloat(parts[10]) || 0;
    const cuotaMinima = parseFloat(parts[11]) || 0;

    baseTotal += base;
    mwhTotal += mwh;
    cuotaIntegraTotal += cuotaIntegra;
    cuotaMinimaTotal += cuotaMinima;
  }
  return { 
    baseTotal: Math.round(baseTotal * 100) / 100, 
    cuotaIntegraTotal: Math.round(cuotaIntegraTotal * 100) / 100, 
    cuotaMinimaTotal: Math.round(cuotaMinimaTotal * 100) / 100,
    mwhTotal: Math.round(mwhTotal * 1000) / 1000
  };
}

const sumAM = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_PERFECT.txt');
const sumJun = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_PERFECT.txt');
const sumOrig = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2.txt');

console.log("Original T2:");
console.log(sumOrig);

console.log("\nNuevos (AM + Junio):");
const totalNuevos = {
  baseTotal: Math.round((sumAM.baseTotal + sumJun.baseTotal) * 100) / 100,
  cuotaIntegraTotal: Math.round((sumAM.cuotaIntegraTotal + sumJun.cuotaIntegraTotal) * 100) / 100,
  cuotaMinimaTotal: Math.round((sumAM.cuotaMinimaTotal + sumJun.cuotaMinimaTotal) * 100) / 100,
  mwhTotal: Math.round((sumAM.mwhTotal + sumJun.mwhTotal) * 1000) / 1000
};
console.log(totalNuevos);

console.log("\nCuadran perfecto?:", JSON.stringify(sumOrig) === JSON.stringify(totalNuevos));
