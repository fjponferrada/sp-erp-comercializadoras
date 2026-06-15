import { prisma } from './src/lib/prisma';
async function main() {
  const events = await prisma.switchingEvent.findMany();
  console.log("EVENTS LENGTH:", events.length);
  if (events.length > 0) {
    console.log("FIRST EVENT PROCESO BASE:", events[0].procesoBase);
    console.log("PROCESOS BASES UNICOS:", [...new Set(events.map(e => e.procesoBase))]);
  }
}
main();
