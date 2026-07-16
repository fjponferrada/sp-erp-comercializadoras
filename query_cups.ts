import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.switchingEvent.findMany({
    where: {
      cups: {
        in: [
          'ES0031408606998002PH',
          'ES0031105657639001RC',
          'ES0031408738923001TF'
        ]
      }
    },
    select: {
      cups: true,
      procesoBase: true,
      paso: true,
      fechaSolicitud: true,
      estadoAR: true,
      motivosRechazo: true,
      tipoError: true
    }
  });
  console.log(JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
