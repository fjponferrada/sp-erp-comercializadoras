import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';

export async function GET() {
    const deleted = await prisma.systemComponentPrice.deleteMany({
        where: { component: 'K', version: 'C5' }
    });
    return NextResponse.json({ deleted: deleted.count });
}
