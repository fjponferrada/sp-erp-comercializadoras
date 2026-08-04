import * as xlsx from 'xlsx';
import { prisma } from '../src/lib/prisma';
import 'dotenv/config';

async function compare() {
  const brandId = 'cmq6j25l50001d441e0c06g9t';
  const year = 2026;
  
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 2, 31, 23, 59, 59, 999));

  const invoices = await prisma.invoice.findMany({
    where: { client: { brandId }, issueDate: { gte: startDate, lte: endDate } },
    include: { supplyPoint: true },
  });

  const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
  
  const dbInvoices = new Map<string, number>();
  
  for (const inv of invoices) {
    if (!inv.invoiceNumber) continue;
    
    const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
    const data = inv.invoiceData as any;
    
    let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
    
    if (taxAmount === 0) continue;
    
    if (isAbono && taxAmount > 0) {
      taxAmount = -taxAmount;
    }
    
    // Sum duplicate invoice numbers if they somehow exist, though they shouldn't
    const current = dbInvoices.get(inv.invoiceNumber) || 0;
    dbInvoices.set(inv.invoiceNumber, current + taxAmount);
  }

  const workbook = xlsx.readFile('Z:\\AED\\AEAT\\560\\560_1t_26.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet) as any[];

  console.log(`Loaded ${data.length} rows from Excel.`);
  
  const accountingInvoices = new Map<string, number>();
  let excelTotal = 0;
  
  // Find the column that contains the invoice number and the tax amount
  // We need to guess the headers or print the first row
  if (data.length > 0) {
    console.log("Excel Headers:", Object.keys(data[0]));
  }

  // Assuming columns might be named 'Factura', 'NumFactura', 'Importe', 'Haber', 'Debe'
  for (const row of data) {
    let invNum = row['Factura'] || row['Nº Factura'] || row['Documento'] || row['Concepto'];
    let amount = row['Impuesto'] || row['Importe'] || row['Haber'] || row['Total'];
    
    // If we have to parse from string 'A260...'
    if (typeof invNum === 'string') {
      const match = invNum.match(/A260\d{6}/);
      if (match) invNum = match[0];
    }
    
    if (invNum && amount !== undefined) {
      const numAmount = parseNum(amount);
      const current = accountingInvoices.get(invNum) || 0;
      accountingInvoices.set(invNum, current + numAmount);
      excelTotal += numAmount;
    }
  }

  console.log(`Excel Extracted Total: ${excelTotal}`);

  let diffCount = 0;
  for (const [invNum, accAmount] of accountingInvoices.entries()) {
    const dbAmount = dbInvoices.get(invNum);
    if (dbAmount === undefined) {
      console.log(`In Accounting but missing in DB: ${invNum} -> ${accAmount} €`);
      diffCount++;
    } else if (Math.abs(dbAmount - accAmount) > 0.02) {
      console.log(`Mismatch in ${invNum}: DB = ${dbAmount} €, Acc = ${accAmount} €`);
      diffCount++;
    }
  }

  for (const [invNum, dbAmount] of dbInvoices.entries()) {
    const accAmount = accountingInvoices.get(invNum);
    if (accAmount === undefined) {
      console.log(`In DB but missing in Accounting: ${invNum} -> ${dbAmount} €`);
      diffCount++;
    }
  }

  if (diffCount === 0) console.log("No differences found!");
}

compare().catch(console.error).finally(() => prisma.$disconnect());
