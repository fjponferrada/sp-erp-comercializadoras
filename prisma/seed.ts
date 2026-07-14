import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando seed de la base de datos...');

  // 1. Crear Empresa
  const company = await prisma.company.upsert({
    where: { cif: 'B12345678' },
    update: {},
    create: {
      name: 'AED Energía S.L.',
      cif: 'B12345678',
    },
  });

  console.log('Empresa base creada:', company.name);

  // 2. Crear Marca (SP Energía)
  const brand = await prisma.brand.upsert({
    where: { slug: 'sp-energia' },
    update: {},
    create: {
      name: 'SP Energía',
      slug: 'sp-energia',
      companyId: company.id,
      accentColor: '#DEFF9A',
      bgColor: '#0B0F19',
      surfaceColor: '#111827',
      borderColor: '#1E2A3A',
    },
  });

  console.log('Marca por defecto creada:', brand.name);

  // 3. Crear Usuario SuperAdmin
  const hashedPassword = await bcrypt.hash('SpEnergia2026!', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'fjponferrada@sp-energia.com' },
    update: {},
    create: {
      name: 'Francisco Ponferrada',
      email: 'fjponferrada@sp-energia.com',
      password: hashedPassword,
      role: 'SUPERADMIN',
      brandId: brand.id,
    },
  });

  console.log('Usuario administrador creado:');
  console.log('- Email: fjponferrada@sp-energia.com');
  console.log('- Password: SpEnergia2026!');
  console.log('Seed completado satisfactoriamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
