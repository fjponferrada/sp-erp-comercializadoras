import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'SUPERADMIN' && role !== 'COMPANYADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const data = await req.json();
    const primaryBrandId = data.brandId || (data.assignedBrandIds && data.assignedBrandIds.length > 0 ? data.assignedBrandIds[0] : null);

    const updateData: any = {
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone || null,
      codigo: data.codigo || null,
      isChannelSupervisor: Boolean(data.isChannelSupervisor),
      assignedBrands: data.assignedBrandIds ? {
        set: data.assignedBrandIds.map((id: string) => ({ id }))
      } : undefined,
      companies: data.assignedCompanyIds ? {
        set: data.assignedCompanyIds.map((id: string) => ({ id }))
      } : undefined
    };

    if (primaryBrandId) {
      updateData.brand = { connect: { id: primaryBrandId } };
    }

    if (data.channelId) {
      updateData.channel = { connect: { id: data.channelId } };
    } else {
      updateData.channel = { disconnect: true };
    }

    if (data.password && data.password.trim() !== '') {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updatedUser, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
