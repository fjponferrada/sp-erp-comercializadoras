import { prisma } from '../lib/prisma';

async function main() {
  const allSPs = await prisma.supplyPoint.findMany({
    select: {
      id: true,
      cups: true,
      clientId: true,
      client: {
        select: {
          vatNumber: true,
          businessName: true
        }
      }
    }
  });

  const normalizedMap = new Map<string, typeof allSPs>();

  for (const sp of allSPs) {
    const normCups = sp.cups.substring(0, 20).toUpperCase();
    const normVat = sp.client.vatNumber.trim().toUpperCase();
    const key = `${normCups}_${normVat}`;

    if (!normalizedMap.has(key)) {
      normalizedMap.set(key, []);
    }
    normalizedMap.get(key)!.push(sp);
  }

  let duplicatesFound = 0;
  for (const [key, sps] of normalizedMap.entries()) {
    if (sps.length > 1) {
      duplicatesFound++;
    }
  }

  console.log(`Total duplicates found: ${duplicatesFound}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
