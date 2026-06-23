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
        supplyPoint: {
          cups: 'ES0031103213849001MV0F'
        }
      },
      select: {
        id: true,
        contractCode: true,
        status: true,
        activationDate: true
      }
    });
    console.log(contracts);
    
    // Check all statuses in the DB
    const statuses = await prisma.contract.groupBy({
      by: ['status'],
      _count: true
    });
    console.log(statuses);

  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
