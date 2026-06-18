import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Iniciando corrección de hasSelfConsumption en la tabla Product...');

  // 1. Poner a false todos
  const resetRes = await prisma.product.updateMany({
    data: { hasSelfConsumption: false }
  });
  console.log(`Reseteados ${resetRes.count} productos a hasSelfConsumption = false.`);

  // 2. Poner a true los que contengan 'solar' en el nombre (case-insensitive)
  const solarRes = await prisma.product.updateMany({
    where: {
      name: {
        contains: 'solar',
        mode: 'insensitive'
      }
    },
    data: { hasSelfConsumption: true }
  });
  console.log(`Actualizados ${solarRes.count} productos solares a hasSelfConsumption = true.`);

  console.log('Corrección finalizada con éxito.');
}

main().catch(console.error).finally(() => process.exit(0));
