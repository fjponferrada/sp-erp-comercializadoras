const XLSX = require('xlsx');

function readProcess(filePath) {
    const workbook = XLSX.readFile(filePath);
    workbook.SheetNames.forEach(sheetName => {
        if (sheetName.includes('10') || sheetName.includes('11')) {
            console.log(`\n\n--- Sheet: ${sheetName} ---`);
            const xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let i = 0; i < Math.min(10, xlData.length); i++) {
                console.log(`[Row ${i}] ` + xlData[i].join(' | '));
            }
        }
    });
}

readProcess(process.argv[2]);
