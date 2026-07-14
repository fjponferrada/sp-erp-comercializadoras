const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pc = await prisma.regulatedCost.findFirst({ where: { concept: { in: ['PC', 'CAPACIDAD'] } } });
  const rom = await prisma.regulatedCost.findFirst({ where: { concept: 'ROM' } });
  const ros = await prisma.regulatedCost.findFirst({ where: { concept: 'ROS' } });
  const fnee = await prisma.regulatedCost.findFirst({ where: { concept: 'FNEE' } });
  const peaje = await prisma.regulatedCost.findFirst({ where: { concept: { in: ['PEAJES', 'PEAJES_ENERGIA'] } } });
  
  console.log("PC:", pc);
  console.log("ROM:", rom);
  console.log("ROS:", ros);
  console.log("FNEE:", fnee);
  console.log("PEAJE:", peaje);
}
main().catch(console.error).finally(() => prisma.$disconnect());
