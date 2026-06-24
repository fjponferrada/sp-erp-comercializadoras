import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const f1 = await prisma.f1Invoice.findMany({
    where: { 
      supplyPoint: { cups: { startsWith: 'ES0021000004961178BY' } }
    },
    select: { id: true, numeroFactura: true, fechaEmision: true, saldoFactura: true }
  });
  console.log("F1s para ese CUPS:", f1);
}
main().finally(() => process.exit(0));
