require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Iniciando borrado en cascada...');
    // Delete in order to avoid foreign key constraints
    await prisma.invoice.deleteMany({});
    console.log('Invoices deleted.');
    await prisma.document.deleteMany({});
    console.log('Documents deleted.');
    await prisma.ticket.deleteMany({});
    console.log('Tickets deleted.');
    await prisma.commission.deleteMany({});
    console.log('Commissions deleted.');
    await prisma.contractModification.deleteMany({});
    console.log('Contract modifications deleted.');
    await prisma.lead.deleteMany({});
    console.log('Leads deleted.');
    await prisma.solarQuote.deleteMany({});
    console.log('Solar Quotes deleted.');
    await prisma.contract.deleteMany({});
    console.log('Contracts deleted.');
    await prisma.supplyPoint.deleteMany({});
    console.log('Supply points deleted.');
    await prisma.client.deleteMany({});
    console.log('Clients deleted.');
    await prisma.product.deleteMany({});
    console.log('Products deleted.');
    await prisma.channel.deleteMany({});
    console.log('Channels deleted.');
    await prisma.brand.deleteMany({});
    console.log('Brands deleted.');
    await prisma.company.deleteMany({});
    console.log('Companies deleted.');
    await prisma.user.deleteMany({});
    console.log('Users deleted.');
    
    console.log('Wipe finalizado con éxito.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
