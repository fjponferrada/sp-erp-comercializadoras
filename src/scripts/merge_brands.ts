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
  const brands = await prisma.brand.findMany();
  
  const brandCompleta = brands.find(b => b.name === 'AED Energia, SL');
  const brandVacia = brands.find(b => b.name === 'AED Energía');
  
  if (brandCompleta && brandVacia) {
    console.log(`Merging ${brandVacia.id} into ${brandCompleta.id}`);

    // Update Users
    await prisma.user.updateMany({
      where: { brandId: brandVacia.id },
      data: { brandId: brandCompleta.id }
    });

    // Update Clients
    await prisma.client.updateMany({
      where: { brandId: brandVacia.id },
      data: { brandId: brandCompleta.id }
    });

    // We can't easily update many-to-many assignedBrands without raw queries or loop, so just disconnect the old and connect the new for all users.
    const usersWithVacia = await prisma.user.findMany({
      where: { assignedBrands: { some: { id: brandVacia.id } } }
    });
    for (const u of usersWithVacia) {
      await prisma.user.update({
        where: { id: u.id },
        data: {
          assignedBrands: {
            disconnect: { id: brandVacia.id },
            connect: { id: brandCompleta.id }
          }
        }
      });
    }

    // Now delete the empty brand
    await prisma.brand.delete({
      where: { id: brandVacia.id }
    });

    console.log("Brands merged successfully!");
  } else {
    console.log("Could not find both brands to merge.");
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
