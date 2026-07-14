import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const companies = await prisma.company.findMany();
  return NextResponse.json({ 
    env: process.env.DATABASE_URL,
    companies 
  });
}
