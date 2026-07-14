import { prisma } from '../src/lib/prisma';

async function main() {
  const ppas = await prisma.ppa.findMany();
  console.log('PPAs:', ppas.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    subtype: p.subtype,
    priceType: p.priceType,
    priceValue: p.priceValue,
    hasProfile: !!p.profileData
  })));
  
  const omie = await prisma.systemComponentPrice.findFirst({
    where: { component: 'OMIE' },
    orderBy: { date: 'asc' }
  });
  console.log('First OMIE date:', omie?.date);
  
  const omieLast = await prisma.systemComponentPrice.findFirst({
    where: { component: 'OMIE' },
    orderBy: { date: 'desc' }
  });
  console.log('Last OMIE date:', omieLast?.date);
}

main().finally(() => prisma.$disconnect());
