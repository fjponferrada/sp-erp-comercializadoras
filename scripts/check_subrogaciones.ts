import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const contracts = await prisma.contract.findMany({
        include: { client: true, supplyPoint: true }
    });

    const codeGroups = new Map<string, any[]>();
    for (const c of contracts) {
        if (!codeGroups.has(c.contractCode)) {
            codeGroups.set(c.contractCode, []);
        }
        codeGroups.get(c.contractCode)!.push(c);
    }

    let subrogaciones = 0;
    let errors = 0;

    for (const [code, group] of codeGroups.entries()) {
        if (group.length > 1) {
            // Check if there are different clients for the same contract code
            const clients = new Set(group.map(c => c.client.id));
            if (clients.size > 1) {
                subrogaciones++;
                console.log(`\nContrato subrogado detectado: ${code} (${group.length} versiones)`);
                for (const c of group) {
                    console.log(`  - Versión: ${c.airtableId} | Titular: ${c.client.businessName} | Estado: ${c.status} | SP_CUPS: ${c.supplyPoint.cups} | SP_Titular: ${c.supplyPoint.clientId === c.client.id ? 'CORRECTO' : '¡ERROR!'}`);
                    if (c.supplyPoint.clientId !== c.client.id) {
                        errors++;
                    }
                }
            }
        }
    }

    console.log(`\nTotal contratos subrogados (con distintos titulares): ${subrogaciones}`);
    console.log(`Total errores (contrato apuntando a supply point de otro titular): ${errors}`);
}

main().finally(() => prisma.$disconnect());
