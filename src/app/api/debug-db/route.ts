import { NextResponse } from "next/server";
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { getUserVisibilityFilter } from '@/lib/permissions'

export async function GET() {
  try {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
    const pool = new Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    const visibilityFilter = await getUserVisibilityFilter();

    await prisma.lead.findMany({
      where: visibilityFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        documents: true,
        user: true,
        contract: true
      }
    });

    return NextResponse.json({ 
      status: "success", 
      DATABASE_URL_length: process.env.DATABASE_URL?.length,
      PRISMA_DATABASE_URL_length: process.env.PRISMA_DATABASE_URL?.length,
      POSTGRES_URL_length: process.env.POSTGRES_URL?.length,
      POSTGRES_PRISMA_URL_length: process.env.POSTGRES_PRISMA_URL?.length,
    });
  } catch(e: any) {
    return NextResponse.json({ 
      error: e.message, 
      code: e.code, 
      meta: e.meta, 
      name: e.name, 
      DATABASE_URL_length: process.env.DATABASE_URL?.length,
      PRISMA_DATABASE_URL_length: process.env.PRISMA_DATABASE_URL?.length,
    }, { status: 500 });
  }
}
