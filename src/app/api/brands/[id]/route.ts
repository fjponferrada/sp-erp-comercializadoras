import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: brandId } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validar rol
    if (!['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await req.json();
    
    // Omitir campos que no deberían ser actualizados directamente en este endpoint
    const { id, createdAt, updatedAt, companyId, company, users, backofficeUsers, clients, products, ...updateData } = data;

    const updatedBrand = await prisma.brand.update({
      where: { id: brandId },
      data: updateData,
      include: {
        company: {
          select: {
            name: true,
            cif: true
          }
        }
      }
    });

    return NextResponse.json(updatedBrand);
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 });
  }
}
