const XLSX = require('xlsx');

function getSenderReceiver(filePath, sheetName) {
    const workbook = XLSX.readFile(filePath);
    const xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    let title = "";
    if (xlData[0]) title = xlData[0][0];
    return title;
}

const file = "Z:\\AED\\Switching\\CNMC - E - V3.0 2024.05.16\\CNMC - E - Anexos 2024.05.16\\CNMC - E - Procesos 2024.05.16\\CNMC - E - Proceso C1 2024.05.16.xlsx";
console.log("Paso 10: " + getSenderReceiver(file, "Paso 10"));
console.log("Paso 11: " + getSenderReceiver(file, "Paso 11"));
console.log("Paso 12: " + getSenderReceiver(file, "Paso 12"));
console.log("Paso 08: " + getSenderReceiver(file, "Paso 08"));
console.log("Paso 09 (acepta): " + getSenderReceiver(file, "Paso 09 (acepta)"));
