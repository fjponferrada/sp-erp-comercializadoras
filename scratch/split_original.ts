import * as fs from 'fs';

const lines = [
  "98.1E;ES00014L3007C;744.64;632.94;111.70;3.113;E41485012;ES00041LA319P;;;3.72;0.00",
  "98.1E;ES00014L3007C;1322.60;1124.21;198.39;7.124;E41485012;ES00041LA319P;;;67.62;0.00",
  "98.1E;ES00014L3007C;1401.70;1191.45;210.25;7.742;E41485012;ES00041LA319P;;;7.01;0.00",
  "SBFO;ES00014L3007C;738323.88;0.00;738323.88;3835.753;;;;;13595.24;1523.95",
  "SBFI;ES00014L3007C;122795.78;0.00;122795.78;681.731;;;;;2220.60;152.87"
];

const line98_1 = lines[0]; // 3.72
const line98_2 = lines[1]; // 67.62
const line98_3 = lines[2]; // 7.01
const lineSBFO = lines[3]; // Cuota: 13595.24, Min: 1523.95
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

const amSbfoCuota = 1210.87;
const junSbfoCuota = sbfo.cuota - amSbfoCuota; // 12384.37

const amRatio = amSbfoCuota / sbfo.cuota;
const junRatio = 1 - amRatio;

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

fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Abril_Mayo_SPLIT.txt', outAM);
fs.writeFileSync('Z:\\AED\\AEAT\\560\\Desglose_560_Espaa_2026_T2_Junio_SPLIT.txt', outJun);

console.log("Splitted perfectly.");
