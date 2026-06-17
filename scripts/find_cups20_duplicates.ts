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
    const supplyPoints = await prisma.supplyPoint.findMany({
        select: { id: true, cups: true, clientId: true, contracts: { select: { id: true } } }
    });

    const groups = new Map<string, typeof supplyPoints>();
    for (const sp of supplyPoints) {
        if (!sp.cups || !sp.clientId) continue;
        const cups20 = sp.cups.substring(0, 20).toUpperCase();
        const key = `${cups20}-${sp.clientId}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(sp);
    }

    let duplicateCount = 0;
    const duplicateExamples = [];

    for (const [key, sps] of groups.entries()) {
        if (sps.length > 1) {
            duplicateCount++;
            if (duplicateExamples.length < 5) {
                duplicateExamples.push({
                    key,
                    sps: sps.map(sp => ({ cups: sp.cups, contracts: sp.contracts.length }))
                });
            }
        }
    }

    console.log(`Found ${duplicateCount} groups of duplicate SupplyPoints based on 20-char CUPS + clientId.`);
    console.log(`Examples:`);
    console.log(JSON.stringify(duplicateExamples, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
