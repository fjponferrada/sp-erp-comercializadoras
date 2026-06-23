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
      where: {
        activationDate: null
      },
      select: {
        id: true,
        contractCode: true,
        status: true,
        airtableData: true
      }
    });
    
    console.log(`Total contracts with null activationDate: ${contracts.length}`);
    
    let fixableCount = 0;
    
    for (const c of contracts) {
      if (c.airtableData) {
        const airData = typeof c.airtableData === 'string' ? JSON.parse(c.airtableData) : c.airtableData;
        const altaStr = airData['ALTA COMERCIALIZADORA'] || airData['Fecha firma'] || airData['Fecha Registro'] || airData['CALCULO MES ALTA'];
        if (altaStr) {
          fixableCount++;
        }
      }
    }
    
    console.log(`Fixable using Airtable data: ${fixableCount}`);
    
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
