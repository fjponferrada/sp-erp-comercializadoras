import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { prisma } from '../src/lib/prisma';

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { contains: 'AED 1P BOE' } }
  });
  console.log('Found products:');
  for (const p of products) {
    console.log(`- ID: ${p.id}, Name: "${p.name}", Tariff: ${p.tariff}`);
  }
}
main().then(() => prisma.$disconnect()).catch(console.error);
