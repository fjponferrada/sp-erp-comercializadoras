import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Finding AED...');
  const aed = await prisma.company.findFirst({
    where: { name: { contains: 'AED', mode: 'insensitive' } }
  });
  
  if (!aed) {
    console.log('Company AED not found');
    return;
  }
  
  console.log(`Found AED: ${aed.name} (${aed.id})`);
  
  // En lugar de hacer updateMany (que da error si ya existe uno nuevo con companyId), 
  // vamos a borrar los nulls porque ya son redundantes si fallaron por constraint única.
  // O podemos iterar y si falla, borramos el null.
  
  const nullRecords = await prisma.reganecuData.findMany({
    where: { companyId: null },
    select: { id: true, date: true, cierre: true }
  });
  
  console.log(`Found ${nullRecords.length} records with null companyId.`);
  
  let updated = 0;
  let deleted = 0;
  
  for (const record of nullRecords) {
    try {
      await prisma.reganecuData.update({
        where: { id: record.id },
        data: { companyId: aed.id }
      });
      updated++;
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Unique constraint failed, means AED already has this combination
        await prisma.reganecuData.delete({ where: { id: record.id } });
        deleted++;
      } else {
        console.error('Error updating record', record.id, err);
      }
    }
  }
  
  console.log(`Finished: Updated ${updated}, Deleted ${deleted} redundant null records.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
