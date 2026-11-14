import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizeSpanishPostalCode } from './postalCode';

const POSTAL_CODE_FIELDS = new Set(['postalCode', 'sipsPostalCode', 'billingPostalCode']);
const NESTED_WRITE_KEYS = new Set([
  'data',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'connectOrCreate',
  'supplyPoint',
  'supplyPoints',
  'client',
  'solarQuotes',
]);

function sanitizePostalFieldsInWriteTree(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) sanitizePostalFieldsInWriteTree(item);
    return;
  }
  if (Object.prototype.toString.call(node) !== '[object Object]') return;

  const record = node as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (POSTAL_CODE_FIELDS.has(key)) {
      if (typeof val === 'string') {
        record[key] = normalizeSpanishPostalCode(val, val);
      } else if (val && typeof val === 'object' && typeof (val as any).set === 'string') {
        (val as any).set = normalizeSpanishPostalCode((val as any).set, (val as any).set);
      }
    } else if (NESTED_WRITE_KEYS.has(key) && val && typeof val === 'object') {
      sanitizePostalFieldsInWriteTree(val);
    }
  }
}

const WRITE_OPS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert']);

function attachPostalCodeGuard(baseClient: PrismaClient): PrismaClient {
  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (WRITE_OPS.has(operation) && args && typeof args === 'object') {
            sanitizePostalFieldsInWriteTree(args);
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  (function () {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
    if (connectionString?.startsWith('prisma://')) {
      return attachPostalCodeGuard(
        new PrismaClient({
          accelerateUrl: connectionString
        } as any)
      );
    } else {
      const pool = new Pool({
        connectionString,
        max: process.env.NODE_ENV === 'production' ? 2 : 1,
        idleTimeoutMillis: process.env.NODE_ENV === 'production' ? 30000 : 2000,
      });
      const adapter = new PrismaPg(pool);
      return attachPostalCodeGuard(new PrismaClient({ adapter } as any));
    }
  })();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
