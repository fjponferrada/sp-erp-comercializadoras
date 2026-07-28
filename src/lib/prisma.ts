import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";
}

export const prisma =
  globalForPrisma.prisma ||
  // @ts-ignore - Vercel Edge client requires datasourceUrl but TS uses Node types
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy"
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
