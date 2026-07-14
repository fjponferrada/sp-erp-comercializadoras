import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting invoice client fix by Contract...");
    const invoices = await prisma.invoice.findMany({
        select: {
            id: true,
            invoiceNumber: true,
            clientId: true,
            supplyPointId: true,
            contract: { select: { clientId: true } }
        }
    });

    let fixedCount = 0;
    for (const inv of invoices) {
        if (inv.contract && inv.contract.clientId && inv.clientId !== inv.contract.clientId) {
            await prisma.invoice.update({
                where: { id: inv.id },
                data: { clientId: inv.contract.clientId }
            });
            fixedCount++;
            console.log(`Re-linked invoice ${inv.invoiceNumber} to client ${inv.contract.clientId}`);
        } else if (!inv.contract && inv.supplyPointId) {
            // Fallback to SupplyPoint's client
            const sp = await prisma.supplyPoint.findUnique({ where: { id: inv.supplyPointId }});
            if (sp && sp.clientId && inv.clientId !== sp.clientId) {
                await prisma.invoice.update({
                    where: { id: inv.id },
                    data: { clientId: sp.clientId }
                });
                fixedCount++;
                console.log(`Re-linked invoice ${inv.invoiceNumber} to client ${sp.clientId} via SP`);
            }
        }
    }
    console.log(`Fixed ${fixedCount} invoices.`);
}

main().finally(() => prisma.$disconnect());
