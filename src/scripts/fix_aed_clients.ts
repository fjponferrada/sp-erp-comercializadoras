import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();

  console.log("Connected to DB, finding clients with email 'clientes@aed-energia.com' and no phone...");

  // Find clients
  const res = await pgClient.query(`
    SELECT c.id, c."vatNumber", c."businessName", c."firstName", c."lastName" 
    FROM "Client" c 
    WHERE c."contactEmail" = $1 AND (c."contactPhone" IS NULL OR c."contactPhone" = '')
  `, ['clientes@aed-energia.com']);

  const clients = res.rows;
  console.log(`Found ${clients.length} clients in this situation.`);

  let updatedCount = 0;

  for (const client of clients) {
    // Find a supply point for this client
    const spRes = await pgClient.query(`
      SELECT id, cups, "airtableData"
      FROM "SupplyPoint"
      WHERE "clientId" = $1
      LIMIT 1
    `, [client.id]);

    const sp = spRes.rows[0];
    if (!sp || !sp.airtableData) {
      continue;
    }

    let airData = sp.airtableData;
    if (typeof airData === 'string') {
      try { airData = JSON.parse(airData); } catch (e) { continue; }
    }

    if (!airData) continue;

    // Extract email
    const emailToSet = airData['EMAIL FACTURA'] || airData['Email Contacto'] || airData['EMAIL'] || airData['EMAIL_4'] || null;
    
    // Extract phone
    const phoneToSet = airData['Teléfono Contacto'] || airData['TLF'] || airData['TLF_2'] || airData['TLF_3'] || null;

    if (emailToSet && phoneToSet) {
      console.log(`\nClient: ${client.businessName} (VAT: ${client.vatNumber})`);
      console.log(`  -> Found in Airtable: Email=${emailToSet}, Phone=${phoneToSet}`);
      
      // We auto-correct!
      await pgClient.query(`
        UPDATE "Client"
        SET "contactEmail" = $1, "contactPhone" = $2
        WHERE id = $3
      `, [emailToSet, phoneToSet, client.id]);
      
      updatedCount++;
      console.log(`  -> UPDATED in DB!`);
    } else if (emailToSet) {
      console.log(`\nClient: ${client.businessName} (VAT: ${client.vatNumber})`);
      console.log(`  -> Found in Airtable: Email=${emailToSet}, Phone not found`);
      
      await pgClient.query(`
        UPDATE "Client"
        SET "contactEmail" = $1
        WHERE id = $2
      `, [emailToSet, client.id]);
      
      updatedCount++;
      console.log(`  -> UPDATED email only in DB!`);
    }
  }

  console.log(`\nFinished! Successfully auto-corrected ${updatedCount} clients.`);
  await pgClient.end();
}

main().catch(console.error);
