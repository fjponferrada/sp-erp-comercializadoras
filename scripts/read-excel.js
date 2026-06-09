const xlsx = require('xlsx');
const fs = require('fs');

try {
  const workbook = xlsx.readFile('C:\\Users\\Administrator\\sp-erp-comercializadoras\\docs\\diccionario_facturas.xlsx');
  const sheet_name_list = workbook.SheetNames;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
  
  console.log('Columns:');
  if (data.length > 0) {
    console.log(Object.keys(data[0]).join(', '));
  }
  
  console.log('\nData Sample (first 10 rows):');
  data.slice(0, 10).forEach(row => {
    console.log(JSON.stringify(row));
  });
} catch (e) {
  console.error(e);
}
