import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const leadId = 'cmqdlongw0000ds41icsty78z';
  console.log('Deleting Lead', leadId);
  await prisma.lead.delete({ where: { id: leadId } });
  console.log('Deleted successfully.');
}

main().catch(console.error).finally(() => process.exit(0));
