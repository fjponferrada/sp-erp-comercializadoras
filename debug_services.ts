import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const services = await prisma.additionalService.findMany();
  console.log("SERVICES:", services);
}
main().catch(console.error);
