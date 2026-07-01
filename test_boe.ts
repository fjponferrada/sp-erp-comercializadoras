import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const boe = await prisma.regulatedCost.findMany({ where: { concept: 'PERDIDAS' } }); 
  console.log('BOE:', boe); 
  
  const k = await prisma.systemComponentPrice.findFirst({
    where: { component: 'K', date: new Date('2026-03-01T00:00:00.000Z') }
  });
  console.log('K factor for March 1:', k);
} 
check().finally(() => prisma.$disconnect());
