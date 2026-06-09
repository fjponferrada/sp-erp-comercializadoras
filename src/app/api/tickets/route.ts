import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role === 'CANAL') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const nivel = searchParams.get('nivel');
    const estado = searchParams.get('estado'); // "Pendientes", "Nuevas", "Todas"

    let whereClause: any = {};

    // Filtros de acceso por rol
    if (session.user.role === 'CLIENT') {
      // Cliente solo ve los suyos (asumiendo que User tiene relación con Client en un futuro,
      // por ahora restringimos o buscamos por email si es necesario).
      // Pendiente de la implementación real de login de clientes.
    } else if (session.user.role !== 'SUPERADMIN') {
      // COMPANYADMIN o BACKOFFICE
      const userWithBrand = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { brand: true }
      });
      if (userWithBrand && userWithBrand.brandId) {
        whereClause.brandId = userWithBrand.brandId;
      }
    }

    // Filtros por UI
    if (brandId) whereClause.brandId = brandId;
    if (nivel) whereClause.nivel = nivel;
    if (estado === 'Pendientes') {
      whereClause.estado = { in: ['NUEVA', 'EN_PROCESO', 'PENDIENTE_RESOLUCION'] };
    } else if (estado === 'Nuevas') {
      whereClause.estado = 'NUEVA';
    }

    const tickets = await prisma.ticket.findMany({
      where: whereClause,
      include: {
        brand: { select: { name: true, codigoMarca: true } },
        client: { select: { businessName: true, firstName: true, lastName: true, vatNumber: true } },
        supplyPoint: { select: { cups: true } },
        user: { select: { name: true, role: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role === 'CANAL') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await req.json();
    const { brandId, nif, supplyPointId, motivo, consulta, nivel } = data;

    if (!brandId || !motivo || !consulta) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    // Buscar el cliente por NIF si se provee
    let clientId = null;
    if (nif) {
      const client = await prisma.client.findUnique({ where: { vatNumber: nif } });
      if (client) clientId = client.id;
    }

    const newTicket = await prisma.ticket.create({
      data: {
        motivo,
        consulta,
        nivel: nivel || 'Nivel 1 - Comercializadora',
        brandId,
        clientId,
        supplyPointId: supplyPointId || null,
        openedById: session.user.id,
      }
    });

    return NextResponse.json(newTicket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
