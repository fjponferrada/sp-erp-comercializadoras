const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const query = `
    SELECT c.cups, c."pricingModel", p.type as "productType", f."jsonData"
    FROM "InternalInvoice" i
    JOIN "Contract" c ON i."contractId" = c.id
    LEFT JOIN "Product" p ON c."productId" = p.id
    JOIN "F1Invoice" f ON i."f1InvoiceId" = f.id
    WHERE c.cups IN ('ES0021000042259265YM', 'ES00210000422921635Z');
  `;
  const res = await client.query(query);
  
  const result = res.rows.map(row => ({
    cups: row.cups,
    pricingModel: row.pricingModel,
    productType: row.productType,
    airtableFijoIndex: row.jsonData['AirTable FIJO/INDEX'] || null,
    f1JsonData: row.jsonData
  }));

  fs.writeFileSync('scratch/debug2.json', JSON.stringify(result, null, 2));
  console.log('done');
  await client.end();
}
main().catch(console.error);
