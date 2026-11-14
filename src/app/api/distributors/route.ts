import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { hasAdminOrBackofficeRole, resolveActiveCompanyId } from '@/lib/companyContext';

const MASK = '••••••••';

function isNewPasswordProvided(val: unknown): val is string {
  return typeof val === 'string' && val.trim() !== '' && val !== MASK;
}

export async function GET() {
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

    const distributors = await prisma.distributor.findMany({
      orderBy: { name: 'asc' },
      include: {
        companyConfigs: {
          where: { companyId },
          take: 1
        }
      }
    });

    const mapped = distributors.map(d => {
      const cfg = d.companyConfigs[0] || null;
      return {
        id: d.id,
        reeCode: d.reeCode,
        name: d.name,
        emailAtr: d.emailAtr,
        phone: d.phone,
        portalUrl: d.portalUrl,
        registroCnmc: d.registroCnmc,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        configId: cfg?.id || null,
        companyId,
        ftpActive: cfg?.ftpActive ?? false,
        ftpHost: cfg?.ftpHost ?? null,
        ftpPort: cfg?.ftpPort ?? 21,
        ftpUser: cfg?.ftpUser ?? null,
        ftpPassword: '',
        hasFtpPassword: Boolean(cfg?.ftpPassword),
        ftpTargetPath: cfg?.ftpTargetPath ?? null,
        ftpLastSyncAt: cfg?.ftpLastSyncAt ?? null,
        webScrapingActive: cfg?.webScrapingActive ?? false,
        webUser: cfg?.webUser ?? null,
        webPassword: '',
        hasWebPassword: Boolean(cfg?.webPassword),
        webScriptPath: cfg?.webScriptPath ?? d.webScriptPath ?? null,
        webLastSyncAt: cfg?.webLastSyncAt ?? null,
      };
    });

    return NextResponse.json(mapped);
  } catch (error: any) {
    console.error('Error fetching distributors:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();
    const cleanName = String(body.name || '').trim();
    const cleanReeCode = String(body.reeCode || '').trim();
    if (!cleanName || !cleanReeCode) {
      return NextResponse.json({ error: 'Nombre y Código REE son obligatorios' }, { status: 400 });
    }

    let dist = await prisma.distributor.findUnique({
      where: { reeCode: cleanReeCode }
    });

    if (!dist) {
      dist = await prisma.distributor.create({
        data: {
          name: cleanName,
          reeCode: cleanReeCode,
          portalUrl: body.portalUrl || null,
          webScriptPath: body.webScriptPath ? String(body.webScriptPath).trim() : null,
        }
      });
    }

    const updateData: Record<string, any> = {
      ftpHost: body.ftpHost ? String(body.ftpHost).trim() : null,
      ftpPort: body.ftpPort ? parseInt(String(body.ftpPort), 10) || 21 : 21,
      ftpUser: body.ftpUser ? String(body.ftpUser).trim() : null,
      ftpTargetPath: body.ftpTargetPath ? String(body.ftpTargetPath).trim() : null,
      ftpActive: Boolean(body.ftpActive),
      webUser: body.webUser ? String(body.webUser).trim() : null,
      webScriptPath: body.webScriptPath ? String(body.webScriptPath).trim() : null,
      webScrapingActive: Boolean(body.webScrapingActive),
    };
    if (isNewPasswordProvided(body.ftpPassword)) {
      updateData.ftpPassword = body.ftpPassword;
    }
    if (isNewPasswordProvided(body.webPassword)) {
      updateData.webPassword = body.webPassword;
    }

    const cfg = await prisma.distributorCompanyConfig.upsert({
      where: {
        companyId_distributorId: {
          companyId,
          distributorId: dist.id
        }
      },
      update: updateData,
      create: {
        companyId,
        distributorId: dist.id,
        ftpHost: updateData.ftpHost,
        ftpPort: updateData.ftpPort,
        ftpUser: updateData.ftpUser,
        ftpPassword: isNewPasswordProvided(body.ftpPassword) ? body.ftpPassword : null,
        ftpTargetPath: updateData.ftpTargetPath,
        ftpActive: updateData.ftpActive,
        webUser: updateData.webUser,
        webPassword: isNewPasswordProvided(body.webPassword) ? body.webPassword : null,
        webScriptPath: updateData.webScriptPath,
        webScrapingActive: updateData.webScrapingActive,
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
    console.error('Error creating distributor:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'El Código REE ya existe' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
