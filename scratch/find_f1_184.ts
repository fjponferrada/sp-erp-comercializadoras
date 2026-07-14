import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const fs = await prisma.f1Invoice.findMany({ select: { id: true, jsonData: true, contractId: true, supplyPoint: { select: { cups: true } } } });
  let targetF1Id = null;
  for (const f of fs) {
    const ext = (f.jsonData as any)?.Autoconsumo?.EnergiaExcedentaria?.ValorTotalEnergiaExcedentaria;
    if (ext && ext.toString().includes('184')) {
      console.log('Found F1:', f.id, f.supplyPoint.cups, ext);
      targetF1Id = f.id;
      break;
    }
  }

  if (targetF1Id) {
    const res = await InternalBillingEngine.calculate(targetF1Id);
    console.log("Calculation Result:");
    console.log("excedentesKwh:", res.excedentesKwh);
    console.log("excedentesAutoconsumo:", res.excedentesAutoconsumo);
    console.log("pexc:", res.excedentesKwh ? res.excedentesAutoconsumo / res.excedentesKwh : 0);
  } else {
    console.log("No F1 found with 184 kWh");
  }
}
main().finally(() => prisma.$disconnect());
