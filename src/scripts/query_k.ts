import { prisma } from '../lib/prisma';
const p = prisma;
p.systemComponentPrice.findFirst({where: {date: new Date('2026-06-03T00:00:00Z'), component: 'K'}})
  .then(res => { console.log(JSON.stringify(res, null, 2)); })
  .finally(() => p.$disconnect());
