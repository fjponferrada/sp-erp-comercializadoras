import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const inv = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'A260410253' },
        include: { client: true, contract: true, supplyPoint: true }
    });
    console.log(JSON.stringify(inv, null, 2));
}

main().finally(() => prisma.$disconnect());
