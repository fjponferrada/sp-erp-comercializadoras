import React from 'react';
import { prisma } from '@/lib/prisma';
import CanalesClient, { CanalData } from './CanalesClient';

export default async function CanalesPage() {
  const dbChannels = await prisma.channel.findMany({
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

    return {
      id: c.id,
      codigo: c.code,
      nombre: c.name,
      contacto: c.supervisorEmail?.split('@')[0] || 'Admin', // Placeholder for contact name
      telefono: '—', // No phone field in schema
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
      products: c.products || []
    };
  });

  return <CanalesClient initialCanales={canalesData} />;
}
