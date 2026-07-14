import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const sp = await prisma.supplyPoint.findFirst({
        where: { cups: 'ES0031101402139001ZV0F' },
        include: { client: true }
    });
    console.log("firstName:", sp?.client?.firstName);
    console.log("lastName:", sp?.client?.lastName);
    console.log("businessName:", sp?.client?.businessName);
    
    // Fix it if wrong
    if (sp?.client?.firstName === 'LUQUE') {
        await prisma.client.update({
            where: { id: sp.client.id },
            data: { firstName: 'ANTONIO', lastName: 'LUQUE MOLINA' }
        });
        console.log("Fixed name!");
    }
}
main().finally(() => prisma.$disconnect());
