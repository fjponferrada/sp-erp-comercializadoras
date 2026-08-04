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

const sumQ2 = getSums('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2 (4).txt');

console.log("Original Q2 TXT:");
console.log(sumQ2);
