import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN' && session.user.role !== 'BACKOFFICE')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const results = await prisma.pendingEnergySummary.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { month: 'desc' },
      take: 12
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Error recuperando energía pendiente:', error);
    return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
  }
}
