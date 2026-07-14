const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const query = `SELECT id, name, type, "pricingModel" FROM "Product"`;
  const res = await client.query(query);
  fs.writeFileSync('scratch/products.json', JSON.stringify(res.rows, null, 2));
  
  await client.end();
}
main().catch(console.error);
