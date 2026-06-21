const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.syncJob.findMany({ orderBy: { createdAt: 'desc' }, take: 1 })
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
