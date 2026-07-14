const { prisma } = require('./src/lib/prisma');
const { InternalBillingEngine } = require('./src/lib/services/InternalBillingEngine');

async function main() {
    const cups = 'ES0031101499771003GD0F'; // FIVE SENSES
    
    const f1 = await prisma.f1Invoice.findFirst({
        where: { supplyPoint: { cups } },
        orderBy: { fechaFactura: 'desc' },
        include: { contract: true, supplyPoint: true }
    });
    
    if (!f1) throw new Error("F1 not found");
    
    const result = await InternalBillingEngine.calculate(f1.id, false);
    
    console.log("=== NEW ENGINE CALCULATION ===");
    console.log("Total Base:", result.totalBase);
    console.log("Tax Amount (IVA):", result.taxAmount);
    console.log("Total Amount:", result.totalAmount);
    console.log("IE (taxElectric):", result.taxElectric);
    
    console.log("\nF1 INVOICE (Provider):");
    console.log("Base:", f1.baseImponible);
    console.log("Total:", f1.importeTotalFactura);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
