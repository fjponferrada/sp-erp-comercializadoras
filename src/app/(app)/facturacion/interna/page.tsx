import { prisma } from '@/lib/prisma';
import FacturacionClient from './FacturacionClient';
import Topbar from '@/components/Topbar';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function FacturacionInternaPage() {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  // Obtenemos los F1 pendientes de facturar internamente (aquellos que no tienen InternalInvoices asociados)
  // Limitamos a 50 para la demo/UI rápida. En producción se debería paginar.
  const pendingF1s = await prisma.f1Invoice.findMany({
    where: {
      internalInvoices: {
        none: {}
      },
      contractId: { not: null } // Solo podemos facturar si está enlazado a un contrato
    },
    include: {
      contract: {
        include: {
          client: true,
          supplyPoint: true
        }
      }
    },
    orderBy: {
      fechaEmision: 'desc'
    },
    take: 100
  });

  // Obtenemos los borradores generados
  const drafts = await prisma.internalInvoice.findMany({
    where: {
      status: { in: ['BORRADOR', 'REQUIERE_REPARACION'] }
    },
    include: {
      contract: {
        include: {
          client: true,
          supplyPoint: true
        }
      },
      f1Invoice: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar 
        title="Facturación Interna (Motor de Pruebas)" 
        subtitle="Genera facturas desde los archivos F1, revísalas y confírmalas."
        showSearch={false} 
      />
      <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <FacturacionClient 
          pendingF1s={JSON.parse(JSON.stringify(pendingF1s))} 
          drafts={JSON.parse(JSON.stringify(drafts))} 
        />
      </div>
    </div>
  );
}
