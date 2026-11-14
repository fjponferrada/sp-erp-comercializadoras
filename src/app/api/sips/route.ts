import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSipsData } from '@/lib/sips';
import { buildIngebauConsumosCsv, buildIngebauPsCsv } from '@/lib/sipsCsvExporter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const headerApiKey = request.headers.get('x-api-key')?.trim();

  const validKeys = [process.env.AED_API_KEY, process.env.SIPS_API_KEY].filter(Boolean) as string[];
  const isApiKeyAuth =
    (bearerToken && validKeys.includes(bearerToken)) ||
    (headerApiKey && validKeys.includes(headerApiKey));

  let auditActor = 'API_KEY';

  if (!isApiKeyAuth) {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 });
    }
    const role = (session.user as any).role || 'USER';
    if (role === 'CLIENT') {
      return NextResponse.json({ success: false, message: 'Acceso restringido a personal autorizado' }, { status: 403 });
    }
    auditActor = `${session.user.email} (${role})`;
  }

  const { searchParams } = new URL(request.url);
  const rawCups = searchParams.get('cups') || '';
  const cups = rawCups.trim().toUpperCase().replace(/\s+/g, '');
  const format = (searchParams.get('format') || 'json').toLowerCase();
  const refresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true';

  if (!cups || cups.length < 20) {
    return NextResponse.json(
      { success: false, message: 'CUPS inválido (20 caracteres mínimo)' },
      { status: 400 }
    );
  }

  try {
    console.log(`[SIPS AUDIT] Actor="${auditActor}" CUPS="${cups}" Format="${format}"`);
    const sipsData = await getSipsData(cups, { skipCache: refresh });

    if (!sipsData || sipsData.result === 'ERROR') {
      const status = sipsData?.code === '404' ? 404 : 502;
      return NextResponse.json(
        {
          success: false,
          message: sipsData?.messages || sipsData?.message || 'CUPS no encontrado en SIPS',
        },
        { status }
      );
    }

    const fullCups = sipsData.data?.ps?.[0]?.CUPS || cups;

    if (format === 'csv_consumos') {
      const csv = buildIngebauConsumosCsv(sipsData);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fullCups}_consumos.csv"`,
        },
      });
    }

    if (format === 'csv_ps') {
      const csv = buildIngebauPsCsv(sipsData);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fullCups}_ps.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: sipsData });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Error desconocido al consultar SIPS' },
      { status: 500 }
    );
  }
}
