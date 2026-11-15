import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasAdminOrBackofficeRole } from '@/lib/companyContext';
import { getBrandAccessContext } from '@/lib/permissions';

export async function GET() {
  const access = await getBrandAccessContext();
  if (!access) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!hasAdminOrBackofficeRole(access.role)) {
    return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
  }
  const data = await prisma.futurePrice.findMany({ orderBy: { month: 'asc' } });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const access = await getBrandAccessContext();
    if (!access) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole(access.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const body = await req.json();
    const month = Number(body.month);
    const price = Number(body.price);
    if (!Number.isInteger(month) || month < 200001 || month > 210012 || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Mes o precio de futuro inválido' }, { status: 400 });
    }

    const item = await prisma.futurePrice.upsert({
      where: { month },
      update: { price },
      create: { month, price },
    });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const access = await getBrandAccessContext();
    if (!access) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole(access.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const body = await req.json();
    const { id } = body;
    const price = Number(body.price);
    if (!id || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const item = await prisma.futurePrice.update({
      where: { id },
      data: { price },
    });
    return NextResponse.json(item);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await getBrandAccessContext();
    if (!access) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole(access.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Falta ID' }, { status: 400 });
    }
    await prisma.futurePrice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
