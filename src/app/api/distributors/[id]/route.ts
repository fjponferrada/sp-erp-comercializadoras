import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    // Filtramos solo los campos permitidos para evitar modificaciones indeseadas
    const dataToUpdate: any = {};
    if (body.name !== undefined) dataToUpdate.name = body.name;
    if (body.reeCode !== undefined) dataToUpdate.reeCode = body.reeCode;
    if (body.portalUrl !== undefined) dataToUpdate.portalUrl = body.portalUrl;
    if (body.ftpHost !== undefined) dataToUpdate.ftpHost = body.ftpHost;
    if (body.ftpPort !== undefined) dataToUpdate.ftpPort = parseInt(body.ftpPort, 10) || 21;
    if (body.ftpUser !== undefined) dataToUpdate.ftpUser = body.ftpUser;
    if (body.ftpPassword !== undefined) dataToUpdate.ftpPassword = body.ftpPassword;
    if (body.ftpTargetPath !== undefined) dataToUpdate.ftpTargetPath = body.ftpTargetPath;
    if (body.ftpActive !== undefined) dataToUpdate.ftpActive = Boolean(body.ftpActive);

    const updated = await prisma.distributor.update({
      where: { id },
      data: dataToUpdate
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating distributor:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
