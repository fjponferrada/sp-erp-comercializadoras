const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const events = await prisma.switchingEvent.findMany({
    where: {
      procesoBase: { in: ['C1', 'C2', 'A3', 'M1'] },
      fechaSolicitud: {
        gte: new Date('2026-05-01'),
        lt: new Date('2026-07-01')
      }
    },
    select: {
      id: true,
      procesoBase: true,
      paso: true,
      provincia: true,
      cups: true,
      fechaSolicitud: true,
      estadoAR: true,
      motivosRechazo: true
    }
  });
  
  const m = events.filter(e => e.provincia === '28000' || e.cups?.includes('ES0031408606') || e.estadoAR === 'RECHAZADO');
  console.log('Filtered events:', m);
}

check().catch(console.error).finally(() => prisma.$disconnect());
