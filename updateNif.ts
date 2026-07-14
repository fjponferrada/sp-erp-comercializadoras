import { prisma } from './src/lib/prisma';

async function main() {
  const newName = 'Eranovum';
  
  const leads = await prisma.lead.findMany({
    where: {
      businessName: newName
    }
  });
  
  for (const lead of leads) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        vatNumber: 'PENDIENTE CIF'
      }
    });
  }

  const clients = await prisma.client.findMany({
    where: {
      businessName: newName
    }
  });

  for (const client of clients) {
    await prisma.client.update({
      where: { id: client.id },
      data: {
        vatNumber: 'PENDIENTE CIF'
      }
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
