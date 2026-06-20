const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.distributor.findMany({ select: { name: true } }).then(console.log);
