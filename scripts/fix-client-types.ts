import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const clients = await prisma.client.findMany({
    where: {
      clientType: { startsWith: 'rec' }
    }
  });

  for (const client of clients) {
    const isPhysical = !!client.firstName; // Si tiene primer apellido/nombre, es F. Si no, J.
    await prisma.client.update({
      where: { id: client.id },
      data: { clientType: isPhysical ? 'F' : 'J' }
    });
  }

  console.log(`Corregidos ${clients.length} clientes con clientType tipo recXXXXX.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
