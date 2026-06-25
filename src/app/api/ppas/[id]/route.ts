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
