const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require' });
client.connect();

async function run() {
  try {
    const res = await client.query(`
      UPDATE "Product"
      SET "isCustomizable" = true
      WHERE name ILIKE '%personalizad%' OR name ILIKE '%pers.%' OR type ILIKE '%personalizad%'
    `);
    console.log(`Updated ${res.rowCount} products to be customizable.`);
  } catch(e) {
    console.error(e);
  } finally {
    client.end();
  }
}

run();
