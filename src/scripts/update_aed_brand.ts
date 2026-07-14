import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const brandId = 'cmq5112np00011c41seybc53y';

  const updatedBrand = await prisma.brand.update({
    where: { id: brandId },
    data: {
      codigoMarca: 'AED',
      name: 'AED Energía',
      address: 'Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España',
      email: 'clientes@aed-energia.com',
      contactPerson: 'Fco Javier Ponferrada',
      phone: '900525826',
      enviosPorHora: 14,
      penalizacion: 1000,
      clave: 'gR<s{4[H2',
      facturaElectrica: 'SI',
      mensaje: 'Tu factura ha llegado. AED Energía.',
      textoPromocional: 'Conoce nuestras nuevas ofertas.',
      manual: 'https://dl.airtable.com/...',
      marcaVisible: true,
      gestionTickets: true,
      envioPromocion: true,
      envioCliente: true,
      envioCorreo: true,
    }
  });

  console.log('✅ Marca AED actualizada con éxito:');
  console.log(updatedBrand);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
