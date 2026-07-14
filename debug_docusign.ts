import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { prisma } from './src/lib/prisma';

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { supplyPoint: { cups: { contains: 'ES0031104918101017' } } }
  });
  console.log(contracts.map(c => ({ id: c.id, docusign: c.docusignEnvelopeId })));
}

main().catch(console.error).finally(() => process.exit(0));
