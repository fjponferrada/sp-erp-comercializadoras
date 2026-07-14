import { prisma } from '@/lib/prisma';
import { getDaysInMonth } from 'date-fns';

async function main() {
  const ppa = await prisma.ppa.findFirst({
    where: { name: { contains: 'RENEE RJE FIN SOLAR' } }
  });
  
  const start = new Date('2026-04-01T00:00:00Z');
  const end = new Date('2026-04-30T23:59:59Z');

  const omiePrices = await prisma.systemComponentPrice.findMany({
    where: {
      component: 'OMIE',
      date: { gte: start, lte: end }
    },
    orderBy: { date: 'asc' }
  });

  let totalMwh = 0;
  let omieMedioPpaNumerator = 0;
  const profileData = ppa.profileData as any;

  for (const dailyData of omiePrices) {
    const month = dailyData.date.getMonth();
    const daysInMonth = 30; // April
    const values = dailyData.values;
    const isQuarterly = values.length > 24;

    for (let i = 0; i < values.length; i++) {
      const omiePrice = values[i];
      const hour = isQuarterly ? Math.floor(i / 4) : i;
      const profileHour = Math.min(hour, 23); 
      
      const monthlyMwhForHour = profileData[month] ? profileData[month][profileHour] || 0 : 0;
      const dailyMwhForHour = monthlyMwhForHour / daysInMonth;
      const mwhInterval = isQuarterly ? (dailyMwhForHour / 4) : dailyMwhForHour; 

      totalMwh += mwhInterval;
      omieMedioPpaNumerator += (omiePrice * mwhInterval);
    }
  }

  const omieMedioPpa = totalMwh > 0 ? (omieMedioPpaNumerator / totalMwh) : 0;
  console.log(`Total MWh: ${totalMwh}`);
  console.log(`OMIE Medio PPA: ${omieMedioPpa}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
