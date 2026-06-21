import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const brands = await prisma.brand.findMany();
  if (brands.length === 0) {
    console.error('No brands found');
    return;
  }

  await prisma.additionalService.deleteMany();

  for (const brand of brands) {
    const services = [
      {
        name: 'Asesoramiento energético (5,99 €/mes)',
        monthlyPrice: 5.99,
        dailyPrice: 0.197,
        isActive: true,
        brandId: brand.id
      },
      {
        name: 'Factura en papel (3,50 €/mes)',
        monthlyPrice: 3.50,
        dailyPrice: 0.115,
        isActive: true,
        brandId: brand.id
      },
      {
        name: 'Alta Nueva (25 €/alta)',
        monthlyPrice: 25.00,
        dailyPrice: 0.822,
        isActive: true,
        brandId: brand.id
      }
    ];

    for (const svc of services) {
      await prisma.additionalService.create({
        data: svc
      });
      console.log(`Created service: ${svc.name} for brand ${brand.id}`);
    }
  }

  console.log('Seed completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
