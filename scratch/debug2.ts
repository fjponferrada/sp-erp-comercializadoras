import { prisma } from '../src/lib/prisma';
import fs from 'fs';

async function main() {
  const f1s = await prisma.internalInvoice.findMany({
    where: {
      contract: {
        supplyPoint: {
          cups: { in: ['ES0021000042259265YM', 'ES00210000422921635Z'] }
        }
      }
    },
    include: {
      contract: { include: { product: true } },
      f1Invoice: true
    }
  });

  const res = f1s.map(f => ({
    cups: f.contract?.cups || 'none',
    pricingModel: f.contract?.pricingModel,
    productType: f.contract?.product?.type,
    airtableFijoIndex: (f.f1Invoice?.jsonData as any)?.['AirTable FIJO/INDEX'],
    f1JsonData: f.f1Invoice?.jsonData
  }));

  fs.writeFileSync('scratch/debug2.json', JSON.stringify(res, null, 2));
  console.log('done');
}
main().catch(console.error);
