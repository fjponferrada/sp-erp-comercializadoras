import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const c = await prisma.municipality.count();
    console.log(`Total municipalities in DB: ${c}`);
}
main().finally(() => prisma.$disconnect());
