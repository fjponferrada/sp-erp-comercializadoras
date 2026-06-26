import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const session = await auth();
    if (!session?.user?.brandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: session.user.brandId },
      select: { companyId: true }
    });

    if (!brand) return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });

    // Validate the PPA belongs to the same company
    const ppa = await prisma.ppa.findUnique({
      where: { id: id }
    });

    if (!ppa || ppa.companyId !== brand.companyId) {
      return NextResponse.json({ error: 'PPA no encontrado o no tienes permiso' }, { status: 404 });
    }

    await prisma.ppa.delete({
      where: { id: id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error DELETE /api/ppas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const session = await auth();
    if (!session?.user?.brandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: session.user.brandId },
      select: { companyId: true }
    });

    if (!brand) return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });

    const ppa = await prisma.ppa.findUnique({
      where: { id: id }
    });

    if (!ppa || ppa.companyId !== brand.companyId) {
      return NextResponse.json({ error: 'PPA no encontrado o no tienes permiso' }, { status: 404 });
    }

    const body = await req.json();
    const { name, type, subtype, startDate, endDate, priceType, priceValue, basePowerMw, profileData, includeInPricing } = body;

    // Validación básica
    if (!name || !type || !subtype || !startDate || !priceType) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    if (subtype === 'CARGA_BASE' && basePowerMw == null) {
      return NextResponse.json({ error: 'Carga Base requiere una potencia base' }, { status: 400 });
    }

    if (subtype === 'PERFIL_FIJO' && !profileData) {
      return NextResponse.json({ error: 'Perfil Fijo requiere datos de perfil' }, { status: 400 });
    }

    const updatedPpa = await prisma.ppa.update({
      where: { id: id },
      data: {
        name,
        type,
        subtype,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        priceType,
        priceValue: priceValue ? parseFloat(priceValue) : null,
        basePowerMw: basePowerMw ? parseFloat(basePowerMw) : null,
        profileData: profileData || null,
        includeInPricing: includeInPricing !== undefined ? Boolean(includeInPricing) : true
      }
    });

    return NextResponse.json(updatedPpa);
  } catch (error: any) {
    console.error('Error PUT /api/ppas/[id]:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

