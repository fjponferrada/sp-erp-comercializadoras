import { prisma } from '../lib/prisma';
import fs from 'fs';
import path from 'path';
import { uploadFileToR2 } from '../lib/r2';

const pdfDir = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2026\\Emitidas\\Penalizaciones';

async function run() {
  const files = fs.readdirSync(pdfDir);
  
  let count = 0;
  for (const file of files) {
    if (!file.endsWith('.pdf')) continue;
    
    // Extract invoice number from filename, e.g. "A26PEN017 (pte abonar).pdf" -> "A26PEN017"
    const match = file.match(/^(A26PEN\d+)/);
    if (!match) {
      console.log(`Skipping file with unrecognized format: ${file}`);
      continue;
    }
    
    const invoiceNumber = match[1];
    
    // Check if the invoice exists in the DB
    const invoice = await prisma.penaltyInvoice.findUnique({
      where: { invoiceNumber }
    });
    
    if (!invoice) {
      console.log(`Invoice ${invoiceNumber} not found in DB. Skipping.`);
      continue;
    }
    
    if (invoice.pdfUrl && invoice.pdfUrl.includes('pub-fca109ed13a64441a824c1291850ae74.r2.dev')) {
      console.log(`Invoice ${invoiceNumber} already has a PDF URL uploaded. Skipping.`);
      continue;
    }

    console.log(`Uploading ${file} for ${invoiceNumber}...`);
    
    const filePath = path.join(pdfDir, file);
    const pdfBuffer = fs.readFileSync(filePath);
    
    const fileName = `penalizaciones/2026/${invoiceNumber}.pdf`;
    
    try {
      const pdfUrl = await uploadFileToR2(fileName, pdfBuffer, 'application/pdf');
      
      await prisma.penaltyInvoice.update({
        where: { id: invoice.id },
        data: { pdfUrl }
      });
      
      console.log(`  -> Successfully uploaded and linked: ${pdfUrl}`);
      count++;
    } catch (err) {
      console.error(`  -> Error uploading ${file}:`, err);
    }
  }
  
  console.log(`Finished uploading and linking ${count} PDF files.`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
