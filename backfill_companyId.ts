import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Fetching all invoices...");
    const invoices = await prisma.invoice.findMany({
        where: { companyId: null },
        include: {
            client: {
                include: {
                    brand: true
                }
            }
        }
    });

    console.log(`Found ${invoices.length} invoices missing companyId. Updating...`);

    let count = 0;
    for (const inv of invoices) {
        if (!inv.client || !inv.client.brand) continue;
        
        const compId = inv.client.brand.companyId;
        await prisma.invoice.update({
            where: { id: inv.id },
            data: { companyId: compId }
        });
        count++;
        if (count % 100 === 0) console.log(`Updated ${count}/${invoices.length}`);
    }

    console.log(`Successfully backfilled companyId for ${count} invoices.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
