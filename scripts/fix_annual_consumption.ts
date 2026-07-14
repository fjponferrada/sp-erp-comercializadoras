import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    console.log("Starting fix for annualConsumption in SupplyPoints...");
    const sps = await prisma.supplyPoint.findMany({
        where: {
            OR: [
                { annualConsumption: null },
                { annualConsumption: 0 }
            ]
        },
        include: {
            contracts: {
                select: { airtableData: true }
            }
        }
    });

    console.log(`Found ${sps.length} SupplyPoints with missing or 0 annualConsumption.`);
    
    let fixedCount = 0;
    
    for (const sp of sps) {
        let maxConsumo = 0;
        
        for (const contract of sp.contracts) {
            const f = contract.airtableData as any;
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
                if (contractConsumption > maxConsumo) {
                    maxConsumo = contractConsumption;
                }
            }
        }
        
        if (maxConsumo > 0) {
            await prisma.supplyPoint.update({
                where: { id: sp.id },
                data: { annualConsumption: maxConsumo }
            });
            fixedCount++;
        }
    }
    
    console.log(`Fixed ${fixedCount} SupplyPoints.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
