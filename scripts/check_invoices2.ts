import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const cups = 'ES0022000007942973DW1P';
    
    const sp = await prisma.supplyPoint.findFirst({
        where: { cups: { contains: cups } }
    });
    
    if (sp) {
        const invs = await prisma.invoice.findMany({ where: { supplyPointId: sp.id } });
        console.log("Invoices count:", invs.length);
        invs.forEach(inv => {
            console.log(`- ID: ${inv.id}, Type: ${inv.invoiceType}, Number: ${inv.invoiceNumber}, invoiceData.codigoFiscal: ${(inv.invoiceData as any)?.codigoFiscal || (inv.invoiceData as any)?.['Codigo Fiscal']}`);
            console.log("  invoiceData:", JSON.stringify(inv.invoiceData).substring(0, 200));
        });
    }
}

main().catch(console.error).finally(() => process.exit(0));
