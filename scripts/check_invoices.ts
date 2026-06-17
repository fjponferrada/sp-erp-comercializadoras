import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const cups = 'ES0022000007942973DW1P';
    
    const sp = await prisma.supplyPoint.findFirst({
        where: { cups: { contains: cups } }
    });
    console.log("SupplyPoint:", sp?.id);
    
    if (sp) {
        const f1s = await prisma.f1Invoice.findMany({ where: { supplyPointId: sp.id } });
        console.log("F1Invoices count:", f1s.length);
        if (f1s.length > 0) console.log(f1s[0]);
        
        const invs = await prisma.invoice.findMany({ where: { supplyPointId: sp.id } });
        console.log("Standard Invoices count:", invs.length);
        if (invs.length > 0) console.log(invs[0]);
    }
}

main().catch(console.error).finally(() => process.exit(0));
