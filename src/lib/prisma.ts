import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (function () {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
    const pool = new Pool({
      connectionString,
      max: process.env.NODE_ENV === 'production' ? 5 : 1,
      idleTimeoutMillis: process.env.NODE_ENV === 'production' ? 30000 : 2000,
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
