import * as xlsx from 'xlsx';
import * as fs from 'fs';

const filePath = 'C:\\Users\\Administrator\\sp-erp-comercializadoras\\docs\\diccionario_contratos.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

fs.writeFileSync('output_contracts.json', JSON.stringify(data, null, 2), 'utf-8');
console.log("Written output_contracts.json");
