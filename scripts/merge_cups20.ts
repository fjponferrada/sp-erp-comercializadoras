import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Iniciando fusión de SupplyPoints duplicados (por 20 caracteres)...');

    const supplyPoints = await prisma.supplyPoint.findMany({
        include: { 
            contracts: { select: { id: true } },
            documents: { select: { id: true } },
            tickets: { select: { id: true } },
            invoices: { select: { id: true } },
            solarQuotes: { select: { id: true } }
        }
    });

    const groups = new Map<string, typeof supplyPoints>();
    for (const sp of supplyPoints) {
        if (!sp.cups || !sp.clientId) continue;
        const cups20 = sp.cups.substring(0, 20).toUpperCase();
        const key = `${cups20}-${sp.clientId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(sp);
    }

    let mergedCount = 0;

    for (const [key, sps] of groups.entries()) {
        if (sps.length > 1) {
            let primary = sps[0];
            let maxContracts = primary.contracts.length;
            
            for (let i = 1; i < sps.length; i++) {
                const current = sps[i];
                const currentContracts = current.contracts.length;
                
                if (currentContracts > maxContracts) {
                    primary = current;
                    maxContracts = currentContracts;
                } else if (currentContracts === maxContracts) {
                    if (current.cups.length === 22 && primary.cups.length < 22) {
                        primary = current;
                    }
                }
            }

            const others = sps.filter(sp => sp.id !== primary.id);

            for (const other of others) {
                console.log(`Fusionando ${other.cups} (${other.id}) en ${primary.cups} (${primary.id})...`);
                
                if (other.contracts.length > 0) {
                    await prisma.contract.updateMany({
                        where: { supplyPointId: other.id },
                        data: { supplyPointId: primary.id }
                    });
                }
                
                if (other.documents.length > 0) {
                    await prisma.document.updateMany({
                        where: { supplyPointId: other.id },
                        data: { supplyPointId: primary.id }
                    });
                }
                
                if (other.tickets.length > 0) {
                    await prisma.ticket.updateMany({
                        where: { supplyPointId: other.id },
                        data: { supplyPointId: primary.id }
                    });
                }

                if (other.invoices.length > 0) {
                    await prisma.invoice.updateMany({
                        where: { supplyPointId: other.id },
                        data: { supplyPointId: primary.id }
                    });
                }

                if (other.solarQuotes.length > 0) {
                    await prisma.solarQuote.updateMany({
                        where: { supplyPointId: other.id },
                        data: { supplyPointId: primary.id }
                    });
                }

                // Switching Events and F1 Invoices don't have back-relation included in query, update anyway
                await prisma.switchingEvent.updateMany({
                    where: { supplyPointId: other.id },
                    data: { supplyPointId: primary.id }
                });

                await prisma.f1Invoice.updateMany({
                    where: { supplyPointId: other.id },
                    data: { supplyPointId: primary.id }
                });

                // Update CUPS text to 22 if needed
                if (primary.cups.length === 20 && other.cups.length >= 22) {
                    await prisma.supplyPoint.update({
                        where: { id: primary.id },
                        data: { cups: other.cups }
                    });
                    primary.cups = other.cups;
                }

                // Borrar el secundario
                await prisma.supplyPoint.delete({
                    where: { id: other.id }
                });
                
                mergedCount++;
            }
        }
    }

    console.log(`Fusión completada. ${mergedCount} Puntos de Suministro secundarios fusionados y eliminados.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
