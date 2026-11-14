import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

const ADMIN_ROLES = ['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const data = await prisma.regulatedCost.findMany({ orderBy: { validFrom: 'desc' } });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    if (typeof body.tariff === 'string') {
      body.tariff = body.tariff.trim().replace(/\s+/g, '').toUpperCase();
    }
    const item = await prisma.regulatedCost.create({ data: body });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const { id, ...data } = body;
    if (typeof data.tariff === 'string') {
      data.tariff = data.tariff.trim().replace(/\s+/g, '').toUpperCase();
    }
    const item = await prisma.regulatedCost.update({ where: { id }, data });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || !ADMIN_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('ID needed');
    await prisma.regulatedCost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
