const fs = require('fs');
const pyContent = fs.readFileSync('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\202606251808_2.0TD_riesgo_1_fee_0_DETALLE_HORARIO_0.csv', 'utf-8');
const lines = pyContent.trim().split('\n');
console.log("Py Rows:", lines.length - 1);
