import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  await prisma.invoice.updateMany({ data: { communicatedAt: null } });
  return NextResponse.json({ success: true, message: "Cleared communicatedAt flags" });
}
