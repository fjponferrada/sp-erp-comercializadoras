import * as xlsx from 'xlsx';

async function parseExcel() {
  const workbook = xlsx.readFile('Z:\\AED\\AEAT\\560\\560_1t_26.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  let haberTotal = 0;
  let debeTotal = 0;
  
  for (const row of data) {
    if (row['Tipo registro'] === 'Detalle' || row['Concepto']?.includes('A260')) {
      const haber = row['Haber'] || 0;
      const debe = row['Debe'] || 0;
      
      if (typeof haber === 'number') haberTotal += haber;
      if (typeof debe === 'number') debeTotal += debe;
    }
  }

  console.log(`Haber Total: ${haberTotal}`);
  console.log(`Debe Total: ${debeTotal}`);
  console.log(`Neto (Haber - Debe): ${haberTotal - debeTotal}`);
  
}

parseExcel().catch(console.error);
