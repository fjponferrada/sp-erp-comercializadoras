const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require',
});

async function run() {
  await client.connect();

  console.log("Checking Pablo Remacha's BAJA contracts...");
  
  // Find channel Pablo Remacha
  const channelRes = await client.query(`
    SELECT id FROM "Channel" WHERE name ILIKE '%Remacha%' LIMIT 1
  `);
  if (channelRes.rows.length === 0) {
    console.log("Channel not found");
    return;
  }
  const channelId = channelRes.rows[0].id;

  // Terminations
  const termRes = await client.query(`
    SELECT c.id, c."contractCode", c."activationDate", c."terminationDate", c.status, c.version
    FROM "Contract" c
    JOIN "User" u ON c."userId" = u.id
    WHERE u."channelId" = $1 AND c."terminationDate" IS NOT NULL
    ORDER BY c."terminationDate" DESC
  `, [channelId]);

  console.log(`Found ${termRes.rows.length} contracts with terminationDate.`);
  if (termRes.rows.length > 0) {
    console.log("Top 5 most recent terminations:");
    console.log(termRes.rows.slice(0, 5));
  }

  // Find status BAJA but no terminationDate
  const bajaRes = await client.query(`
    SELECT COUNT(*) as cnt
    FROM "Contract" c
    JOIN "User" u ON c."userId" = u.id
    WHERE u."channelId" = $1 AND c.status = 'BAJA' AND c."terminationDate" IS NULL
  `, [channelId]);
  
  console.log(`Contracts with status 'BAJA' but terminationDate is NULL: ${bajaRes.rows[0].cnt}`);

  const byMonth = {};
  for (const c of termRes.rows) {
    const d = new Date(c.terminationDate);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    
    const act = new Date(c.activationDate);
    const daysActive = Math.floor((d.getTime() - act.getTime()) / (1000 * 60 * 60 * 24));
    const isDecommission = daysActive < 365;

    if (!byMonth[key]) byMonth[key] = { total: 0, decommission: 0 };
    byMonth[key].total++;
    if (isDecommission) byMonth[key].decommission++;
  }
  console.log("Terminations by month (Total / Decommission < 365 days):");
  for (const key in byMonth) {
    console.log(`  ${key}: Total=${byMonth[key].total}, Decommissions=${byMonth[key].decommission}`);
  }

  await client.end();
}

run().catch(console.error);
