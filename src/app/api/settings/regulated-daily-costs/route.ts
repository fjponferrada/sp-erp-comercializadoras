import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBrandAccessContext } from '@/lib/permissions';

const ADMIN_ROLES = ['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'];

export async function GET() {
  try {
    const access = await getBrandAccessContext();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.includes(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const data = await prisma.regulatedDailyCost.findMany({
      orderBy: [{ concept: 'asc' }, { validFrom: 'desc' }],
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(error);
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
    const parsedAmount = parseFloat(body.amount);
    const validFrom = body.validFrom ? new Date(body.validFrom) : null;
    const validTo = body.validTo ? new Date(body.validTo) : null;

    if (!concept || !Number.isFinite(parsedAmount) || !validFrom || Number.isNaN(validFrom.getTime())) {
      return NextResponse.json({ error: 'Concepto, importe y fecha de inicio son obligatorios' }, { status: 400 });
    }

    const newCost = await prisma.regulatedDailyCost.create({
      data: {
        concept,
        amount: parsedAmount,
        label: body.label ? String(body.label).trim() : null,
        validFrom,
        validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo : null,
      },
    });
    return NextResponse.json(newCost);
  } catch (error: any) {
    console.error(error);
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
    const parsedAmount = parseFloat(body.amount);
    const validFrom = body.validFrom ? new Date(body.validFrom) : null;
    const validTo = body.validTo ? new Date(body.validTo) : null;

    if (!id || !concept || !Number.isFinite(parsedAmount) || !validFrom || Number.isNaN(validFrom.getTime())) {
      return NextResponse.json({ error: 'ID, concepto, importe y fecha de inicio son obligatorios' }, { status: 400 });
    }

    const updatedCost = await prisma.regulatedDailyCost.update({
      where: { id },
      data: {
        concept,
        amount: parsedAmount,
        label: body.label ? String(body.label).trim() : null,
        validFrom,
        validTo: validTo && !Number.isNaN(validTo.getTime()) ? validTo : null,
      },
    });
    return NextResponse.json(updatedCost);
  } catch (error: any) {
    console.error(error);
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
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await prisma.regulatedDailyCost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
