import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const sp = await prisma.supplyPoint.findUnique({
        where: { id: 'cmq6zml6x131oic41iq65jr5q' }
    });
    console.log("SupplyPoint for cmq6zml6x131oic41iq65jr5q:");
    console.log(`CUPS: "${sp?.cups}"`);
    console.log(`annualConsumption: ${sp?.annualConsumption}`);
}
main().finally(() => prisma.$disconnect());
