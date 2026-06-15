const XLSX = require('xlsx');

function readExcel(file) {
    const workbook = XLSX.readFile(file);
    const sheet_name_list = workbook.SheetNames;
    const xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    console.log(`\n\n--- ${file} ---`);
    console.log(JSON.stringify(xlData.slice(0, 5), null, 2));
}

readExcel('docs/diccionario_contratos.xlsx');
readExcel('docs/diccionario_leads.xlsx');
