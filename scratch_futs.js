const fs = require('fs');

const content = fs.readFileSync('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\FUTUROS.csv', 'utf-8');
const lines = content.trim().split('\n');
let sum = 0, count = 0;
for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(';').map(v => v.trim());
  const price = parseFloat(vals[1].replace(',', '.'));
  if (!isNaN(price)) {
    sum += price;
    count++;
  }
}
console.log("FUTUROS average:", sum / count);

const curva = fs.readFileSync('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\CURVA_COSTE_PORTFOLIO.csv', 'utf-8');
const clines = curva.trim().split('\n');
let csum = 0, ccount = 0;
for (let i = 1; i < clines.length; i++) {
  const vals = clines[i].split(';').map(v => v.trim());
  const price = parseFloat(vals[1].replace(',', '.'));
  if (!isNaN(price)) {
    csum += price;
    ccount++;
  }
}
console.log("CURVA average:", csum / ccount);
