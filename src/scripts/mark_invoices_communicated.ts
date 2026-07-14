import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("Marcando todas las facturas como comunicadas...");

  try {
    const res = await client.query('UPDATE "Invoice" SET "communicatedAt" = NOW() WHERE "communicatedAt" IS NULL');
    console.log(`Éxito. Se han marcado ${res.rowCount} facturas como comunicadas.`);
  } catch (error) {
    console.error("Error al actualizar facturas:", error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
