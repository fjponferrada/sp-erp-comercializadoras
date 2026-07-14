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
    let primaryBrandId = data.brandId || (data.assignedBrandIds && data.assignedBrandIds.length > 0 ? data.assignedBrandIds[0] : null);
    let assignedBrandIds = data.assignedBrandIds || [];
    let assignedCompanyIds = data.assignedCompanyIds || [];

    if (data.channelId && (data.role === 'CANAL' || data.role === 'COMERCIAL')) {
      const channel = await prisma.channel.findUnique({ where: { id: data.channelId }, include: { brand: true } });
      if (channel && channel.brandId) {
        primaryBrandId = channel.brandId;
        assignedBrandIds = [channel.brandId];
        if (channel.brand?.companyId) {
          assignedCompanyIds = [channel.brand.companyId];
        }
      }
    }

    const updateData: any = {
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone || null,
      codigo: data.codigo || null,
      isChannelSupervisor: Boolean(data.isChannelSupervisor),
      assignedBrands: assignedBrandIds.length > 0 ? {
        set: assignedBrandIds.map((id: string) => ({ id }))
      } : { set: [] },
      companies: assignedCompanyIds.length > 0 ? {
        set: assignedCompanyIds.map((id: string) => ({ id }))
      } : { set: [] }
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
