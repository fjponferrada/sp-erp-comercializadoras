const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const docsPath = path.join(__dirname, '../docs');
const files = fs.readdirSync(docsPath).filter(f => f.endsWith('.xlsx'));

files.forEach(file => {
  const wb = xlsx.readFile(path.join(docsPath, file));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`\n=== ${file} ===`);
  data.forEach(row => {
    const colName = row['Airtable Column'] || row['Columna Airtable'] || row['Campo Airtable'] || row['Campo'] || Object.values(row)[0];
    if (typeof colName === 'string' && (colName.includes('P1C') || colName.includes('CNAE') || colName.includes('IBAN') || colName.includes('Tipo de persona'))) {
      console.log(row);
    }
  });
});
