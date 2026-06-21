const XLSX = require('xlsx');

function dumpHeaders(filePath, sheetNames) {
    const workbook = XLSX.readFile(filePath);
    sheetNames.forEach(sheetName => {
        if(workbook.Sheets[sheetName]) {
            console.log(`\n--- ${sheetName} ---`);
            const xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for(let i=0; i<6; i++) {
                if(xlData[i]) console.log(xlData[i].join(" | "));
            }
        }
    });
}

const file = "Z:\\AED\\Switching\\CNMC - E - V3.0 2024.05.16\\CNMC - E - Anexos 2024.05.16\\CNMC - E - Procesos 2024.05.16\\CNMC - E - Proceso C1 2024.05.16.xlsx";
dumpHeaders(file, ["Paso 06", "Paso 10", "Paso 11", "Paso 12"]);
