import { prisma } from './src/lib/prisma';

async function main() {
    console.log("Fetching all invoices with client.brand.companyId...");
    const invoices = await prisma.invoice.findMany({
        include: {
            client: {
                include: {
                    brand: true
                }
            }
        }
    });

    console.log(`Found ${invoices.length} invoices. Scanning for duplicates...`);

    const seen = new Set();
    let deletedCount = 0;
    
    for (const inv of invoices) {
        if (!inv.client || !inv.client.brand) {
            console.log(`Invoice ${inv.invoiceNumber} has no valid client/brand. Skipping.`);
            continue;
        }
        
        const compId = inv.client.brand.companyId;
        const key = `${inv.invoiceNumber}_${compId}`;
        
        if (seen.has(key)) {
            console.log(`Deleting duplicate: ${key} (Invoice ID: ${inv.id})`);
            await prisma.invoice.delete({ where: { id: inv.id } });
            deletedCount++;
        } else {
            seen.add(key);
        }
    }

    console.log(`Deleted ${deletedCount} duplicate invoices.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
