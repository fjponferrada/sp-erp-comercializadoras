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
    const primaryBrandId = data.brandId || (data.assignedBrandIds && data.assignedBrandIds.length > 0 ? data.assignedBrandIds[0] : null);

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
        assignedBrands: data.assignedBrandIds ? {
          connect: data.assignedBrandIds.map((id: string) => ({ id }))
        } : undefined,
        companies: data.assignedCompanyIds ? {
          connect: data.assignedCompanyIds.map((id: string) => ({ id }))
        } : undefined
      }
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
