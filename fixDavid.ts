import { prisma } from './src/lib/prisma';

async function main() {
  const nameToFind = 'David';
  const newName = 'Eranovum';
  
  const leads = await prisma.lead.findMany({
    where: {
      businessName: {
        contains: nameToFind,
        mode: 'insensitive'
      }
    }
  });
  
  for (const lead of leads) {
    if (lead.businessName?.toLowerCase().includes('vallesp')) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          businessName: newName,
          firstName: 'David',
          lastName: 'Vallespín Fontcuberta'
        }
      });
      console.log('Updated lead:', lead.id);
    }
  }

  const clients = await prisma.client.findMany({
    where: {
      businessName: {
        contains: nameToFind,
        mode: 'insensitive'
      }
    }
  });

  for (const client of clients) {
    if (client.businessName.toLowerCase().includes('vallesp')) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          businessName: newName,
        }
      });
      console.log('Updated client:', client.id);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
