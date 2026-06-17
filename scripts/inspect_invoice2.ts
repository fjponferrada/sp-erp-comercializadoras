import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const inv = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'A260410253' }
    });
    console.log(JSON.stringify(inv?.invoiceData, null, 2));
}

main().finally(() => prisma.$disconnect());
