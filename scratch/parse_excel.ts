import * as xlsx from 'xlsx';

async function parseExcel() {
  const workbook = xlsx.readFile('Z:\\AED\\AEAT\\560\\560_1t_26.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  let excelTotal = 0;
  let count = 0;
  
  if (data.length > 0) {
    console.log("Excel Headers:", Object.keys(data[0]));
  }

  for (const row of data) {
    let invNum = row['Factura'] || row['Nº Factura'] || row['Documento'] || row['Concepto'] || row['Descripción'];
    let amount = row['Impuesto'] || row['Importe'] || row['Haber'] || row['Total'] || row['Cuota'];
    
    // Find numeric amount in any property if it's not explicitly named
    if (amount === undefined) {
      for (const val of Object.values(row)) {
        if (typeof val === 'number') {
          amount = val;
          break;
        }
      }
    }

    if (amount !== undefined) {
      excelTotal += amount;
      count++;
    }
  }

  console.log(`Excel Extracted Total from ${count} rows: ${excelTotal}`);
  // Let's print the first 5 rows to see structure
  console.log("Sample Data:", data.slice(0, 5));
}

parseExcel().catch(console.error);
