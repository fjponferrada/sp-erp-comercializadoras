import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const db = await prisma.reganecuData.findFirst({ 
    where: { 
      date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') }, 
      total: true, 
      matricial: false 
    }, 
    orderBy: { cierre: 'desc' } 
  }); 
  console.log('Reganecu March:', db); 
} 
check().finally(() => prisma.$disconnect());
