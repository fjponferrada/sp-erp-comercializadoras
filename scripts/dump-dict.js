const xlsx = require('xlsx');
const fs = require('fs');

try {
  const workbook = xlsx.readFile('C:\\Users\\Administrator\\sp-erp-comercializadoras\\docs\\diccionario_facturas.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  data.forEach(row => {
    console.log(`${row['Campo Equivalente PostgreSQL']} --- ${row['Nombre Airtable']}`);
  });
} catch (e) {
  console.error(e);
}
