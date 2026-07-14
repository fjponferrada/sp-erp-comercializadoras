const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cupsList = [
        'ES0031101530517001AK0F', // CECILIO
        'ES0031101348132002TP0F'  // ANTONIO
    ];
    
    for (const cups of cupsList) {
        const invoices = await prisma.invoice.findMany({
            where: { supplyPoint: { cups } },
            orderBy: { billingStart: 'desc' },
            take: 1,
            include: {
                contract: {
                    include: { client: true }
                }
            }
        });
        
        console.log("---- CUPS:", cups, "----");
        for (const row of invoices) {
            console.log(row.contract.client.name, " | ", row.billingStart.toISOString().split('T')[0], " to ", row.billingEnd.toISOString().split('T')[0]);
            console.log("Total Amount:", row.totalAmount);
            console.log("Tariff:", row.contract.tariff, " Product:", row.contract.productType);
            
            const data = row.invoiceData || {};
            console.log("hasMismatch:", data.hasMismatch, " | Reason:", data.mismatchReason);
            console.log("Terms:");
            console.log("  Power term:", data.totalPower);
            console.log("  Energy term:", data.totalEnergy);
            console.log("  BOE Power:", data.boePowerCost);
            console.log("  BOE Energy:", data.boeEnergyCost);
            console.log("  Fee term:", data.totalFee);
            console.log("  Equipos:", data.totalEquipos);
            console.log("  IE:", data.ieAmount);
            console.log("  IVA:", data.ivaAmount);
            console.log("  Descuento:", data.totalDiscount);
            console.log("------------------------");
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
