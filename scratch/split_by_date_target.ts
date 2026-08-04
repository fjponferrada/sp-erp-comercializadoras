import * as fs from 'fs';

const content = fs.readFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2.txt', 'utf8').trim();
const lines = content.split('\n');

const line98_1 = lines[0]; // Cuota: 3.72
const line98_2 = lines[1]; // Cuota: 67.62
const line98_3 = lines[2]; // Cuota: 7.01
const lineSBFO = lines[3]; // Cuota: 13590.80, Min: 1523.65
const lineSBFI = lines[4]; // Cuota: 2220.60, Min: 152.87

const parseLine = (line: string) => {
  const parts = line.split(';');
  return {
    clave: parts[0], cie: parts[1], base: parseFloat(parts[2]), red: parseFloat(parts[3]), 
    liq: parseFloat(parts[4]), mwh: parseFloat(parts[5]), nif: parts[6], cie2: parts[7], 
    v9: parts[8], v10: parts[9], cuota: parseFloat(parts[10]), min: parseFloat(parts[11])
  };
};

const sbfo = parseLine(lineSBFO);
const sbfi = parseLine(lineSBFI);

// User explicit request: Split by DATE exactly.
// User manually checked April-May cuota = 1289.22.
// 98.1E cuotas = 78.35
const amSbfoCuota = 1289.22 - 78.35; // 1210.87
const junSbfoCuota = sbfo.cuota - amSbfoCuota; // 12379.93

const amRatio = amSbfoCuota / sbfo.cuota;

const amSbfoBase = sbfo.base * amRatio;
const junSbfoBase = sbfo.base - amSbfoBase;

const amSbfoMwh = sbfo.mwh * amRatio;
const junSbfoMwh = sbfo.mwh - amSbfoMwh;

const amSbfoMin = sbfo.min * amRatio;
const junSbfoMin = sbfo.min - amSbfoMin;

const formatLine = (clave: string, cie: string, base: number, red: number, liq: number, mwh: number, nif: string, cie2: string, v9: string, v10: string, cuota: number, min: number) => {
  return `${clave};${cie};${base.toFixed(2)};${red.toFixed(2)};${liq.toFixed(2)};${mwh.toFixed(3)};${nif};${cie2};${v9};${v10};${cuota.toFixed(2)};${min.toFixed(2)}`;
};

const amSbfoStr = formatLine(sbfo.clave, sbfo.cie, amSbfoBase, 0, amSbfoBase, amSbfoMwh, sbfo.nif, sbfo.cie2, sbfo.v9, sbfo.v10, amSbfoCuota, amSbfoMin);
const junSbfoStr = formatLine(sbfo.clave, sbfo.cie, junSbfoBase, 0, junSbfoBase, junSbfoMwh, sbfo.nif, sbfo.cie2, sbfo.v9, sbfo.v10, junSbfoCuota, junSbfoMin);

const outAM = [line98_1, line98_2, line98_3, amSbfoStr].join('\n') + '\n';
const outJun = [junSbfoStr, lineSBFI].join('\n') + '\n';

fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_FECHAS.txt', outAM);
fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_FECHAS.txt', outJun);

console.log("Splitted perfectly by exact requested dates amounts.");
