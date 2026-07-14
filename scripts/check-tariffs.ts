import { prisma } from '../src/lib/prisma';
prisma.product.findMany({ select: { name: true, tariff: true } }).then(res => {
  console.table(res);
}).finally(() => prisma.$disconnect());
