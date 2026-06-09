import * as xlsx from 'xlsx';

function readHeaders(file: string) {
  const wb = xlsx.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const headers = [];
  const range = xlsx.utils.decode_range(sheet['!ref'] || "A1:A1");
  for (let c = range.s.c; c <= range.e.c; ++c) {
    const cell = sheet[xlsx.utils.encode_cell({c: c, r: range.s.r})];
    if (cell && cell.v) headers.push(cell.v);
  }
  return headers;
}

console.log("--- CANALES ---");
console.log(readHeaders('docs/diccionario_canales.xlsx').join(', '));
console.log("\n--- PRODUCTOS ---");
console.log(readHeaders('docs/diccionario_productos.xlsx').join(', '));
console.log("\n--- USUARIOS ---");
console.log(readHeaders('docs/diccionario_usuarios_v2.xlsx').join(', '));
