import * as fs from 'fs';

const filePath = 'Z:\\AED\\AEAT (hasta 16jul)\\560\\Desglose_560_Espaa_2026_T2 (1).txt';
const content = fs.readFileSync(filePath, 'utf-8');

console.log('--- CONTENIDO DEL NUEVO FICHERO ---');
console.log(content.trim());
console.log('-----------------------------------');
console.log(`Número de líneas: ${content.trim().split('\n').length}`);
