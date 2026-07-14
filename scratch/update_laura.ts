import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
    const invoices = await prisma.f1Invoice.findMany({
        where: { id: 'cmrahmwmr006604k23i2dawyd' } // Laura Alos
    });
    for (const f of invoices) {
        try {
            const data = await InternalBillingEngine.calculate(f.id, true); // forceRepair
            await prisma.f1Invoice.update({
                where: { id: f.id },
                data: {
                    totalCchMWh: data.totalCchMWh,
                    energyCost: data.energyCost,
                    feeCost: data.feeCost,
                    capacityCost: data.capacityCost,
                    fneeCost: data.fneeCost,
                    powerCost: data.powerCost,
                    alquilerEquipo: data.alquilerEquipo,
                    bonoSocial: data.bonoSocial,
                    taxElectric: data.taxElectric,
                    taxAmount: data.taxAmount,
                    totalBase: data.totalBase,
                    totalAmount: data.totalAmount,
                    hasMismatch: data.hasMismatch,
                    mismatchReason: data.mismatchReason,
                    excesosPotencia: data.excesosPotencia,
                    excedentesKwh: data.excedentesKwh,
                    excedentesAutoconsumo: data.excedentesAutoconsumo,
                    pexc: data.pexc,
                    repairData: data.repairData as any,
                }
            });
            console.log("Updated", f.id, "excedentes:", data.pexc);
        } catch(e) {
            console.error(e);
        }
    }
}
main().finally(() => prisma.$disconnect());
