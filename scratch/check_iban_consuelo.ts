import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
async function main() {
  const c = await prisma.contract.findFirst({
    where: { client: { businessName: { contains: 'CONSUELO', mode: 'insensitive' } } },
    include: { supplyPoint: true }
  });
  console.log('Contract ID:', c?.id);
  console.log('Contract IBAN:', c?.iban);
  console.log('SupplyPoint IBAN:', c?.supplyPoint?.iban);
  console.log('Airtable IBAN:', (c?.airtableData as any)?.IBAN);
}
main();
