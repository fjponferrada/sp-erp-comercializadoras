import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const airtableIds = ['rec14iq5s8z0eDrRW', 'recn005s4rlXO8jge'];

  for (const id of airtableIds) {
    console.log(`Borrando Lead asociado al contrato ${id}...`);
    await prisma.lead.deleteMany({ where: { airtableId: id } });

    console.log(`Borrando Contrato ${id}...`);
    await prisma.contract.deleteMany({ where: { airtableId: id } });
  }

  console.log('Borrados completados.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
