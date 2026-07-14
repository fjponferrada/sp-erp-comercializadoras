import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
    const cups = 'ES0031101499771003GD0F'; // FIVE SENSES
    
    const f1 = await prisma.f1Invoice.findFirst({
        where: { supplyPoint: { cups } },
        orderBy: { fechaEmision: 'desc' },
        include: { supplyPoint: { include: { contract: true } }, invoices: true }
    });
    
    if (!f1 || !f1.supplyPoint?.contract || !f1.invoices[0]) {
        console.log("No data found for", cups);
        return;
    }
    
    const f1Data = f1.invoices[0].jsonData;
    const contract = f1.supplyPoint.contract;
    
    const result = InternalBillingEngine.calculate({
        f1Data: f1Data as any,
        cchData: null,
        contract: contract as any,
        prices: { /* Add prices if needed or it will fetch them */ }
    });
    
    console.log("powerDetails:", result.powerDetails);
    console.log("energyAtrDetails:", result.energyAtrDetails);
    console.log("energyMarketDetails:", result.energyMarketDetails);
}
main().catch(console.error).finally(() => prisma.$disconnect());
