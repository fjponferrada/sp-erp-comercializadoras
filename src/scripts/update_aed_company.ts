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
  const companyData = {
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
    fechaActivacionIsm: new Date('2022-11-01T00:00:00Z'), // "fecha alta ism / fecha alta sp"
    fechaBajaIsm: null,
    residenciaCanarias: false,
    exportableOdoo: false,
    empresaVisible: true,
    emisionFacturasCliente: true,
  };

  const company = await prisma.company.upsert({
    where: { codigo: 'AED' },
    update: companyData,
    create: companyData,
  });

  console.log('✅ Comercializadora AED actualizada con éxito:');
  console.log(company);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
