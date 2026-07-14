import { prisma } from '../src/lib/prisma';
import { InternalBillingEngine } from '../src/lib/services/InternalBillingEngine';

async function main() {
  const f1 = await prisma.f1Invoice.findUnique({
    where: { id: 'cmrahmwmr006604k23i2dawyd' },
    include: { contract: { include: { product: true } }, supplyPoint: true }
  });

  const result = await InternalBillingEngine.calculate(f1.id, true);
  console.log("hasMismatch:", result.hasMismatch);
  console.log("repairData:", result.repairData);
  if (result.hasMismatch && !result.repairData) {
      console.log("It was blocked due to mismatch!");
      return;
  }
  console.log("excedentesAutoconsumo:", result.excedentesAutoconsumo);
  console.log("excedentesKwh:", result.excedentesKwh);
  console.log("pexc:", result.excedentesKwh ? result.excedentesAutoconsumo / result.excedentesKwh : 0);
  
  // Now let's see exactly where the surplus was placed
  const hours = new Map<string, { surplus: number, omie: number }>();
  let totalSurplusVal = 0;

  if (result.hourlyDetails) {
      // Let's print the top 10 hours with the most surplus value (surplus * OMIE)
      for (const item of result.hourlyDetails as any) {
          if (item.surplusMwh > 0) {
              const key = item.date;
              hours.set(key, { surplus: item.surplusMwh, omie: item.omie });
              totalSurplusVal += item.surplusMwh * item.omie;
          }
      }

      const sorted = Array.from(hours.entries()).sort((a, b) => (b[1].surplus * b[1].omie) - (a[1].surplus * a[1].omie));
      console.log("Top 10 highest value hours:");
      for (let i = 0; i < 10 && i < sorted.length; i++) {
          console.log(sorted[i][0], "Surplus:", sorted[i][1].surplus, "OMIE:", sorted[i][1].omie, "Value:", sorted[i][1].surplus * sorted[i][1].omie);
      }
      
      console.log("Total raw surplus value in engine:", totalSurplusVal);
  }
}
main().finally(() => prisma.$disconnect());
