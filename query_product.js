const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.product.findUnique({where: {id: 'cmqcn8zpo0005uw41s8y0qhbw'}}).then(console.log).finally(() => prisma.$disconnect());
