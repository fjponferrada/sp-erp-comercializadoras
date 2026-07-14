require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDimkTx3UGQ678C';

async function fetchAirtable(table, recordId) {
    const url = 'https://api.airtable.com/v0/' + BASE_ID + '/' + encodeURIComponent(table) + '?filterByFormula={Numero Factura}=\'' + recordId + '\'';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + API_KEY } });
    const data = await res.json();
    return data.records && data.records.length > 0 ? data.records[0] : null;
}

async function main() {
  const invoices = await prisma.invoice.findMany();
  console.log(`Syncing docs for ${invoices.length} invoices...`);
  
  for (const inv of invoices) {
    if (!inv.invoiceNumber) continue;
    
    const airtableRecord = await fetchAirtable('FACTURAS', inv.invoiceNumber);
    if (airtableRecord && airtableRecord.fields) {
      let pDF = null;
      let xML = null;
      
      const pdfField = airtableRecord.fields['PDF'];
      if (Array.isArray(pdfField) && pdfField.length > 0 && pdfField[0].url) {
        pDF = pdfField[0].url;
      }
      
      const xmlField = airtableRecord.fields['XML'];
      if (Array.isArray(xmlField) && xmlField.length > 0 && xmlField[0].url) {
        xML = xmlField[0].url;
      }
      
      if (pDF || xML) {
        await prisma.invoice.update({
          where: { id: inv.id },
          data: { pDF, xML }
        });
        console.log(`Updated ${inv.invoiceNumber}: PDF=${!!pDF}, XML=${!!xML}`);
      }
    }
  }
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
