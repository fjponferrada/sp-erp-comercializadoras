const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findFirst({ where: { email: 'pabloremacha@aenergetica.es' } })
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
