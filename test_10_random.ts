import { prisma } from './src/lib/prisma';
import { InternalBillingEngine } from './src/lib/services/InternalBillingEngine';

async function main() {
  const f1s = await prisma.f1Invoice.findMany({
    where: { 
      invoices: { some: {} },
      contractId: { not: null }
    },
    take: 10,
    include: {
      contract: true,
      invoices: true
    }
  });

  console.log("=========================================");
  console.log("COMPARATIVA: PROVEEDOR vs ERP (10 FACTURAS)");
  console.log("=========================================\n");

  for (let i = 0; i < f1s.length; i++) {
    const f1 = f1s[i];
    const issued = f1.invoices[0];
    const isFixed = (f1.contract as any)?.pricingModel === 'Precio fijo único' || (f1.contract as any)?.airtableData?.['FIJO / INDEX'] === 'F';
    const typeStr = isFixed ? "FIJO" : "INDEX";

    try {
      const result = await InternalBillingEngine.calculate(f1.id);
      console.log(`[Factura ${i + 1}] ID: ${f1.id} | Tipo: ${typeStr}`);
      console.log(`  PROVEEDOR -> Base: ${issued.baseImponible?.toFixed(2) || 'N/A'} € | Total: ${issued.totalAmount?.toFixed(2) || 'N/A'} €`);
      console.log(`  MOTOR ERP -> Base: ${result.totalBase?.toFixed(2)} € | Total: ${result.totalAmount?.toFixed(2)} €`);
      console.log(`  DIFERENCIA BASE -> ${((result.totalBase || 0) - (issued.baseImponible || 0)).toFixed(2)} €\n`);
    } catch (e: any) {
      console.log(`[Factura ${i + 1}] ID: ${f1.id} | Tipo: ${typeStr}`);
      console.log(`  ERROR calculando motor: ${e.message}\n`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
