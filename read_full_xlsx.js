const XLSX = require('xlsx');

function readFull(file) {
    const workbook = XLSX.readFile(file);
    const sheet_name_list = workbook.SheetNames;
    const xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    const mappings = xlData.map(row => ({
      airtable: row['Nombre Airtable'],
      postgres: row['Campo Equivalente PostgreSQL']
    })).filter(r => r.airtable && r.postgres);
    
    console.log(`\n\n--- ${file} ---`);
    console.log(JSON.stringify(mappings, null, 2));
}

readFull('docs/diccionario_contratos.xlsx');
readFull('docs/diccionario_leads.xlsx');
