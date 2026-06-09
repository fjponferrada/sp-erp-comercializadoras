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
  const adminHash = await bcrypt.hash('admin', 10);
  const userHash = await bcrypt.hash('password123', 10);

  const users = await prisma.user.findMany();
  let fixed = 0;
  for (const u of users) {
    if (!u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
      const newHash = u.email === 'fjponferrada@sp-energia.com' ? adminHash : userHash;
      await prisma.user.update({
        where: { id: u.id },
        data: { password: newHash }
      });
      fixed++;
    }
  }
  console.log(`Arregladas las contraseñas de ${fixed} usuarios.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
