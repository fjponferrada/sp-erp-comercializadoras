import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { prisma } from '../src/lib/prisma';

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { contains: 'AED 1P BOE' } }
  });
  
  for (const p of products) {
    if (p.name.endsWith(' ')) {
      console.log(`Deleting ghost product: ${p.name} (${p.id})`);
      await prisma.product.delete({ where: { id: p.id } });
    }
  }
}
main().then(() => prisma.$disconnect()).catch(console.error);
