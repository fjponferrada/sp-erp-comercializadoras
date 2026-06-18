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
  const invoiceNumbers = [
    'A25-10-18116',
    'A25-11-20821',
    'A25-12-23101',
    'A260100612',
    'A260203464',
    'A260305763',
    'A260408534',
    'A260511231',
    'A260614064'
  ];

  // Buscamos el contrato de Villa Mudarra que se importó mal (recn005s4rlXO8jge)
  const wrongContract = await prisma.contract.findFirst({
    where: { airtableId: 'recn005s4rlXO8jge' }
  });

  if (!wrongContract) {
    console.log('No se encontró el contrato recn005s4rlXO8jge.');
    return;
  }

  console.log(`Contrato incorrecto encontrado con ID: ${wrongContract.id}`);

  const deleteResult = await prisma.invoice.deleteMany({
    where: {
      contractId: wrongContract.id,
      invoiceNumber: { in: invoiceNumbers }
    }
  });

  console.log(`Se han eliminado ${deleteResult.count} facturas duplicadas asociadas al contrato incorrecto.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
