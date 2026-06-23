import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        supplyPoint: true
      }
    });
    
    let mismatchedCount = 0;
    
    for (const c of contracts) {
      if (c.airtableData && c.supplyPoint) {
        const airData = typeof c.airtableData === 'string' ? JSON.parse(c.airtableData) : c.airtableData;
        const cifLink = airData['Copia de CIF link'] || airData['NIF Contacto'];
        
        // Let's get the client of this supply point
        const client = await prisma.client.findUnique({
          where: { id: c.supplyPoint.clientId }
        });
        
        if (client && cifLink && client.cif !== cifLink) {
          mismatchedCount++;
          // console.log(`Contract ${c.contractCode}: DB Client CIF = ${client.cif}, Airtable CIF = ${cifLink}`);
        }
      }
    }
    
    console.log(`Total contracts with mismatched CIF: ${mismatchedCount}`);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
