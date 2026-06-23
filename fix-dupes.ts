import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Starting cleanup...");
  
  // 1. Deduplicate SupplyPoints
  const clientsWithSps = await prisma.client.findMany({
    include: { supplyPoints: { include: { contracts: true } } }
  });

  let dupesFixed = 0;
  for (const client of clientsWithSps) {
    if (client.supplyPoints.length < 2) continue;
    
    const groups = new Map();
    for (const sp of client.supplyPoints) {
      if (!sp.cups || sp.cups.length < 20) continue;
      const cups20 = sp.cups.substring(0, 20);
      if (!groups.has(cups20)) groups.set(cups20, []);
      groups.get(cups20).push(sp);
    }

    for (const [cups20, sps] of groups.entries()) {
      if (sps.length > 1) {
        // Find the best SP (prefer length 22, or the one with most contracts)
        sps.sort((a, b) => b.cups.length - a.cups.length);
        const bestSp = sps[0];
        
        for (let i = 1; i < sps.length; i++) {
          const badSp = sps[i];
          // Move contracts
          await prisma.contract.updateMany({
            where: { supplyPointId: badSp.id },
            data: { supplyPointId: bestSp.id }
          });
          // Delete bad SP
          await prisma.supplyPoint.delete({ where: { id: badSp.id } });
          dupesFixed++;
        }
      }
    }
  }

  // 2. Fix Client Names
  const allClients = await prisma.client.findMany();
  let namesFixed = 0;
  for (const c of allClients) {
    if (c.clientType === 'Empresa' || c.clientType === 'J') continue;
    
    if (c.firstName) {
      const bNameUpper = c.businessName.toUpperCase();
      const fNameUpper = c.firstName.toUpperCase();
      
      if (!bNameUpper.includes(fNameUpper)) {
        const newName = `${c.businessName} ${c.firstName} ${c.lastName || ''}`.trim();
        await prisma.client.update({
          where: { id: c.id },
          data: { businessName: newName }
        });
        namesFixed++;
      }
    } else {
        // Let's try to get it from contracts if they have airtableData
        const contracts = await prisma.contract.findMany({ where: { clientId: c.id } });
        for (const ct of contracts) {
            if (ct.airtableData) {
                const f = ct.airtableData as any;
                const full = f['NOMBRE Y APELLIDOS'] || f['Nombre completo Titular'];
                if (full && full.toUpperCase().length > c.businessName.length) {
                    await prisma.client.update({
                        where: { id: c.id },
                        data: { businessName: full.trim() }
                    });
                    namesFixed++;
                    break;
                }
            }
        }
    }
  }

  console.log(`Cleanup finished. Dupes Fixed: ${dupesFixed}, Names Fixed: ${namesFixed}`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
