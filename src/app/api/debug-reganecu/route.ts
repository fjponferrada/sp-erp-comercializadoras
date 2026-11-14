import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { resolveActiveCompanyId } from '@/lib/reganecuServer';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const companyId = await resolveActiveCompanyId(session.user);
  const data = await prisma.reganecuData.findFirst({
    where: {
      total: true,
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(data);
}
