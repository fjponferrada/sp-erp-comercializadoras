const xlsx = require('xlsx');

const file = 'Z:\\AED\\Switching\\CNMC - E - V3.0 2024.05.16\\CNMC - E - Anexos 2024.05.16\\CNMC - E - Procesos 2024.05.16\\CNMC - E - Proceso M1 2024.05.16.xlsx';

try {
  const wb = xlsx.readFile(file);
  const step01Sheet = wb.Sheets['Paso 01'];
  if (!step01Sheet) {
    console.log("No sheet '01' found. Available sheets:", wb.SheetNames);
  } else {
    const data = xlsx.utils.sheet_to_json(step01Sheet, { defval: null, header: 1 });
    console.log("Searching for Autoconsumo fields in step 01...");
    // Let's find rows that mention "TipoCUPS" or "Esquema" or "Instalacion"
    data.forEach((row, i) => {
      const rowStr = JSON.stringify(row).toLowerCase();
      if (rowStr.includes('tipocups') || rowStr.includes('esquema') || rowStr.includes('instalacion') || rowStr.includes('autoconsumo')) {
        console.log(`Row ${i}:`, row);
      }
    });
  }
} catch(e) {
  console.error("Error leyendo archivo:", e.message);
}
