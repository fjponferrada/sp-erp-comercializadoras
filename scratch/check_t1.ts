import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { Client } from 'pg';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();

  const res = await client.query(`
    SELECT * 
    FROM "ScrapingJob" 
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);
  
  console.log('Recent ScrapingJobs:', JSON.stringify(res.rows, null, 2));
  await client.end();
}

main().catch(console.error);
