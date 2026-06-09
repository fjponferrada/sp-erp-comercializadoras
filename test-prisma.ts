import { PrismaClient } from '@prisma/client';

try {
  const prisma1 = new PrismaClient({
    url: process.env.DATABASE_URL
  } as any);
  console.log("Success with url");
} catch (e: any) {
  console.error("Failed with url:", e.message);
}

try {
  const prisma2 = new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL
  } as any);
  console.log("Success with accelerateUrl");
} catch (e: any) {
  console.error("Failed with accelerateUrl:", e.message);
}

try {
  const prisma3 = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  } as any);
  console.log("Success with datasources");
} catch (e: any) {
  console.error("Failed with datasources:", e.message);
}
