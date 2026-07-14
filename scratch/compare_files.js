const fs = require('fs');
const xlsx = require('xlsx');

const providerCsvPath = "Z:\\Documentos\\Escritorio\\2026-07-08_ES0031405446869086QD0F_2026-06-01_2026-06-30_CF 171261N079680097_ACTIVA_INDEX.csv";
const ourExcelPath = "Z:\\Documentos\\Escritorio\\Desglose_Horario_ES0031405446869086QD0F_cmrf1e.xlsx";

try {
  // Read our excel
  const workbook = xlsx.readFile(ourExcelPath);
  const sheetName = workbook.SheetNames[0];
  const ourDataRaw = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  const ourData = ourDataRaw.slice(5).filter(row => row.length > 0 && row[0]);
  
  const ourOmie = new Array(24).fill(0);
  const ourConsumo = new Array(24).fill(0);
  const ourCount = new Array(24).fill(0);

  ourData.forEach(row => {
    if (String(row[0]) === '1/6/2026') {
      let hour = parseInt(String(row[1]).split(':')[0], 10);
      ourOmie[hour] += parseFloat(row[4]) || 0;
      ourConsumo[hour] += parseFloat(row[3]) || 0;
      ourCount[hour]++;
    }
  });

  for(let i=0; i<24; i++) {
    if (ourCount[i] > 0) ourOmie[i] /= ourCount[i];
  }

  // Read provider csv
  const csvContent = fs.readFileSync(providerCsvPath, 'utf8');
  const csvLines = csvContent.split('\n');
  let dataStartIndex = 15;
  for (let i = 0; i < csvLines.length; i++) {
    if (csvLines[i].startsWith('Recordatorio')) {
      dataStartIndex = i + 1; break;
    }
  }

  const provOmie = new Array(24).fill(0);
  const provConsumo = new Array(24).fill(0);
  for (let i = dataStartIndex; i < csvLines.length; i++) {
    const line = csvLines[i].trim();
    if (!line) continue;
    const cols = line.split(';');
    if (cols[8] === '01/06/2026') {
      let hour = parseInt(cols[9], 10) - 1; // 1-24 to 0-23
      if (hour >= 0 && hour < 24) {
        provOmie[hour] = parseFloat(cols[13]?.replace(',', '.')) || 0;
        provConsumo[hour] = parseFloat(cols[28]?.replace(',', '.')) || 0;
      }
    }
  }

  console.log("--- OMIE COMPARISON FOR 01/06/2026 ---");
  for(let i=0; i<24; i++) {
    console.log(`Hour ${i.toString().padStart(2, '0')}: OURS=${ourOmie[i].toFixed(2).padStart(6)}, PROV=${provOmie[i].toFixed(2).padStart(6)} | Consumo: OURS=${ourConsumo[i].toFixed(3)}, PROV=${provConsumo[i].toFixed(3)}`);
  }

} catch (error) {
  console.error("Error:", error);
}
