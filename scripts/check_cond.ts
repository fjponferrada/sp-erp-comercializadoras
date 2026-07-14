import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const inv = await prisma.invoice.findFirst({
        where: { invoiceNumber: 'A260410253' },
        include: { client: true }
    });
    
    if (inv && inv.invoiceData) {
        const data = inv.invoiceData as any;
        console.log("NIF in invoiceData:", data['NIF Contacto']);
        console.log("Client VAT:", inv.client.vatNumber);
        console.log("Condition:", (data['NIF Contacto'] && inv.client.vatNumber !== data['NIF Contacto']));
    }
}
main().finally(() => prisma.$disconnect());
