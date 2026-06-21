import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true"
  });
  
  try {
    await client.connect();
    console.log('Connected to DB');

    const productRes = await client.query('SELECT id, name, tariff FROM "Product" WHERE name ILIKE $1', ['%ERANOVUM BOE Index%']);
    const product = productRes.rows[0];
    
    if (!product) {
      console.log('Product ERANOVUM BOE Index not found!');
      return;
    }
    
    console.log(`Found product: ${product.name} (ID: ${product.id}, Tariff: ${product.tariff})`);

    const updateRes = await client.query('UPDATE "Contract" SET "productId" = $1 WHERE id = $2 RETURNING id, "productId"', [product.id, 'cmq6zhssi0zdlic41968h0wkl']);
    
    if (updateRes.rows.length > 0) {
      console.log(`Contract updated successfully! Assigned Product ID: ${updateRes.rows[0].productId}`);
    } else {
      console.log(`Contract not found or not updated.`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
