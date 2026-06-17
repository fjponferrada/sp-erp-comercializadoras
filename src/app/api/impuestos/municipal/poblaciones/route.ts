import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase() || '';

    // Fetch municipalities from the Municipality table
    const municipalities = await prisma.municipality.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive'
        }
      },
      include: {
        province: true
      },
      take: 50, // Limit to 50 results for the dropdown
      orderBy: {
        name: 'asc'
      }
    });

    const poblaciones = municipalities.map(mun => ({
      label: `${mun.name.toUpperCase()} -- ${mun.province.name.toUpperCase()} -- ESPAÑA`,
      // We will use the municipality name as the value, or maybe code?
      // Since our invoices might only have postal code or city in SupplyPoint,
      // and the user said: "no tenemos forma de hacerlo así a partir de los datos de la factura?"
      // But they then said: "si se agrupan por código postal, debes tener en cuenta que el campo correcto del csv es 'CP PS' ".
      // If we use the name, we can filter by 'city' containing the name, OR we can filter by the name.
      // But wait! If the user selects a Municipality, what value should we pass back to filter?
      // If we pass the Municipality 'name' back as 'municipalityName', we can filter invoices where 'sp.city' contains it.
      // Let's pass the 'name' as the value.
      value: mun.name
    }));

    return NextResponse.json(poblaciones);
  } catch (error) {
    console.error('Error fetching poblaciones:', error);
    return NextResponse.json({ error: 'Failed to fetch poblaciones' }, { status: 500 });
  }
}
