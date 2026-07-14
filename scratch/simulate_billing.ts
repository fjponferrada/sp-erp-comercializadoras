import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
    const engine = new InternalBillingEngine();
    const cecilioCups = 'ES0031101530517001AK0F';
    const antonioCups = 'ES0031101348132002TP0F';
    const rafaelCups = 'ES0031101515677003MZ0F';
    const fivesenses = 'ES0031101499771003GD0F';
    
    for (const cups of [cecilioCups, antonioCups, rafaelCups, fivesenses]) {
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
            
            let refCosts = [];
            if (contract.productType.includes('fijo') || contract.productType.includes('Fijo')) {
                const refDate = contract.signatureDate || contract.activationDate || invoice.billingStart;
                refCosts = await prisma.regulatedCost.findMany({
                    where: {
                        validFrom: { lte: refDate },
                        validTo: { gte: refDate },
                        tariff: contract.tariff
                    }
                });
            }
            
            const result = engine.calculateInvoice(contract, invoice.billingStart, invoice.billingEnd, consumptions, prices, regCosts, refCosts);
            
            console.log("SIMULATED TOTAL AMOUNT:", result.totalAmount);
            console.log("SIMULATED SUBTOTAL1:", result.subtotal1);
            console.log("SIMULATED POWER:", result.totalPower);
            console.log("SIMULATED ENERGY:", result.totalEnergy);
            console.log("SIMULATED EQUIPOS:", result.totalEquipos);
            console.log("SIMULATED FEE:", result.totalFee);
            console.log("SIMULATED IE:", result.ieAmount);
            console.log("SIMULATED IVA:", result.ivaAmount);
            
            // Compare with DB
            console.log("DB TOTAL AMOUNT:", invoice.totalAmount);
            
            // Print breakdown differences
            console.log(`Delta (DB - Provider/Red): ${invoice.totalAmount} vs Provider (see image)`);
        } catch (err) {
            console.error("Error simulating:", err.message);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
