import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const contract = await prisma.contract.findFirst({
    where: { contractCode: 'AEDJP2211301317J0F' },
    include: { client: true }
  });
  
  if (!contract) return;

  const data = contract.airtableData as any;
  const realCif = data['CIF'] ? data['CIF'].toString().trim() : (data['NIF'] ? data['NIF'].toString().trim() : null);

  console.log('Data CIF:', data['CIF']);
  console.log('realCif:', realCif);
  console.log('Contract Client VAT:', contract.client?.vatNumber);
  console.log('Condition:', contract.client?.vatNumber !== realCif);
}

run().finally(() => process.exit(0));
