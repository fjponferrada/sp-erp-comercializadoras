import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Finding AED...');
  const aed = await prisma.company.findFirst({
    where: {
      name: { contains: 'AED' }
    }
  });

  if (!aed) {
    console.log('AED not found!');
    return;
  }

  console.log(`Found AED: ${aed.name} (${aed.id})`);

  const records = await prisma.aggregatedLoadCurve.findMany({
    where: { companyId: null },
    select: { id: true }
  });

  console.log(`Found ${records.length} AggregatedLoadCurve records with null companyId.`);

  if (records.length > 0) {
    const result = await prisma.aggregatedLoadCurve.updateMany({
      where: { companyId: null },
      data: { companyId: aed.id }
    });
    console.log(`Successfully updated ${result.count} records to AED.`);
  } else {
    console.log('No records needed updating.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
