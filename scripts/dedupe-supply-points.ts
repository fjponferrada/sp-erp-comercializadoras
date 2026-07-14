import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando consolidación de SupplyPoints duplicados...');
  try {
    const duplicates: { cups: string, count: bigint }[] = await prisma.$queryRaw`
      SELECT cups, COUNT(*) as count
      FROM "SupplyPoint"
      GROUP BY cups
      HAVING COUNT(*) > 1
    `;
    
    console.log(`Encontrados ${duplicates.length} CUPS con múltiples SupplyPoints.`);
    let dedupedCupsCount = 0;
    
    for (const dup of duplicates) {
      if (!dup.cups) continue;
      
      const sps = await prisma.supplyPoint.findMany({
        where: { cups: dup.cups },
        include: { contracts: true }
      });
      
      if (sps.length <= 1) continue;
      
      // Sort to find the primary: prefer those with an ACTIVO or FINALIZADO contract
      const spsScored = sps.map(sp => {
        let score = 0;
        for (const c of sp.contracts) {
          if (c.status === 'ACTIVO') score += 100;
          if (c.status === 'FINALIZADO' || c.status === 'Finalizado') score += 50;
        }
        return { sp, score };
      });
      
      spsScored.sort((a, b) => b.score - a.score);
      const primarySp = spsScored[0].sp;
      const secondarySps = spsScored.slice(1).map(s => s.sp);
      
      for (const secSp of secondarySps) {
        // Re-link contracts
        if (secSp.contracts.length > 0) {
          await prisma.contract.updateMany({
            where: { supplyPointId: secSp.id },
            data: { supplyPointId: primarySp.id }
          });
        }
        // Delete the secondary SP
        await prisma.supplyPoint.delete({
          where: { id: secSp.id }
        });
      }
      
      dedupedCupsCount++;
      if (dedupedCupsCount % 20 === 0) {
        console.log(`Progreso: ${dedupedCupsCount}/${duplicates.length} CUPS consolidados...`);
      }
    }
    
    console.log(`¡Proceso completado! Se han consolidado ${dedupedCupsCount} CUPS.`);
    
  } catch (error) {
    console.error('Error durante la consolidación:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
