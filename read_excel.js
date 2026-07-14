const xlsx = require('xlsx');
const workbook = xlsx.readFile('docs/diccionario_leads.xlsx');
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
const result = data.filter(r => 
  (r['Nombre Airtable'] && r['Nombre Airtable'].toLowerCase().includes('nif')) ||
  (r['Nombre Airtable'] && r['Nombre Airtable'].toLowerCase().includes('cnae')) ||
  (r['Nombre Airtable'] && r['Nombre Airtable'].toLowerCase().includes('tipo')) ||
  (r['Nombre Airtable'] && r['Nombre Airtable'].toLowerCase().includes('potencia')) ||
  (r['Nombre Airtable'] && r['Nombre Airtable'].toLowerCase().includes('p1')) ||
  (r['Nombre Airtable'] && r['Nombre Airtable'].toLowerCase().includes('p2')) ||
  (r['Nombre Airtable'] && r['Nombre Airtable'].toLowerCase().includes('p3'))
);
console.log(JSON.stringify(result, null, 2));
