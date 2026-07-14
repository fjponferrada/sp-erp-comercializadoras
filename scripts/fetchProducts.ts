import { config } from 'dotenv';
config();
import { prisma } from '../src/lib/prisma';
async function run() {
  const products = await prisma.product.findMany();
  products.forEach(p => console.log(p.name, '| type:', p.type, '| tariff:', p.tariff, '| pricing:', p.pricingModel));
}
run();
