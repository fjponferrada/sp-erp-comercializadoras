import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const orphanF1s = await prisma.f1Invoice.findMany({
        where: { supplyPointId: null }
    });

    console.log(`Found ${orphanF1s.length} orphan F1Invoices.`);

    let linkedCount = 0;
    for (const f1 of orphanF1s) {
        const jsonData: any = f1.jsonData;
        const cups = jsonData?.DatosGeneralesFacturaATR?.DireccionSuministro?.CUPS || jsonData?.Medidas?.CodPM || jsonData?.CodPM;

        if (cups) {
            const baseCups = String(cups).trim();
            const sp = await prisma.supplyPoint.findFirst({
                where: { cups: { startsWith: baseCups.substring(0, 20), mode: 'insensitive' } }
            });

            if (sp) {
                await prisma.f1Invoice.update({
                    where: { id: f1.id },
                    data: { supplyPointId: sp.id }
                });
                linkedCount++;
                console.log(`Linked F1Invoice ${f1.numeroFactura} to SupplyPoint ${sp.cups}`);
            } else {
                console.log(`No SupplyPoint found starting with ${baseCups.substring(0, 20)}`);
            }
        } else {
            console.log(`F1Invoice ${f1.numeroFactura} has NO CUPS!`);
        }
    }
    
    console.log(`Finished. Linked ${linkedCount} F1Invoices.`);
}

main().catch(console.error).finally(() => process.exit(0));
