const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("=== ISSUE 1: ERANOVUM CONTRATOS FIJOS ===");
  const res1 = await client.query(`
    SELECT i.id, c."pricingModel", f."jsonData"->>'AirTable FIJO/INDEX' as f1_fijo, sp.cups
    FROM "InternalInvoice" i
    JOIN "Contract" c ON i."contractId" = c.id
    JOIN "SupplyPoint" sp ON c."supplyPointId" = sp.id
    LEFT JOIN "f1Invoice" f ON i."f1InvoiceId" = f.id
    JOIN "Client" cl ON c."clientId" = cl.id
    WHERE cl."businessName" ILIKE '%ERANOVUM%'
  `);
  console.table(res1.rows);

  console.log("\n=== ISSUE 2: ES0031105643212001CLAF CURVAS ===");
  const res2 = await client.query(`
    SELECT date, "totalEnergy", "period", "source"
    FROM "LoadCurve"
    WHERE cups LIKE 'ES0031105643212001%' 
      AND date >= '2026-06-01T00:00:00Z'
      AND date < '2026-07-02T00:00:00Z'
    ORDER BY date ASC
  `);
  
  console.log(`Found ${res2.rows.length} curve records`);
  if (res2.rows.length > 0) {
    console.log(`First: ${res2.rows[0].date}, Last: ${res2.rows[res2.rows.length-1].date}`);
    const total = res2.rows.reduce((acc, row) => acc + (row.totalEnergy || 0), 0);
    console.log(`Total energy: ${total}`);
    // Group by source or display a sample
    const sample = res2.rows.slice(0, 5);
    console.log("Sample records:", sample);
  }

  await client.end();
}

main().catch(console.error);
