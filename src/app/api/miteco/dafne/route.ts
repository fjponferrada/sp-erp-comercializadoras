import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get('year');
    if (!yearStr) {
      return NextResponse.json({ error: 'Falta el parámetro year' }, { status: 400 });
    }
    
    // Si seleccionan 2025 en el combobox, reportan las ventas del AÑO ANTERIOR (2024)? 
    // Wait, let's sum for the year provided in the UI. The user provides 2025. Does it mean "data OF 2025" or "Reporting IN 2025 for 2024"?
    // The instruction said: "La plataforma estará abierta desde el 1 de enero hasta el 29 de junio para el reporte de los datos de ventas del año anterior."
    // So if the form says "2025", the report is FOR 2024. Or maybe "2025" just means the data for 2025.
    // In ESCILA_AED_2025.xml, <ANIO>2025</ANIO> is used. But usually you report year X in year X+1. Let's just use the year passed by the UI to filter the data. If they want data of 2024 they'll pick 2024. If they pick 2025, we filter 2025. Wait, the ESCILA example name is ESCILA_AED_2025.xml, meaning they generated it in 2025 (or for 2025?). Actually, we will just use the `year` selected to filter `billingEnd` between Jan 1st and Dec 31st of that year.

    const targetYear = parseInt(yearStr, 10);
    const startDate = new Date(`${targetYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${targetYear}-12-31T23:59:59.999Z`);

    // Sumar todos los valores de los arrays de curvas de carga para el año seleccionado
    // Convertimos a Number porque el raw query puede devolver tipos BigInt o Float de Postgres
    const result: any = await prisma.$queryRaw`
      SELECT SUM(val) as total
      FROM "LoadCurve", unnest(readings) as val
      WHERE date >= ${startDate} AND date <= ${endDate}
        AND type = 'CONSUMPTION'
    `;

    const totalKwh = result[0]?.total ? Number(result[0].total) : 0;

    return NextResponse.json({ totalKwh });
  } catch (error: any) {
    console.error('DAFNE error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
