import { prisma } from '@/lib/prisma';
import FacturacionClient from './FacturacionClient';
import Topbar from '@/components/Topbar';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function FacturacionInternaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;
  const searchQ = params?.q || '';
  const pendingWhere: any = {
    internalInvoices: {
      none: {}
    },
    contractId: { not: null } // Solo podemos facturar si está enlazado a un contrato
  };

  if (searchQ) {
    const qUpper = searchQ.toUpperCase();
    
    // Heurística para evitar ORs masivos entre tablas (que hunden el rendimiento en Prisma/Postgres)
    if (qUpper.startsWith('ES')) {
      // Es un CUPS seguro
      pendingWhere.contract = {
        ...pendingWhere.contract,
        supplyPoint: { cups: { startsWith: qUpper } }
      };
    } else if (/\d/.test(searchQ) && searchQ.length < 15) {
      // Si tiene números y es corto, suele ser el Nº de Factura o el NIF
      pendingWhere.OR = [
        { numeroFactura: { contains: searchQ, mode: 'insensitive' } },
        { contract: { client: { vatNumber: { contains: searchQ, mode: 'insensitive' } } } }
      ];
    } else {
      // Si es texto normal, buscamos por Razón Social o Nombre
      pendingWhere.contract = {
        ...pendingWhere.contract,
        client: {
          OR: [
            { businessName: { contains: searchQ, mode: 'insensitive' } },
            { name: { contains: searchQ, mode: 'insensitive' } }
          ]
        }
      };
    }
  }

  // Obtenemos los F1 pendientes de facturar internamente (aquellos que no tienen InternalInvoices asociados)
  // Limitamos a 50 para la demo/UI rápida. En producción se debería paginar.
  const pendingF1s = await prisma.f1Invoice.findMany({
    where: pendingWhere,
    include: {
      contract: {
        include: {
          client: true,
          supplyPoint: true
        }
      },
      invoices: { select: { id: true, pdfUrl: true, totalAmount: true } }
    },
    orderBy: {
      fechaEmision: 'desc'
    },
    take: 500 // Subido temporalmente a 500. Para volúmenes mayores a 1000 se debería implementar paginación
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
      f1Invoice: {
        include: {
          invoices: { select: { id: true, pdfUrl: true, totalAmount: true } }
        }
      }
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
