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
    const sps = await prisma.supplyPoint.findMany({
      where: {
        cups: 'ES0294040000003832WJ0F'
      },
      select: {
        id: true,
        cups: true,
        contracts: {
          select: {
            id: true,
            status: true,
            contractCode: true
          }
        }
      }
    });
    console.log(JSON.stringify(sps, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
