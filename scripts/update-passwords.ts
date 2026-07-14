import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
    console.log('Actualizando contraseñas a 123456...');
    const hash = await bcrypt.hash('123456', 10);
    const result = await prisma.user.updateMany({
        where: {
            email: {
                not: 'fjponferrada@sp-energia.com'
            }
        },
        data: {
            password: hash
        }
    });
    console.log(`Actualizados ${result.count} usuarios.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
