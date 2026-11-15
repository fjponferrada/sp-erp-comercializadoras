import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBrandAccessContext } from '@/lib/permissions';

const ADMIN_ROLES = ['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'];

function toNullableFloat(val: unknown): number | null {
  if (val === '' || val === null || val === undefined) return null;
  const parsed = typeof val === 'number' ? val : parseFloat(String(val));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const access = await getBrandAccessContext();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await prisma.regulatedCost.findMany({
      orderBy: [{ validFrom: 'desc' }, { concept: 'asc' }, { tariff: 'asc' }],
    });
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await getBrandAccessContext();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const concept = String(body.concept || '').trim();
    const tariff = String(body.tariff || '').trim().replace(/\s+/g, '').toUpperCase();
    const validFrom = body.validFrom ? new Date(body.validFrom) : null;
    const validTo = body.validTo ? new Date(body.validTo) : null;

    if (!concept || !tariff || !validFrom || Number.isNaN(validFrom.getTime()) || !validTo || Number.isNaN(validTo.getTime())) {
      return NextResponse.json(
        { error: 'Concepto, tarifa, fecha de inicio y fecha de fin son obligatorios' },
        { status: 400 }
      );
    }

    const item = await prisma.regulatedCost.create({
      data: {
        concept,
        tariff,
        validFrom,
        validTo,
        p1: toNullableFloat(body.p1),
        p2: toNullableFloat(body.p2),
        p3: toNullableFloat(body.p3),
        p4: toNullableFloat(body.p4),
        p5: toNullableFloat(body.p5),
        p6: toNullableFloat(body.p6),
        singleValue: toNullableFloat(body.singleValue),
      },
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body.id || '').trim();
    const concept = String(body.concept || '').trim();
    const tariff = String(body.tariff || '').trim().replace(/\s+/g, '').toUpperCase();
    const validFrom = body.validFrom ? new Date(body.validFrom) : null;
    const validTo = body.validTo ? new Date(body.validTo) : null;

    if (!id || !concept || !tariff || !validFrom || Number.isNaN(validFrom.getTime()) || !validTo || Number.isNaN(validTo.getTime())) {
      return NextResponse.json(
        { error: 'ID, concepto, tarifa, fecha de inicio y fecha de fin son obligatorios' },
        { status: 400 }
      );
    }

    const item = await prisma.regulatedCost.update({
      where: { id },
      data: {
        concept,
        tariff,
        validFrom,
        validTo,
        p1: toNullableFloat(body.p1),
        p2: toNullableFloat(body.p2),
        p3: toNullableFloat(body.p3),
        p4: toNullableFloat(body.p4),
        p5: toNullableFloat(body.p5),
        p6: toNullableFloat(body.p6),
        singleValue: toNullableFloat(body.singleValue),
      },
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }
    await prisma.regulatedCost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
