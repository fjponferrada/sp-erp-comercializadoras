const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require'
  });

  try {
    await client.connect();
    
    // Check MATRICIAL for June 23, 2026 for CAD
    const resMatricial = await client.query(`
      SELECT "jsonData"
      FROM "ReganecuData"
      WHERE "date" = '2026-06-23 00:00:00'
      AND "matricial" = true
      AND "cierre" = 'A2'
    `);

    if (resMatricial.rows.length > 0) {
      const items = resMatricial.rows[0].jsonData;
      
      const cadItems = items.filter(i => i.concept === 'CAD');
      console.log(`Found ${cadItems.length} CAD items in MATRICIAL`);
      if (cadItems.length > 0) {
        console.log("Sample CAD item:", cadItems[0]);
      } else {
        console.log("No CAD in MATRICIAL. Listing unique concepts in MATRICIAL:");
        console.log([...new Set(items.map(i => i.concept))].join(', '));
      }
      
    } else {
      console.log("No matricial data");
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
