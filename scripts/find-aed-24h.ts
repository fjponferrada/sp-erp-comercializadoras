import { prisma } from '../src/lib/prisma';
prisma.product.findMany({
  where: { name: { contains: 'AED 24h' } }
}).then(res => {
  console.log(`Found ${res.length} products`);
  res.forEach(p => console.log(`- ${p.name} | Tarifa: ${p.tariff} | ID: ${p.id}`));
}).finally(() => prisma.$disconnect());
