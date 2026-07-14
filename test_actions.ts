import { getPendingEnergyAction } from './src/app/actions/energiaPendienteActions';
import { prisma } from './src/lib/prisma';

async function main() {
  // Mock auth and cookies
  const company = await prisma.company.findFirst();
  if (!company) return;

  const res = await getPendingEnergyAction.call({}, company.id); // we can't inject cookies here easily

  console.log('Done');
}

main().catch(console.error);
