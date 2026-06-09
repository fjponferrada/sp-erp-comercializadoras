import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: companyId } = await params;
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validar rol
    if (!['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await req.json();
    
    // Omitir campos que no deberían ser actualizados directamente
    const { id, createdAt, updatedAt, brands, ...updateData } = data;

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: updateData
    });

    return NextResponse.json(updatedCompany);
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json({ error: 'Failed to update company' }, { status: 500 });
  }
}
