import "dotenv/config";
import { prisma } from './src/lib/prisma';

async function main() {
  const event = await prisma.switchingEvent.findFirst({
    where: {
      procesoBase: 'E2',
      paso: '14'
    }
  });
  if (event) {
    await prisma.switchingEvent.update({
      where: { id: event.id },
      data: { observaciones: '02' }
    });
    console.log('Event updated');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
