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
    const result = await prisma.contract.updateMany({
      where: {
        status: {
          in: ['RECHAZADO', 'RECHAZO_DISTRIBUIDORA', 'BORRADOR', 'TRAMITANDO', 'DRAFT', 'Borrador', 'ACEPTADO']
        }
      },
      data: {
        activationDate: null
      }
    });
    console.log(`Reverted activationDate to null for ${result.count} non-active contracts.`);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
