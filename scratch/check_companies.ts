import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const companies = await prisma.company.findMany();
  console.log('Companies:');
  for (const c of companies) {
    console.log(`ID: ${c.id}, Name: ${c.name}, CIF: ${c.cif}, Codigo: ${c.codigo}`);
  }
}
main();
