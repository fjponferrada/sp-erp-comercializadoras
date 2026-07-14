import 'dotenv/config';
import * as xlsx from 'xlsx';
import { prisma } from '../src/lib/prisma';

async function main() {
  try {
    // 1. READ EXCEL
    const workbook = xlsx.readFile('Z:\\Documentos\\Escritorio\\560 2t 26.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const excelData = xlsx.utils.sheet_to_json(sheet);
    
    let excelSum = 0;
    const excelMap = new Map();
    
    for (const row of excelData as any[]) {
      if (!row.Concepto) continue;
      const invNum = row.Concepto.split(' ')[0]; // E.g., A260407800
      let amount = 0;
      if (row.Haber) amount += parseFloat(row.Haber);
      if (row.Debe) amount -= parseFloat(row.Debe); // Abonos might be in Debe or negative Haber
      
      excelSum += amount;
      excelMap.set(invNum, (excelMap.get(invNum) || 0) + amount);
    }
    
    console.log(`EXCEL TOTAL: ${excelSum.toFixed(2)} euros`);
    
    // 2. QUERY PRISMA (Q2 2026 -> April 1 to June 30)
    const startDate = new Date(Date.UTC(2026, 3, 1));
    const endDate = new Date(Date.UTC(2026, 5, 30, 23, 59, 59, 999));
    
    const dbInvoices = await prisma.invoice.findMany({
      where: {
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
      }
    });
    
    const dbMap = new Map();
    let dbSum = 0;
    const parseNum = (v: any) => v ? parseFloat(v.toString().replace(',', '.')) : 0;
    const seenInvoices = new Set<string>();

    for (const inv of dbInvoices) {
      if (inv.invoiceNumber) {
        if (seenInvoices.has(inv.invoiceNumber)) continue;
        seenInvoices.add(inv.invoiceNumber);
      }
      
      const isAbono = inv.invoiceType?.toLowerCase().includes('abono') || false;
      const data = inv.invoiceData as any;
      let taxAmount = data ? parseNum(data['Importe Impuesto']) : 0;
      
      if (taxAmount === 0) continue;
      if (isAbono && taxAmount > 0) {
        taxAmount = -taxAmount;
      }
      
      dbSum += taxAmount;
      const invNum = inv.invoiceNumber;
      if (invNum) {
        dbMap.set(invNum, (dbMap.get(invNum) || 0) + taxAmount);
      }
    }
    
    console.log(`DB TOTAL: ${dbSum.toFixed(2)} euros`);
    console.log(`DISCREPANCY: ${(excelSum - dbSum).toFixed(2)} euros`);
    
    // 3. FIND DISCREPANCIES
    console.log('\n--- Invoices in EXCEL but not in DB or wrong amount ---');
    for (const [invNum, excelAmount] of excelMap.entries()) {
      const dbAmount = dbMap.get(invNum);
      if (dbAmount === undefined) {
        console.log(`MISSING IN DB: ${invNum} | Excel Amount: ${excelAmount.toFixed(2)}`);
      } else if (Math.abs(excelAmount - dbAmount) > 0.01) {
        console.log(`DIFFERENT AMOUNT: ${invNum} | Excel: ${excelAmount.toFixed(2)} | DB: ${dbAmount.toFixed(2)}`);
      }
    }
    
    console.log('\n--- Invoices in DB but not in EXCEL ---');
    for (const [invNum, dbAmount] of dbMap.entries()) {
      const excelAmount = excelMap.get(invNum);
      if (excelAmount === undefined) {
        console.log(`MISSING IN EXCEL: ${invNum} | DB Amount: ${dbAmount.toFixed(2)}`);
      }
    }

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
