import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './src/lib/prisma';

async function main() {
  const baseCups = 'ES0031101445366001GN0F'.substring(0, 20);
  console.log(`Buscando CUPS que empiecen por: ${baseCups}`);
  const sps = await prisma.supplyPoint.findMany({
    where: { cups: { startsWith: baseCups } },
    include: { contracts: true }
  });
  
  if (sps.length === 0) {
    console.log("No se encontraron Supply Points.");
    return;
  }
  
  for (const sp of sps) {
    console.log(`SupplyPoint ID: ${sp.id}, CUPS: ${sp.cups}`);
    for (const c of sp.contracts) {
      console.log(`  Contract ID: ${c.id}, Status: '${c.status}', Code: ${c.contractCode}`);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
