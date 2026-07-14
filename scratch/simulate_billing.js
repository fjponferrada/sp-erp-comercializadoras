const { PrismaClient } = require('@prisma/client');
const { InternalBillingEngine } = require('./src/lib/services/InternalBillingEngine');
const prisma = new PrismaClient();

async function main() {
    const engine = new InternalBillingEngine();
    const cecilioCups = 'ES0031101530517001AK0F';
    const antonioCups = 'ES0031101348132002TP0F';
    
    for (const cups of [cecilioCups, antonioCups]) {
        console.log(`\n=== SIMULATING BILLING FOR ${cups} ===`);
        const contract = await prisma.contract.findFirst({
            where: { supplyPoint: { cups } },
            include: { client: true, supplyPoint: true }
        });
        
        if (!contract) {
            console.log("Contract not found!");
            continue;
        }
        
        const invoice = await prisma.invoice.findFirst({
            where: { contractId: contract.id },
            orderBy: { billingStart: 'desc' },
            take: 1
        });
        
        if (!invoice) {
            console.log("Invoice not found!");
            continue;
        }
        
        const consumptions = await prisma.hourlyConsumption.findMany({
            where: {
                cups,
                date: {
                    gte: invoice.billingStart,
                    lte: invoice.billingEnd
                }
            }
        });
        
        console.log(`Found ${consumptions.length} consumptions.`);
        try {
            // We need to fetch market prices for index
            const prices = await prisma.marketPrice.findMany({
                where: {
                    date: {
                        gte: invoice.billingStart,
                        lte: invoice.billingEnd
                    }
                }
            });
            console.log(`Found ${prices.length} market prices.`);
            
            const regCosts = await prisma.regulatedCost.findMany({
                where: {
                    validFrom: { lte: invoice.billingEnd },
                    validTo: { gte: invoice.billingStart },
                    tariff: contract.tariff
                }
            });
            
            // Re-run the engine
            const result = engine.calculateInvoice(contract, invoice.billingStart, invoice.billingEnd, consumptions, prices, regCosts, regCosts);
            
            console.log("SIMULATED TOTAL AMOUNT:", result.totalAmount);
            console.log("SIMULATED SUBTOTAL1:", result.subtotal1);
            console.log("SIMULATED POWER:", result.totalPower);
            console.log("SIMULATED ENERGY:", result.totalEnergy);
            console.log("SIMULATED EQUIPOS:", result.totalEquipos);
            console.log("SIMULATED FEE:", result.totalFee);
            console.log("SIMULATED IE:", result.ieAmount);
            
            // Compare with DB
            console.log("DB TOTAL AMOUNT:", invoice.totalAmount);
        } catch (err) {
            console.error("Error simulating:", err.message);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
