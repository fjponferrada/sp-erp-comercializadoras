import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
    const allSP = await prisma.supplyPoint.findMany({
        select: { id: true, cups: true }
    });

    const cupsMap = new Map<string, string[]>();
    for (const sp of allSP) {
        if (!sp.cups) continue;
        const norm = sp.cups.toUpperCase().trim();
        if (!cupsMap.has(norm)) cupsMap.set(norm, []);
        cupsMap.get(norm)!.push(sp.id);
    }

    let mergedCount = 0;

    for (const [cups, ids] of cupsMap.entries()) {
        if (ids.length > 1) {
            console.log(`\nFound duplicate CUPS: ${cups} (${ids.length} records)`);
            
            const sps = await prisma.supplyPoint.findMany({
                where: { id: { in: ids } },
                include: {
                    contracts: true,
                    client: true
                }
            });

            // Find which one has more data
            let richSp = sps[0];
            let activeSp = sps[0];

            let maxDataScore = -1;
            for (const sp of sps) {
                let score = 0;
                if (sp.address && sp.address !== 'Desconocida') score++;
                if (sp.annualConsumption) score++;
                if (sp.iban) score++;
                if (sp.p1c) score++;
                if (score > maxDataScore) {
                    maxDataScore = score;
                    richSp = sp;
                }

                // Check if this SP is linked to an active contract
                if (sp.contracts.some(c => c.status === 'ACTIVO' || c.status === 'ACEPTADO')) {
                    activeSp = sp;
                }
            }

            console.log(`- Rich SP ID: ${richSp.id} (Client: ${richSp.client?.firstName} ${richSp.client?.lastName})`);
            console.log(`- Active SP ID: ${activeSp.id} (Client: ${activeSp.client?.firstName} ${activeSp.client?.lastName})`);

            if (richSp.id !== activeSp.id) {
                // Merge richSp data into activeSp
                const updateData: any = {};
                for (const key of Object.keys(richSp)) {
                    if (key === 'id' || key === 'clientId' || key === 'contracts' || key === 'client') continue;
                    
                    const richVal = (richSp as any)[key];
                    const activeVal = (activeSp as any)[key];

                    // If activeVal is missing/empty, take richVal
                    if ((activeVal === null || activeVal === undefined || activeVal === '' || activeVal === 'Desconocida') && 
                        (richVal !== null && richVal !== undefined && richVal !== '' && richVal !== 'Desconocida')) {
                        updateData[key] = richVal;
                    }
                }

                if (Object.keys(updateData).length > 0) {
                    await prisma.supplyPoint.update({
                        where: { id: activeSp.id },
                        data: updateData
                    });
                    console.log(`  -> Merged data into active SP:`, Object.keys(updateData));
                }

                // Re-link contracts from richSp to activeSp
                for (const c of richSp.contracts) {
                    await prisma.contract.update({
                        where: { id: c.id },
                        data: { supplyPointId: activeSp.id }
                    });
                    console.log(`  -> Re-linked contract ${c.contractCode} to active SP`);
                }

                // Move F1 invoices and leads if necessary
                const invoices = await prisma.f1Invoice.findMany({ where: { supplyPointId: richSp.id } });
                for (const inv of invoices) {
                    await prisma.f1Invoice.update({ where: { id: inv.id }, data: { supplyPointId: activeSp.id } });
                }

                const docs = await prisma.document.findMany({ where: { supplyPointId: richSp.id } });
                for (const doc of docs) {
                    await prisma.document.update({ where: { id: doc.id }, data: { supplyPointId: activeSp.id } });
                }

                // Delete the richSp
                await prisma.supplyPoint.delete({
                    where: { id: richSp.id }
                });
                console.log(`  -> Deleted obsolete SP ${richSp.id}`);
                mergedCount++;
            } else {
                // If they are the same, just delete the others (the empty ones)
                for (const sp of sps) {
                    if (sp.id !== activeSp.id) {
                        // Re-link contracts
                        for (const c of sp.contracts) {
                            await prisma.contract.update({
                                where: { id: c.id },
                                data: { supplyPointId: activeSp.id }
                            });
                        }
                        
                        const invoices = await prisma.f1Invoice.findMany({ where: { supplyPointId: sp.id } });
                        for (const inv of invoices) {
                            await prisma.f1Invoice.update({ where: { id: inv.id }, data: { supplyPointId: activeSp.id } });
                        }

                        const docs = await prisma.document.findMany({ where: { supplyPointId: sp.id } });
                        for (const doc of docs) {
                            await prisma.document.update({ where: { id: doc.id }, data: { supplyPointId: activeSp.id } });
                        }

                        await prisma.supplyPoint.delete({
                            where: { id: sp.id }
                        });
                        console.log(`  -> Deleted empty obsolete SP ${sp.id}`);
                        mergedCount++;
                    }
                }
            }
        }
    }

    console.log(`\nProceso finalizado. Se han fusionado/eliminado ${mergedCount} puntos de suministro duplicados.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
