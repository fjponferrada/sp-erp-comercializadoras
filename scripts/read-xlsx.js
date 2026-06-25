const xlsx = require('xlsx');

try {
  const workbook = xlsx.readFile('Z:\\AED\\Compras Energia\\SCRIPT FACTURACION PPA FIN\\PERFIL_FIJO_RJ.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = xlsx.utils.sheet_to_json(sheet);
  
  console.log("Last 5 rows:");
  console.log(json.slice(-5));
} catch (e) {
  console.error(e);
}
