import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const distributors = await prisma.distributor.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json(distributors);
  } catch (error: any) {
    console.error('Error fetching distributors:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.name || !body.reeCode) {
      return NextResponse.json({ error: 'Nombre y Código REE son obligatorios' }, { status: 400 });
    }

    const newDist = await prisma.distributor.create({
      data: {
        name: body.name,
        reeCode: body.reeCode,
        ftpHost: body.ftpHost || null,
        ftpPort: body.ftpPort ? parseInt(body.ftpPort, 10) : 21,
        ftpUser: body.ftpUser || null,
        ftpPassword: body.ftpPassword || null,
        ftpTargetPath: body.ftpTargetPath || null,
        ftpActive: body.ftpActive || false,
        webUser: body.webUser || null,
        webPassword: body.webPassword || null,
        webScriptPath: body.webScriptPath || null,
        webScrapingActive: body.webScrapingActive || false,
      }
    });

    return NextResponse.json(newDist);
  } catch (error: any) {
    console.error('Error creating distributor:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El Código REE ya existe' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
