import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const segments = await prisma.supplyPoint.groupBy({ 
    by: ['segment'], 
    _count: { segment: true } 
  }); 
  console.log('Segments:', segments); 
} 
check().finally(() => prisma.$disconnect());
