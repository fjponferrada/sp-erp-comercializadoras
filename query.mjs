import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.client.findFirst({ where: { vatNumber: '30205968E' } }).then(c => console.log(JSON.stringify(c, null, 2))).catch(e => console.error(e)).finally(() => prisma.$disconnect());
