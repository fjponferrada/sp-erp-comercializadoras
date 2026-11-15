import React from 'react';
import { prisma } from '@/lib/prisma';
import CanalesClient, { CanalData } from './CanalesClient';
import { getBrandAccessContext } from '@/lib/permissions';
import { redirect } from 'next/navigation';

export default async function CanalesPage() {
  const access = await getBrandAccessContext();
  if (!access || !['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(access.role)) {
    redirect('/');
  }

  const activeBrandId = access.activeBrandId;
  const brandWhere = activeBrandId ? { brandId: activeBrandId } : {};

  const [dbChannels, commissionTiers, availableProducts] = await Promise.all([
    prisma.channel.findMany({
      where: brandWhere,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            phone: true,
            isActive: true,
            isChannelSupervisor: true,
            _count: {
              select: { contracts: true },
            },
            contracts: {
              where: { status: 'ACTIVO' },
              select: { id: true },
            },
          },
        },
        products: {
          select: {
            id: true,
            name: true,
            type: true,
            tariff: true,
            pricingModel: true,
            hasSelfConsumption: true,
            isAvailableCrm: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.commissionTier.findMany({
      where: brandWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: brandWhere,
      select: {
        id: true,
        name: true,
        type: true,
        tariff: true,
        pricingModel: true,
        hasSelfConsumption: true,
        isAvailableCrm: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const canalesData: CanalData[] = dbChannels.map((c) => {
    let totalContratos = 0;
    let activos = 0;
    const channelUsers = c.users || [];

    channelUsers.forEach((u) => {
      totalContratos += u._count.contracts;
      activos += u.contracts.length;
    });

    const supervisor = channelUsers.find((u) => u.isChannelSupervisor) || channelUsers[0];
    const contactName = supervisor?.name || c.supervisorEmail?.split('@')[0] || 'Admin';
    const contactPhone = supervisor?.phone || '—';

    const hasUsers = channelUsers.length > 0;
    const hasAnyActiveUser = channelUsers.some((u) => u.isActive !== false);
    const estado: 'ACTIVO' | 'INACTIVO' = hasUsers && !hasAnyActiveUser ? 'INACTIVO' : 'ACTIVO';

    return {
      id: c.id,
      codigo: c.code,
      nombre: c.name,
      contacto: contactName,
      telefono: contactPhone,
      email: c.supervisorEmail || '—',
      adminEmail: c.adminEmail || '',
      managerEmail: c.managerEmail || '',
      supportEmail: c.supportEmail || '',
      autoGenerateContract: c.autoGenerateContract || false,
      maxRenewalDays: c.maxRenewalDays ?? 45,
      contratos: totalContratos,
      activos,
      comisionFijo: c.fixedCommissionPct || 0,
      comisionVariable: c.variableCommissionPct || 0,
      estado,
      products: c.products || [],
      commissionTierId: c.commissionTierId,
    };
  });

  const canEdit = access.role === 'SUPERADMIN' || access.role === 'COMPANYADMIN';

  return (
    <CanalesClient
      initialCanales={canalesData}
      commissionTiers={commissionTiers}
      availableProducts={availableProducts}
      canEdit={canEdit}
    />
  );
}
