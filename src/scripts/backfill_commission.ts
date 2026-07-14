import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

async function main() {
  console.log('Starting commissionFinal backfill...');

  const contracts = await prisma.contract.findMany({
    where: {
      airtableData: {
        not: Prisma.AnyNull, // Has JSON data
      }
    }
  });

  console.log(`Found ${contracts.length} contracts with airtableData.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const contract of contracts) {
    const data = contract.airtableData as any;
    
    if (!data) {
      skippedCount++;
      continue;
    }

    const comisionRaw = data['COMISION (from COMISIONES)'];

    if (comisionRaw !== undefined && comisionRaw !== null) {
      let comisionVal = null;

      if (Array.isArray(comisionRaw) && comisionRaw.length > 0) {
        comisionVal = parseFloat(comisionRaw[0]);
      } else if (typeof comisionRaw === 'number' || typeof comisionRaw === 'string') {
        comisionVal = parseFloat(comisionRaw as string);
      }

      if (comisionVal !== null && !isNaN(comisionVal)) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { commissionFinal: comisionVal }
        });
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`Finished. Updated: ${updatedCount}, Skipped: ${skippedCount}.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
