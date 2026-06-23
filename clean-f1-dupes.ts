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
  console.log('Fetching F1 invoices to find duplicates...');
  
  // Find duplicate numeroFacturas
  const duplicates = await prisma.f1Invoice.groupBy({
    by: ['numeroFactura'],
    having: {
      numeroFactura: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  console.log(`Found ${duplicates.length} numeroFacturas with duplicates.`);
  
  let totalDeleted = 0;

  for (const dup of duplicates) {
    if (!dup.numeroFactura) continue;

    // Fetch all F1s for this numeroFactura, including their linked invoices
    const f1s = await prisma.f1Invoice.findMany({
      where: { numeroFactura: dup.numeroFactura },
      include: { _count: { select: { invoices: true } } },
      orderBy: { createdAt: 'asc' } // Oldest first
    });

    const linkedF1s = f1s.filter(f => f._count.invoices > 0);
    const unlinkedF1s = f1s.filter(f => f._count.invoices === 0);

    let toDeleteIds: string[] = [];

    if (linkedF1s.length > 0) {
      // If there's at least one linked F1, we can safely delete ALL unlinked F1s
      toDeleteIds = unlinkedF1s.map(f => f.id);
    } else {
      // If NONE are linked, we keep exactly one (the oldest) and delete the rest
      unlinkedF1s.shift(); // Remove the first one from the array to keep it
      toDeleteIds = unlinkedF1s.map(f => f.id);
    }

    if (toDeleteIds.length > 0) {
      const res = await prisma.f1Invoice.deleteMany({
        where: { id: { in: toDeleteIds } }
      });
      totalDeleted += res.count;
    }
  }

  console.log(`Done! Deleted a total of ${totalDeleted} duplicate F1 invoices safely.`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
