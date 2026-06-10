import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:SpEnergia2026%21@localhost:5432/sperp_local';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.time('Fetch all matching');
  const allMatching = await prisma.contract.findMany({
    select: { id: true, contractCode: true, status: true, supplyPointId: true, activationDate: true, terminationDate: true },
  });
  console.timeEnd('Fetch all matching');

  const bajaContracts = allMatching.filter(c => c.status === 'BAJA' && c.supplyPointId);
  const bajaSupplyPointIds = [...new Set(bajaContracts.map(c => c.supplyPointId!))];
  
  console.log(`Total BAJA contracts: ${bajaContracts.length}`);
  console.log(`Unique SupplyPoints for BAJAS: ${bajaSupplyPointIds.length}`);

  console.time('Fetch sibling contracts');
  const siblingContracts = await prisma.contract.findMany({
    where: { supplyPointId: { in: bajaSupplyPointIds } },
    select: { id: true, supplyPointId: true, activationDate: true, terminationDate: true, status: true }
  });
  console.timeEnd('Fetch sibling contracts');

  const contractsByCups: Record<string, typeof siblingContracts> = {};
  for (const c of siblingContracts) {
    if (!contractsByCups[c.supplyPointId!]) contractsByCups[c.supplyPointId!] = [];
    contractsByCups[c.supplyPointId!].push(c);
  }

  const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;
  let falseBajasCount = 0;

  for (const baja of bajaContracts) {
    const siblings = contractsByCups[baja.supplyPointId!] || [];
    let isFalseBaja = false;

    if (baja.terminationDate) {
      for (const sibling of siblings) {
        if (sibling.id === baja.id) continue;
        if (!sibling.activationDate) continue;

        // Si el hermano se activó después (o el mismo día) que este se activó
        // Y su fecha de activación no supera la fecha de baja + 30 días
        const bajaTermTime = baja.terminationDate.getTime();
        const siblingActTime = sibling.activationDate.getTime();
        const bajaActTime = baja.activationDate ? baja.activationDate.getTime() : 0;

        if (siblingActTime >= bajaActTime && siblingActTime <= bajaTermTime + GRACE_PERIOD_MS) {
          isFalseBaja = true;
          break;
        }
      }
    }

    if (isFalseBaja) {
      falseBajasCount++;
    }
  }

  console.log(`False Bajas count: ${falseBajasCount}`);
  console.log(`True Bajas count: ${bajaContracts.length - falseBajasCount}`);
}

run().finally(() => prisma.$disconnect());
