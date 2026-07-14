import { NextResponse } from 'next/server';
import { InternalBillingEngine } from '@/lib/services/InternalBillingEngine';

export async function GET() {
  try {
    const f1Id = 'cmrahn7u2006u04k2rmcrmcgm';
    const result = await InternalBillingEngine.calculate(f1Id, false);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
