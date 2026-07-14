import { PrismaClient } from '@prisma/client';
import { InternalBillingEngine } from '../lib/services/InternalBillingEngine';
const prisma = new PrismaClient();

async function run() {
    const f1 = await prisma.f1Invoice.findFirst({
        where: { supplyPoint: { cups: { contains: 'ES0031104899528001TR' } }, numeroFactura: { not: 'SIN_COD' } },
        orderBy: { fechaEmision: 'desc' }
    });
    if (!f1) { console.log('not found'); return; }
    const result = await InternalBillingEngine.calculate(f1.id);
    const c = await prisma.contract.findUnique({ where: { id: f1.contractId || '' }, include: { product: true } });
    const firstHours = result.hourlyDetails.slice(0, 4);
    console.log(JSON.stringify({ firstHours, totalEnergyCost: result.energyCost }, null, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
