import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.user.findFirst({where: {email: 'pabloremacha@aenergetica.es'}}).then(console.log).finally(() => p.$disconnect());
