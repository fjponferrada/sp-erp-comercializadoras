import { prisma } from '../src/lib/prisma';

async function test() {
  try {
    const ppaId = 'cmqt8mxvk0001rg417v30g8cy'; // Renee RJE
    const ppa = await prisma.ppa.findUnique({
      where: { id: ppaId }
    });
    console.log("PPA found:", ppa?.name);
  } catch (e: any) {
    console.error("ERROR:");
    console.error(e.message);
  } finally {
    await prisma.$disconnect();
  }
}
test();
