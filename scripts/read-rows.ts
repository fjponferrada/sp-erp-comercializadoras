import * as xlsx from 'xlsx';

function readRows(file: string) {
  const wb = xlsx.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = xlsx.utils.sheet_to_json(sheet);
  return json.map(r => Object.values(r)[0] + ' -> ' + Object.values(r)[2]);
}

console.log("--- CANALES ---");
console.log(readRows('docs/diccionario_canales.xlsx').join('\n'));
console.log("\n--- PRODUCTOS ---");
console.log(readRows('docs/diccionario_productos.xlsx').join('\n'));
console.log("\n--- USUARIOS ---");
console.log(readRows('docs/diccionario_usuarios_v2.xlsx').join('\n'));
