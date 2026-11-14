import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getActiveBrand } from '@/lib/permissions';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeBrandId = await getActiveBrand();
    const resolvedParams = await params;

    const existing = await prisma.commissionTier.findUnique({
      where: { id: resolvedParams.id },
    });
    if (!existing || (session.user.role !== 'SUPERADMIN' && existing.brandId !== activeBrandId)) {
      return NextResponse.json({ error: 'Nivel no encontrado o sin acceso autorizado' }, { status: 404 });
    }

    const data = await req.json();
    const cleanName = String(data.name || '').trim();
    if (!cleanName) {
      return NextResponse.json({ error: 'El nombre del nivel es obligatorio' }, { status: 400 });
    }

    if (existing.brandId) {
      const duplicate = await prisma.commissionTier.findFirst({
        where: {
          id: { not: existing.id },
          brandId: existing.brandId,
          name: { equals: cleanName, mode: 'insensitive' },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Ya existe otro nivel con ese nombre en esta marca' }, { status: 409 });
      }
    }

    const updated = await prisma.commissionTier.update({
      where: { id: resolvedParams.id },
      data: {
        name: cleanName,
        description: data.description || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeBrandId = await getActiveBrand();
    const resolvedParams = await params;

    const existing = await prisma.commissionTier.findUnique({
      where: { id: resolvedParams.id },
    });
    if (!existing || (session.user.role !== 'SUPERADMIN' && existing.brandId !== activeBrandId)) {
      return NextResponse.json({ error: 'Nivel no encontrado o sin acceso autorizado' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.commissionRule.deleteMany({ where: { tierId: resolvedParams.id } }),
      prisma.channel.updateMany({
        where: { commissionTierId: resolvedParams.id },
        data: { commissionTierId: null },
      }),
      prisma.commissionTier.delete({ where: { id: resolvedParams.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
