const fs = require('fs');
const XLSX = require('xlsx');

// Py
const pyContent = fs.readFileSync('Z:\\AED\\Tarifas\\SCRIPT_PERFILADO_AVANZADO\\COTIZADOR\\202606251808_2.0TD_riesgo_1_fee_0_DETALLE_HORARIO_0.csv', 'utf-8');
const pyLines = pyContent.trim().split('\n');
console.log("Py Headers:", pyLines[0].split(','));

// Node
const workbook = XLSX.readFile('C:\\Users\\Administrator\\tmp_backup\\202606260713_2.0TD_riesgo_1_fee_0.xlsx');
const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
const data2 = XLSX.utils.sheet_to_json(sheet2);
console.log("Node First Row Keys:", Object.keys(data2[0]));
