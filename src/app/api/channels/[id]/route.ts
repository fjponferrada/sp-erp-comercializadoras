import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getChannelVisibilityFilter } from '@/lib/permissions';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    const visibilityFilter = await getChannelVisibilityFilter();

    const existingChannel = await prisma.channel.findFirst({
      where: { 
        id,
        ...visibilityFilter
      },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found or access denied' }, { status: 404 });
    }

    const updated = await prisma.channel.update({
      where: { id },
      data: {
        name: data.nombre,
        code: data.codigo,
        fixedCommissionPct: data.comisionFijo,
        variableCommissionPct: data.comisionVariable,
        supervisorEmail: data.email,
        adminEmail: data.adminEmail,
        managerEmail: data.managerEmail,
        supportEmail: data.supportEmail,
        autoGenerateContract: data.autoGenerateContract,
        maxRenewalDays: data.maxRenewalDays,
        ...(data.productIds ? { products: { set: data.productIds.map((pid: string) => ({ id: pid })) } } : {})
      }
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El código de canal ya existe' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
