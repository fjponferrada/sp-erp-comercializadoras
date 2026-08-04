import * as fs from 'fs';

function getSums(file: string) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  let baseTotal = 0;
  let cuotaIntegraTotal = 0;
  let cuotaMinimaTotal = 0;

  for (const line of lines) {
    const parts = line.split(';');
    const base = parseFloat(parts[2]) || 0;
    const cuotaIntegra = parseFloat(parts[10]) || 0;
    const cuotaMinima = parseFloat(parts[11]) || 0;

    baseTotal += base;
    cuotaIntegraTotal += cuotaIntegra;
    cuotaMinimaTotal += cuotaMinima;
  }
  return { baseTotal, cuotaIntegraTotal, cuotaMinimaTotal };
}

const sumAM = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_REAL.txt');
const sumJun = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_REAL.txt');

console.log("Abril-Mayo REAL:");
console.log(sumAM);
console.log("Junio REAL:");
console.log(sumJun);

const totalQ2 = {
  baseTotal: sumAM.baseTotal + sumJun.baseTotal,
  cuotaIntegraTotal: sumAM.cuotaIntegraTotal + sumJun.cuotaIntegraTotal,
  cuotaMinimaTotal: sumAM.cuotaMinimaTotal + sumJun.cuotaMinimaTotal,
  totalCuotaAbsoluta: sumAM.cuotaIntegraTotal + sumAM.cuotaMinimaTotal + sumJun.cuotaIntegraTotal + sumJun.cuotaMinimaTotal
};

console.log("TOTAL COMBINADO:");
console.log(totalQ2);
