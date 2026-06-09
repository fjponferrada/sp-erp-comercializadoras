const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { cif: 'B10915544' },
    update: {
      name: 'AED Energia, SL',
      address: 'Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España',
      email: 'fjponferrada@aed-energia.com',
      contactPerson: 'FRANCISCO JAVIER PONFERRADA RODRIGUEZ',
      phone: '900525826',
      ordenCnmc: 'RS-950',
      fechaActivacionCnmc: new Date('2022-10-25T00:00:00.000Z'),
      fechaActivacionIsm: new Date('2022-11-01T00:00:00.000Z'),
      representadoPor: 'AED'
    },
    create: {
      cif: 'B10915544',
      name: 'AED Energia, SL',
      address: 'Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España',
      email: 'fjponferrada@aed-energia.com',
      contactPerson: 'FRANCISCO JAVIER PONFERRADA RODRIGUEZ',
      phone: '900525826',
      ordenCnmc: 'RS-950',
      fechaActivacionCnmc: new Date('2022-10-25T00:00:00.000Z'),
      fechaActivacionIsm: new Date('2022-11-01T00:00:00.000Z'),
      representadoPor: 'AED'
    }
  });

  // Also update Brand if it exists, to match the info
  const brand = await prisma.brand.findFirst({
    where: { name: { contains: 'AED' } }
  });

  if (brand) {
    await prisma.brand.update({
      where: { id: brand.id },
      data: {
        address: 'Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España',
        email: 'fjponferrada@aed-energia.com',
        contactPerson: 'FRANCISCO JAVIER PONFERRADA RODRIGUEZ',
        phone: '900525826',
      }
    });
    console.log('Brand AED updated.');
  }

  console.log('Company AED updated:', company);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
