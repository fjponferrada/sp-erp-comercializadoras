import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

const MASK = '••••••••';

function isNewPasswordProvided(val: unknown): val is string {
  return typeof val === 'string' && val.trim() !== '' && val !== MASK;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasAdminOrBackofficeRole((session.user as any).role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const companyId = await resolveActiveCompanyId(session);
    if (!companyId) {
      return NextResponse.json({ error: 'No active company selected' }, { status: 400 });
    }

    const { id } = await params;
    const body = await req.json();

    // Global catalog fields (only updated if explicitly changed and user is SUPERADMIN)
    const catalogUpdate: Record<string, any> = {};
    if ((session.user as any).role === 'SUPERADMIN') {
      if (body.name !== undefined) catalogUpdate.name = String(body.name).trim();
      if (body.reeCode !== undefined) catalogUpdate.reeCode = String(body.reeCode).trim();
      if (body.portalUrl !== undefined) catalogUpdate.portalUrl = body.portalUrl || null;
      if (body.webScriptPath !== undefined) {
        catalogUpdate.webScriptPath = body.webScriptPath ? String(body.webScriptPath).trim() : null;
      }
      // Mantener sincronizada la clave web en Distributor como respaldo retrocompatible
      if (isNewPasswordProvided(body.webPassword)) {
        catalogUpdate.webPassword = body.webPassword;
      }
      if (body.webUser !== undefined) {
        catalogUpdate.webUser = body.webUser ? String(body.webUser).trim() : null;
      }
    }

    const dist = Object.keys(catalogUpdate).length > 0
      ? await prisma.distributor.update({ where: { id }, data: catalogUpdate })
      : await prisma.distributor.findUnique({ where: { id } });

    if (!dist) {
      return NextResponse.json({ error: 'Distributor not found' }, { status: 404 });
    }

    // Per-company FTP & Web Scraping configuration
    const configData: Record<string, any> = {};
    if (body.ftpHost !== undefined) configData.ftpHost = body.ftpHost ? String(body.ftpHost).trim() : null;
    if (body.ftpPort !== undefined) configData.ftpPort = parseInt(String(body.ftpPort), 10) || 21;
    if (body.ftpUser !== undefined) configData.ftpUser = body.ftpUser ? String(body.ftpUser).trim() : null;
    if (body.clearFtpPassword === true) {
      configData.ftpPassword = null;
    } else if (isNewPasswordProvided(body.ftpPassword)) {
      configData.ftpPassword = body.ftpPassword;
    }
    if (body.ftpTargetPath !== undefined) configData.ftpTargetPath = body.ftpTargetPath ? String(body.ftpTargetPath).trim() : null;
    if (body.ftpActive !== undefined) configData.ftpActive = Boolean(body.ftpActive);

    if (body.webUser !== undefined) configData.webUser = body.webUser ? String(body.webUser).trim() : null;
    if (body.clearWebPassword === true) {
      configData.webPassword = null;
    } else if (isNewPasswordProvided(body.webPassword)) {
      configData.webPassword = body.webPassword;
    }
    if (body.webScriptPath !== undefined) {
      configData.webScriptPath = body.webScriptPath ? String(body.webScriptPath).trim() : null;
    }
    if (body.webScrapingActive !== undefined) configData.webScrapingActive = Boolean(body.webScrapingActive);

    const cfg = await prisma.distributorCompanyConfig.upsert({
      where: {
        companyId_distributorId: {
          companyId,
          distributorId: id
        }
      },
      update: configData,
      create: {
        companyId,
        distributorId: id,
        ftpActive: Boolean(body.ftpActive),
        ftpHost: body.ftpHost ? String(body.ftpHost).trim() : null,
        ftpPort: body.ftpPort ? parseInt(String(body.ftpPort), 10) || 21 : 21,
        ftpUser: body.ftpUser ? String(body.ftpUser).trim() : null,
        ftpPassword: isNewPasswordProvided(body.ftpPassword) ? body.ftpPassword : null,
        ftpTargetPath: body.ftpTargetPath ? String(body.ftpTargetPath).trim() : null,
        webScrapingActive: Boolean(body.webScrapingActive),
        webUser: body.webUser ? String(body.webUser).trim() : null,
        webPassword: isNewPasswordProvided(body.webPassword) ? body.webPassword : null,
        webScriptPath: body.webScriptPath ? String(body.webScriptPath).trim() : (dist.webScriptPath || null),
      }
    });

    return NextResponse.json({
      id: dist.id,
      reeCode: dist.reeCode,
      name: dist.name,
      emailAtr: dist.emailAtr,
      phone: dist.phone,
      portalUrl: dist.portalUrl,
      registroCnmc: dist.registroCnmc,
      createdAt: dist.createdAt,
      updatedAt: dist.updatedAt,
      configId: cfg.id,
      companyId,
      ftpActive: cfg.ftpActive,
      ftpHost: cfg.ftpHost,
      ftpPort: cfg.ftpPort,
      ftpUser: cfg.ftpUser,
      ftpPassword: '',
      hasFtpPassword: Boolean(cfg.ftpPassword),
      ftpTargetPath: cfg.ftpTargetPath,
      ftpLastSyncAt: cfg.ftpLastSyncAt,
      webScrapingActive: cfg.webScrapingActive,
      webUser: cfg.webUser,
      webPassword: '',
      hasWebPassword: Boolean(cfg.webPassword),
      webScriptPath: cfg.webScriptPath || dist.webScriptPath,
      webLastSyncAt: cfg.webLastSyncAt,
    });
  } catch (error: any) {
    console.error('Error updating distributor:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
