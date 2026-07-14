import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email as string }
    });
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const cookieStore = await cookies();
    const activeBrandId = cookieStore.get('active-brand')?.value;
    const targetBrandId = (activeBrandId && activeBrandId !== 'todas') ? activeBrandId : user.brandId;

    const services = await prisma.additionalService.findMany({
      where: {
        brandId: targetBrandId,
        isActive: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ success: true, data: services });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}
