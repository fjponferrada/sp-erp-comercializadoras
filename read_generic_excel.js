const xlsx = require('xlsx');
const file = process.argv[2];
try {
  const wb = xlsx.readFile(file);
  const result = {};
  wb.SheetNames.forEach(sheetName => {
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
    result[sheetName] = {
      totalRows: data.length,
      sampleData: data.slice(0, 5) // Muestra las 5 primeras filas para no inundar el output
    };
  });
  console.log(JSON.stringify(result, null, 2));
} catch(e) {
  console.error("Error leyendo archivo:", e.message);
}
