import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting re-fix for annualConsumption in SupplyPoints using the most recent contract...");
    const sps = await prisma.supplyPoint.findMany({
        include: {
            contracts: {
                select: { airtableData: true, createdAt: true },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    console.log(`Found ${sps.length} SupplyPoints total.`);
    
    let fixedCount = 0;
    
    for (const sp of sps) {
        if (sp.contracts.length > 0) {
            // Because of orderBy desc, contracts[0] is the most recent
            const recentContract = sp.contracts[0];
            const f = recentContract.airtableData as any;
            
            if (f) {
                let consumoComision = 0;
                let consumoAnualKwh = 0;
                
                if (f['CONSUMO COMISION']) {
                    consumoComision = parseFloat(f['CONSUMO COMISION'].toString().replace(',', '.')) || 0;
                }
                if (f['CONSUMO ANUAL KWH']) {
                    consumoAnualKwh = (parseFloat(f['CONSUMO ANUAL KWH'].toString().replace(',', '.')) || 0) / 1000;
                }
                
                const contractConsumption = consumoComision > 0 ? consumoComision : consumoAnualKwh;
                
                // Only update if the current value is different (and we actually have a consumption in the recent contract)
                if (contractConsumption > 0 && sp.annualConsumption !== contractConsumption) {
                    await prisma.supplyPoint.update({
                        where: { id: sp.id },
                        data: { annualConsumption: contractConsumption }
                    });
                    fixedCount++;
                }
            }
        }
    }
    
    console.log(`Re-fixed ${fixedCount} SupplyPoints with the most recent contract's consumption.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
