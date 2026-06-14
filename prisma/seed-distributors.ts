import { prisma } from '../src/lib/prisma';

const distributors = [
  { reeCode: '0031', name: 'e-distribución' },
  { reeCode: '0021', name: 'i-DE' },
  { reeCode: '0022', name: 'UFD' },
  { reeCode: '0345', name: 'Viesgo / E-Redes' },
  { reeCode: '0026', name: 'E-Redes' },
  { reeCode: '0027', name: 'Viesgo' },
  { reeCode: '0130', name: 'Estabanell y Pahisa' },
  { reeCode: '0147', name: 'Electra Caldense' }
];

async function main() {
  console.log(`Start seeding distributors...`);
  for (const d of distributors) {
    const dist = await prisma.distributor.upsert({
      where: { reeCode: d.reeCode },
      update: {},
      create: {
        reeCode: d.reeCode,
        name: d.name,
      },
    });
    console.log(`Created/updated distributor with REE code: ${dist.reeCode}`);
  }
  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
