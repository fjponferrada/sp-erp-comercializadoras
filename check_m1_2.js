const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\Administrator\\sp-erp-comercializadoras\\src\\app\\actions\\switchingIngest.ts', 'utf-8');
const lines = content.split('\n');
const start = lines.findIndex(l => l.includes("else if ((paso === '02' || paso === '04') && procesoBase !== 'R1')")) + 50;
const end = start + 50;
console.log(lines.slice(start, end).join('\n'));