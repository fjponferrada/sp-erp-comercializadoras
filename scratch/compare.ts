import * as xlsx from 'xlsx';

async function compare() {
  const dbDataRes = await fetch('http://127.0.0.1:3000/api/test-excel');
  const dbInvoices = await dbDataRes.json();
  
  if (dbInvoices.error) {
    console.error("DB Fetch Error:", dbInvoices.error);
    return;
  }

  const workbook = xlsx.readFile('Z:\\AED\\AEAT\\560\\560_1t_26.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  const accountingInvoices = new Map<string, number>();
  let excelTotal = 0;

  for (const row of data) {
    if (row['Tipo registro'] === 'Detalle' || row['Concepto']?.includes('A260')) {
      let invNum = row['Factura'] || row['Nº Factura'] || row['Concepto'];
      if (typeof invNum === 'string') {
        const match = invNum.match(/A260\d{6}/);
        if (match) invNum = match[0];
      }

      const haber = row['Haber'] || 0;
      const debe = row['Debe'] || 0;
      let amount = 0;
      
      if (typeof haber === 'number') amount += haber;
      if (typeof debe === 'number') amount -= debe; // Abonos restan

      if (invNum && amount !== 0) {
        const current = accountingInvoices.get(invNum) || 0;
        accountingInvoices.set(invNum, current + amount);
        excelTotal += amount;
      }
    }
  }

  const differences: any[] = [];
  let diffSum = 0;

  for (const [invNum, accAmount] of accountingInvoices.entries()) {
    const dbAmount = dbInvoices[invNum];
    const accRound = Math.round(accAmount * 100) / 100;
    const dbRound = Math.round((dbAmount || 0) * 100) / 100;
    
    if (dbAmount === undefined) {
      differences.push({ type: 'IN_ACC_NOT_IN_DB', invNum, accAmount: accRound, dbAmount: 0, diff: accRound });
      diffSum += accRound;
    } else if (Math.abs(dbRound - accRound) > 0.01) {
      const diff = Math.round((accRound - dbRound)*100)/100;
      differences.push({ type: 'MISMATCH', invNum, accAmount: accRound, dbAmount: dbRound, diff });
      diffSum += diff;
    }
  }

  for (const [invNum, dbAmount] of Object.entries(dbInvoices) as [string, number][]) {
    const accAmount = accountingInvoices.get(invNum);
    if (accAmount === undefined) {
      const dbRound = Math.round(dbAmount * 100) / 100;
      differences.push({ type: 'IN_DB_NOT_IN_ACC', invNum, accAmount: 0, dbAmount: dbRound, diff: -dbRound });
      diffSum -= dbRound;
    }
  }

  console.log(`Excel Total: ${excelTotal}`);
  console.log(`DB Total: ${Object.values(dbInvoices).reduce((a: any,b: any)=>a+b,0)}`);
  console.log(`Found ${differences.length} differences, totaling: ${Math.round(diffSum * 100) / 100} €`);
  console.log(differences);
}

compare().catch(console.error);
