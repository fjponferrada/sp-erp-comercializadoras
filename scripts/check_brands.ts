import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const brands = await prisma.brand.findMany();
    for (const b of brands) {
        console.log(`Brand: ${b.name}`);
        console.log(`- ContactPerson: ${b.contactPerson}`);
        console.log(`- Phone: ${b.phone}`);
        console.log(`- Email: ${b.email}`);
    }
}

main().finally(() => prisma.$disconnect());
