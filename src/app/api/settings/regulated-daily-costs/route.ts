import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET() {
  try {
    const data = await prisma.regulatedDailyCost.findMany({
      orderBy: [{ concept: 'asc' }, { validFrom: 'desc' }]
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    
    // Parse amounts & dates
    const parsedAmount = parseFloat(body.amount);
    const validFrom = new Date(body.validFrom);
    const validTo = body.validTo ? new Date(body.validTo) : null;
    
    const newCost = await prisma.regulatedDailyCost.create({
      data: {
        concept: body.concept,
        amount: parsedAmount,
        label: body.label || null,
        validFrom,
        validTo
      }
    });
    return NextResponse.json(newCost);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    
    const parsedAmount = parseFloat(body.amount);
    const validFrom = new Date(body.validFrom);
    const validTo = body.validTo ? new Date(body.validTo) : null;
    
    const updatedCost = await prisma.regulatedDailyCost.update({
      where: { id: body.id },
      data: {
        concept: body.concept,
        amount: parsedAmount,
        label: body.label || null,
        validFrom,
        validTo
      }
    });
    return NextResponse.json(updatedCost);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session || !['SUPERADMIN', 'BACKOFFICE', 'COMPANYADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
