import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== 'SUPERADMIN' && role !== 'COMPANYADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const data = await req.json();
    
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
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

    if (!data.name || !data.email || !data.password || !primaryBrandId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios o no hay marcas asignadas' }, { status: 400 });
    }

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role || 'COMERCIAL',
        brand: { connect: { id: primaryBrandId } },
        ...(data.channelId ? { channel: { connect: { id: data.channelId } } } : {}),
        phone: data.phone || null,
        codigo: data.codigo || null,
        isChannelSupervisor: Boolean(data.isChannelSupervisor),
        assignedBrands: assignedBrandIds.length > 0 ? {
          connect: assignedBrandIds.map((id: string) => ({ id }))
        } : undefined,
        companies: assignedCompanyIds.length > 0 ? {
          connect: assignedCompanyIds.map((id: string) => ({ id }))
        } : undefined
      }
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
