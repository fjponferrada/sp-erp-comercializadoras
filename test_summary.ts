import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function check() {
  const p = await prisma.pendingEnergySummary.findUnique({ 
    where: { month: '2026-03' } 
  }); 
  console.log('PendingEnergySummary:', p); 
} 
check().finally(() => prisma.$disconnect());
