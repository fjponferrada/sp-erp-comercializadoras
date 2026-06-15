const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const events = await prisma.switchingEvent.findMany();
  console.log("EVENTS LENGTH:", events.length);
  if (events.length > 0) {
    console.log("FIRST EVENT PROCESO BASE:", events[0].procesoBase);
  }
}
main();
