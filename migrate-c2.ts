import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Actualizando todos los registros existentes a la versión 'C2'...");
  
  const result = await prisma.systemComponentPrice.updateMany({
    where: {
      version: null
    },
    data: {
      version: 'C2'
    }
  });

  console.log(`Operación completada. Se han actualizado ${result.count} registros a la versión C2.`);
}

main()
  .catch(e => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
