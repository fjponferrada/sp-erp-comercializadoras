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
  const originalId = 'cmq5112m700001c41rmymbyr7';
  const newId = 'cmq6cjbec0000hc41obzn7ky1';

  // 1. Delete the newly created duplicate
  await prisma.company.delete({ where: { id: newId } });

  // 2. Update the original with the correct data
  const updatedCompany = await prisma.company.update({
    where: { id: originalId },
    data: {
      name: 'AED Energia,SL',
      cif: 'B10915544',
      codigo: 'AED',
      address: 'Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España',
      email: 'fjponferrada@aed-energia.com',
      contactPerson: 'FRANCISCO JAVIER PONFERRADA RODRIGUEZ',
      phone: '900525826',
      codigoRee: '1713',
      codigoAcer: 'Código ACER',
      unidadOfertaOmie: 'AEDEC01',
      remit: 'AED',
      codigoSujetoMercado: '18X000000000OIA',
      ordenCnmc: 'RS-950',
      fechaActivacionCnmc: new Date('2022-10-25T00:00:00Z'),
      fechaBajaCnmc: null,
      representadoPor: 'AED',
      fechaActivacionIsm: new Date('2022-11-01T00:00:00Z'),
      fechaBajaIsm: null,
      residenciaCanarias: false,
      exportableOdoo: false,
      empresaVisible: true,
      emisionFacturasCliente: true,
    }
  });

  console.log('✅ Comercializadora original arreglada y duplicado eliminado:', updatedCompany);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
