import { NextResponse } from 'next/server';
import { exportContractsExcelAction } from '@/app/actions/contractActions';

export async function GET() {
  try {
    const res = await exportContractsExcelAction('PRPR2510301210NM0F', 'Todos', 'Todas', 'Todos', 'Todos');
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
