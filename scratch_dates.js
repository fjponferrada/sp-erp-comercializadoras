const fs = require('fs');

const f = fs.readFileSync('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\FUTUROS.csv', 'utf-8').trim().split('\n').slice(1, 4);
console.log("FUTUROS first 3:");
console.log(f);

const c = fs.readFileSync('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\CURVA_COSTE_PORTFOLIO.csv', 'utf-8').trim().split('\n').slice(1, 4);
console.log("CURVA first 3:");
console.log(c);
