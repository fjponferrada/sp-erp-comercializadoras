import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { p1c: { not: null } }
  });
  console.log('Lead ID to delete:', lead?.id);
  console.log('Lead Details:', lead?.businessName, lead?.cups);
}

main().catch(console.error).finally(() => process.exit(0));
