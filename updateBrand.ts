import { prisma } from './src/lib/prisma';

async function main() {
  const brand = await prisma.brand.findFirst({
    where: { name: { contains: 'AED' } }
  });

  if (brand) {
    const updated = await prisma.brand.update({
      where: { id: brand.id },
      data: {
        codigoMarca: 'AED',
        address: 'Calle del Brezo, 6, 14012 (Córdoba)',
        email: 'clientes@aed-energia.com',
        contactPerson: 'Fco Javier Ponferrada',
        phone: '900525826',
      }
    });
    console.log('Brand AED updated successfully:', updated);
  } else {
    console.log('Brand AED not found!');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
