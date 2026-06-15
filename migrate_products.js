const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require' });
client.connect();

async function run() {
  try {
    const res1 = await client.query(`
      UPDATE "Product"
      SET "pricingModel" = 'INDEXED'
      WHERE type ILIKE '%index%'
    `);
    console.log(`Updated ${res1.rowCount} products to INDEXED pricing model.`);
    
    const res2 = await client.query(`
      UPDATE "Product"
      SET "pricingModel" = 'FIXED'
      WHERE type NOT ILIKE '%index%'
    `);
    console.log(`Updated ${res2.rowCount} products to FIXED pricing model.`);

    const res3 = await client.query(`
      UPDATE "Product"
      SET "hasSelfConsumption" = true
      WHERE name ILIKE '%solar%' OR name ILIKE '%autoconsumo%'
    `);
    console.log(`Updated ${res3.rowCount} products to have self-consumption.`);
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
}

run();
