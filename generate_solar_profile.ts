import { prisma } from './src/lib/prisma';

const distribution = {
  9: 0.05,
  10: 0.10,
  11: 0.15,
  12: 0.18,
  13: 0.20,
  14: 0.15,
  15: 0.10,
  16: 0.05,
  17: 0.02
};

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

async function main() {
  const profiles = await prisma.reeProfile.findMany({
    select: { year: true },
    distinct: ['year']
  });
  
  for (const { year } of profiles) {
    const days = isLeapYear(year) ? 366 : 365;
    const dailyTotal = 1.0 / days;
    
    for (let hour = 1; hour <= 24; hour++) {
      const weight = distribution[hour as keyof typeof distribution] || 0;
      const pSolarVal = dailyTotal * weight;
      
      await prisma.reeProfile.updateMany({
        where: { year, hour },
        data: { pSolar: pSolarVal }
      });
      console.log(`Updated year ${year} hour ${hour} with pSolar=${pSolarVal}`);
    }
  }
  
  console.log("Finished generating solar profile.");
}

main().catch(console.error).finally(() => process.exit(0));
