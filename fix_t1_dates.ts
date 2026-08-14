import { prisma } from './src/lib/prisma';

async function main() {
    const events = await prisma.switchingEvent.findMany({
        where: {
            procesoBase: 'T1',
            paso: '06',
            contractId: { not: null }
        },
        include: { contract: true }
    });

    console.log(`Encontrados ${events.length} eventos T1_06 asociados a un contrato.`);

    let fixedCount = 0;

    for (const event of events) {
        if (!event.contractId || !event.contract) continue;
        
        const correctBajaDate = event.fechaActivacionBaja || event.fechaActivacionAlta;
        
        if (correctBajaDate) {
            const contractDate = event.contract.terminationDate;
            
            if (!contractDate || contractDate.getTime() !== correctBajaDate.getTime()) {
                await prisma.contract.update({
                    where: { id: event.contractId },
                    data: { terminationDate: correctBajaDate }
                });
                console.log(`- Contrato ${event.contract.id} corregido: de ${contractDate ? contractDate.toISOString() : 'null'} a ${correctBajaDate.toISOString()}`);
                fixedCount++;
            }
        }
    }

    console.log(`Proceso terminado. Se han corregido ${fixedCount} contratos.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });