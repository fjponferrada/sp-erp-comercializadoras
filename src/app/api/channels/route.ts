import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'COMPANYADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();

    const newChannel = await prisma.channel.create({
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
        maxRenewalDays: data.maxRenewalDays
      }
    });

    return NextResponse.json(newChannel);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El código de canal ya existe' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
