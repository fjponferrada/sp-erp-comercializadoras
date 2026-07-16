const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.$queryRaw`SELECT id, "procesoBase", "paso", "estadoAR", "fechaSolicitud", "motivosRechazo" FROM "SwitchingEvent" WHERE "procesoBase" = 'A3' AND "estadoAR" LIKE '%RECHAZA%' LIMIT 5`;
  console.log(JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
