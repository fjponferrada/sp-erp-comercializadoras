import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    const filePath = 'Z:\\AED\\AIRTABLE\\Import_facturas\\260709.xlsx';
    const workbook = xlsx.readFile(filePath, { raw: true });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
    
    let existingCount = 0;
    
    // Solo tomamos los numeros de factura
    const invoiceNumbers = rawData.map((row: any) => row['Numero Factura'] || row['Número Factura'] || row['NUMERO FACTURA']).filter(Boolean);
    
    console.log("Total invoice numbers in file:", invoiceNumbers.length);
    
    // Consultamos cuantos de estos ya están en Prisma
    const existing = await prisma.invoice.findMany({
      where: {
        invoiceNumber: { in: invoiceNumbers }
      },
      select: { invoiceNumber: true }
    });
    
    console.log("Existing in DB:", existing.length);
    
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
