const fs = require('fs');
const xlsx = require('xlsx');

const ourExcelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf31.xlsx";

try {
  const ourWb = xlsx.readFile(ourExcelPath);
  const ourWs = ourWb.Sheets[ourWb.SheetNames[0]];
  const ourData = xlsx.utils.sheet_to_json(ourWs, { header: 1, raw: false });

  ourData.forEach(row => {
    if (String(row[0]) === '1/6/2026' && String(row[1]) === '20:00') {
      console.log(`OURS    : Perdidas %= ${row[7]}, Loss Factor= ${row[8]}`);
    }
  });

} catch (e) {
  console.error(e);
}
