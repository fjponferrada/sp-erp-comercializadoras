import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.switchingEvent.findMany({
    where: {
      procesoBase: { in: ['A3', 'M1'] },
      fechaSolicitud: {
        gte: new Date('2026-06-01'),
        lt: new Date('2026-07-01')
      }
    },
    select: {
      procesoBase: true,
      paso: true,
      provincia: true,
      cups: true,
      fechaSolicitud: true,
      estadoAR: true,
      motivosRechazo: true,
      tipoError: true
    }
  });
  console.log(JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
