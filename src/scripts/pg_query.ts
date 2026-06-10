import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query('SELECT id, "businessName", "vatNumber" FROM "Client"');
  const allClients = res.rows;

  const byName: Record<string, typeof allClients> = {};
  for (const c of allClients) {
    const name = c.businessName ? c.businessName.trim().toUpperCase() : '';
    if (!name) continue;
    if (!byName[name]) byName[name] = [];
    byName[name].push(c);
  }

  const badClientIds = [];
  const duplicates = [];

  for (const [name, clients] of Object.entries(byName)) {
    if (clients.length > 1) {
      const hasCif = clients.some(c => c.vatNumber.match(/^[A-W]/i));
      const hasDni = clients.some(c => c.vatNumber.match(/^[0-9XYZ]/i));
      
      if (hasCif && hasDni) {
        duplicates.push({ name, clients });
        const badClients = clients.filter(c => c.vatNumber.match(/^[0-9XYZ]/i));
        badClientIds.push(...badClients.map(c => c.id));
      }
    }
  }

  console.log(`Encontrados ${duplicates.length} grupos duplicados. Total bad clients: ${badClientIds.length}`);

  if (badClientIds.length > 0) {
    // Check contracts
    const params = badClientIds.map((_, i) => `$${i + 1}`).join(',');
    const contractsRes = await client.query(`SELECT count(id) FROM "Contract" WHERE "clientId" IN (${params})`, badClientIds);
    const spRes = await client.query(`SELECT count(id) FROM "SupplyPoint" WHERE "clientId" IN (${params})`, badClientIds);
    const invRes = await client.query(`SELECT count(id) FROM "Invoice" WHERE "clientId" IN (${params})`, badClientIds);
    
    console.log(`Contratos asignados a bad clients: ${contractsRes.rows[0].count}`);
    console.log(`CUPS asignados a bad clients: ${spRes.rows[0].count}`);
    console.log(`Facturas asignadas a bad clients: ${invRes.rows[0].count}`);
  }

  await client.end();
}

main().catch(console.error);
