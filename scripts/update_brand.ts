import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const brand = await prisma.brand.findFirst({
        where: { name: 'AED Energía' }
    });

    if (brand) {
        await prisma.brand.update({
            where: { id: brand.id },
            data: {
                contactPerson: 'FRANCISCO JAVIER PONFERRADA RODRIGUEZ',
                phone: '900525826',
                email: 'fjponferrada@aed-energia.com'
            }
        });
        console.log("Marca AED Energía actualizada con éxito.");
    } else {
        console.log("No se encontró la marca AED Energía.");
    }
}

main().finally(() => prisma.$disconnect());
