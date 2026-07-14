import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
  const all = await prisma.reganecuData.findMany({ where: { total: false, matricial: false }, take: 500 });
  const dsv = all.find(x => (x.jsonData as any)['0']?.concept === 'DSV');
  if (dsv) {
    const json = dsv.jsonData as any;
    console.log('DSV hour 0:', json['0']);
  } else {
    console.log('No DSV found in first 500');
  }
}
main().then(() => process.exit(0));
