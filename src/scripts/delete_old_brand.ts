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
    console.log(`Transferring data from ${brandCompleta.id} to ${brandVacia.id}`);

    // Update new brand with old brand's data
    await prisma.brand.update({
      where: { id: brandVacia.id },
      data: {
        codigoMarca: brandCompleta.codigoMarca,
        address: brandCompleta.address,
        email: brandCompleta.email,
        contactPerson: brandCompleta.contactPerson,
        phone: brandCompleta.phone,
        clave: brandCompleta.clave,
        enviosPorHora: brandCompleta.enviosPorHora,
        facturaElectrica: brandCompleta.facturaElectrica,
        mensaje: brandCompleta.mensaje,
        textoPromocional: brandCompleta.textoPromocional,
        manual: brandCompleta.manual,
      }
    });

    // Delete old brand
    try {
      await prisma.brand.delete({
        where: { id: brandCompleta.id }
      });
      console.log("Old brand deleted successfully.");
    } catch (e: any) {
      console.log("Could not delete old brand:", e.message);
    }

  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
