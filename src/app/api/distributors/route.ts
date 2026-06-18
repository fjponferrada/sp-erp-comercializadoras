import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const distributors = await prisma.distributor.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(distributors);
  } catch (error: any) {
    console.error('Error fetching distributors:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
