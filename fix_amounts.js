const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { Client } = require('pg');
require('dotenv').config();

const PDF_DIR = 'A:\\FAMILIA PONFERRADA\\EMPRESAS\\GRUPO PONROD\\P - AED ENERGIA ELECTRICA\\Facturación\\2024\\Emitidas\\Penalizaciones';

function parseEur(str) {
  if (!str) return 0;
  // Remove dots (thousands), replace comma with dot
  const clean = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.docx'));
  
  for (const file of files) {
    const invNum = file.replace('.docx', '');

    // Get all penalty invoices for this document (e.g. AEDEN24-09-1, AEDEN24-09-2)
    const invRes = await client.query('SELECT id, "invoiceNumber" FROM "PenaltyInvoice" WHERE "invoiceNumber" LIKE $1', [invNum + '%']);
    const invoices = invRes.rows;
    if (invoices.length === 0) continue;

    const docxPath = path.join(PDF_DIR, file);
    let text = '';
    try {
      const result = await mammoth.extractRawText({path: docxPath});
      text = result.value;
    } catch (e) {
      continue;
    }

    const baseMatch = text.match(/TOTAL BASE IMPONIBLE\s*([\d\.,]+)\s*€/i);
    const totalMatch = text.match(/TOTAL FACTURA\s*([\d\.,]+)\s*€/i);

    if (baseMatch && totalMatch) {
      const baseAmount = parseEur(baseMatch[1]);
      const totalAmount = parseEur(totalMatch[1]);

      // Divide by number of invoices to avoid duplicating the amount
      const splitBase = baseAmount / invoices.length;
      const splitTotal = totalAmount / invoices.length;

      console.log(`Fixing ${invNum} -> Base: ${baseAmount} (Split: ${splitBase}), Total: ${totalAmount} (Split: ${splitTotal})`);

      for (const inv of invoices) {
        await client.query('UPDATE "PenaltyInvoice" SET amount = $1 WHERE id = $2', [splitTotal, inv.id]);
        // Also update Contract.penalization
        await client.query(`UPDATE "Contract" c 
                            SET penalization = $1 
                            FROM "PenaltyInvoice" p 
                            WHERE p.id = $2 AND c.id = p."contractId"`, [splitBase, inv.id]);
      }
    } else {
      console.log(`Could not find totals in ${file}`);
    }
  }
  
  await client.end();
}
main().catch(console.error);
