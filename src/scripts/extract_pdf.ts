import fs from 'fs';
const pdfParse = require('pdf-parse');

async function extractInfo(filePath: string) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse.PDFParse(dataBuffer);
  console.log(`\n--- Extracted from ${filePath} ---`);
  // Print first 500 chars to find CUPS, CIF, etc.
  // Or just use regex to extract them
  const text = data.text;
  
  const cupsMatch = text.match(/ES\d{16,20}[A-Z]{2}/);
  const cifMatch = text.match(/[A-Z]?\d{8}[A-Z]?/);
  // Match an amount like "45,79 €" or "37,84"
  const amountMatch = text.match(/\d+,\d{2}\s*€/g);
  
  console.log('CUPS:', cupsMatch ? cupsMatch[0] : 'Not found');
  console.log('CIF (potential):', cifMatch ? cifMatch[0] : 'Not found');
  console.log('Amounts:', amountMatch);
  console.log('Raw text excerpt:\n', text.substring(0, 800));
}

async function run() {
  await extractInfo('A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2026\\Emitidas\\Penalizaciones\\A26PEN026.pdf');
  await extractInfo('A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2026\\Emitidas\\Penalizaciones\\A26PEN027.pdf');
}

run().catch(console.error);
