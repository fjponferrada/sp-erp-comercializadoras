import React from 'react';
import { prisma } from '@/lib/prisma';
import CanalesClient, { CanalData } from './CanalesClient';
import { getChannelVisibilityFilter } from '@/lib/permissions';

export default async function CanalesPage() {
  const visibilityFilter = await getChannelVisibilityFilter();

  const dbChannels = await prisma.channel.findMany({
    where: visibilityFilter,
    include: {
      users: {
        include: {
          contracts: {
            where: { status: 'ACTIVO' }
          }
        }
      },
      products: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  const canalesData: CanalData[] = dbChannels.map(c => {
    // Calculamos contratos activos asociados a los usuarios de este canal
    let activos = 0;
    const channelUsers = c.users || [];
    channelUsers.forEach((u: any) => {
      activos += u.contracts.length;
    });

    const supervisor = channelUsers.find((u: any) => u.isChannelSupervisor) || channelUsers[0];
    const contactName = supervisor?.name || c.supervisorEmail?.split('@')[0] || 'Admin';
    const contactPhone = supervisor?.phone || '—';

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
      maxRenewalDays: c.maxRenewalDays || 45,
      contratos: activos, // Por simplificar, mostramos activos como total
      activos: activos,
      comisionFijo: c.fixedCommissionPct || 0,
      comisionVariable: c.variableCommissionPct || 0,
      estado: 'ACTIVO', // Asumimos activos si están en BD
      products: c.products || [],
      commissionTierId: c.commissionTierId
    };
  });

  const commissionTiers = await prisma.commissionTier.findMany({ orderBy: { name: 'asc' } });

  return <CanalesClient initialCanales={canalesData} commissionTiers={commissionTiers} />;
}
