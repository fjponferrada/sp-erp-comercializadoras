import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
  try {
    const filePath = 'Z:\\AED\\Comisiones\\NUR\\Com_NU_2604.xlsx';
    if (!fs.existsSync(filePath)) {
      console.log('File does not exist:', filePath);
      return;
    }
    const workbook = XLSX.readFile(filePath);
    
    console.log('Sheet Names:', workbook.SheetNames);
    
    for (const sheetName of workbook.SheetNames) {
      console.log(`\n--- Sheet: ${sheetName} ---`);
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Only print first 20 rows to avoid blowing up the log
      for (let i = 0; i < Math.min(20, data.length); i++) {
        console.log(JSON.stringify(data[i]));
      }
    }
  } catch (error) {
    console.error('Error reading excel:', error);
  }
}

main();
