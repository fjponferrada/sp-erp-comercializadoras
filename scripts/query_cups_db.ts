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
    const supplyPoint = await prisma.supplyPoint.findMany({
        where: { cups: { contains: "ES0031101351919002HN" } }
    });
    console.log("SupplyPoints found:", JSON.stringify(supplyPoint, null, 2));

    const contracts = await prisma.contract.findMany({
        where: { supplyPoint: { cups: { contains: "ES0031101351919002HN" } } }
    });
    console.log("Contracts found:", JSON.stringify(contracts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
