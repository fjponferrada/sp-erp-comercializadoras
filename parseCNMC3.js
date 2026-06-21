const XLSX = require('xlsx');

function getSenderReceiver(filePath, sheetName) {
    const workbook = XLSX.readFile(filePath);
    const xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    let desc = xlData[0] ? xlData[0][0] : "";
    return desc;
}

const file = "Z:\\AED\\Switching\\CNMC - E - V3.0 2024.05.16\\CNMC - E - Anexos 2024.05.16\\CNMC - E - Procesos 2024.05.16\\CNMC - E - Proceso C1 2024.05.16.xlsx";
console.log("06: " + getSenderReceiver(file, "Paso 06"));
console.log("08: " + getSenderReceiver(file, "Paso 08"));
console.log("09 (Acepta): " + getSenderReceiver(file, "Paso 09 (acepta)"));
console.log("10: " + getSenderReceiver(file, "Paso 10"));
console.log("11: " + getSenderReceiver(file, "Paso 11"));
console.log("12: " + getSenderReceiver(file, "Paso 12"));
