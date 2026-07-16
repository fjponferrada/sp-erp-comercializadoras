const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const events = await prisma.switchingEvent.findMany({
    where: {
      procesoBase: 'C4',
      provincia: '28000'
    }
  });
  console.log('Events in 28000:', events.map(e => ({ fecha: e.fechaSolicitud, paso: e.paso, grupo: e.groupId, error: e.tipoError })));
}

check().catch(console.error).finally(() => prisma.$disconnect());
