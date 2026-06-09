import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const nif = searchParams.get('nif');

    if (!nif) {
      return NextResponse.json({ error: 'NIF is required' }, { status: 400 });
    }

    // Buscar cliente por NIF incluyendo sus puntos de suministro asociados a sus contratos
    const client = await prisma.client.findUnique({
      where: { vatNumber: nif },
      include: {
        contracts: {
          include: {
            supplyPoint: true
          }
        }
      }
    });

    if (!client) {
      return NextResponse.json({ found: false });
    }

    // Extraer CUPS únicos de los contratos del cliente
    const cupsList = client.contracts
      .map(c => c.supplyPoint)
      .filter((sp, index, self) => sp && self.findIndex(s => s?.id === sp.id) === index)
      .map(sp => ({
        id: sp!.id,
        cups: sp!.cups,
        address: sp!.address,
        tariff: sp!.tariff
      }));

    return NextResponse.json({
      found: true,
      client: {
        id: client.id,
        name: client.businessName || `${client.firstName} ${client.lastName}`.trim(),
        nif: client.vatNumber,
      },
      cups: cupsList
    });

  } catch (error) {
    console.error('Error searching client by nif:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
