import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
async function main() {
  const c = await prisma.contract.findUnique({
    where: { id: 'cmq73sjah01ukvw4107gkw2ym' },
    include: { supplyPoint: true }
  });
  console.log('Contract IBAN:', c?.iban);
  console.log('SupplyPoint IBAN:', c?.supplyPoint?.iban);
  console.log('Airtable IBAN:', (c?.airtableData as any)?.IBAN);
}
main();
