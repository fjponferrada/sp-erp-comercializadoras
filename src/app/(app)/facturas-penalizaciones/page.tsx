import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Topbar from '@/components/Topbar';
import { FileText, Download } from 'lucide-react';
import { getUserVisibilityFilter } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function FacturasPenalizacionesPage() {
  const session = await auth();
  if (!session?.user) return <div>No autorizado</div>;

  const visibilityFilter = await getUserVisibilityFilter();

  const invoices = await prisma.penaltyInvoice.findMany({
    where: {
      contract: {
        ...visibilityFilter
      }
    },
    include: {
      client: true,
      contract: {
        include: { brand: true, product: true }
      },
      supplyPoint: true
    },
    orderBy: [
      { issueDate: 'desc' },
      { invoiceNumber: 'desc' }
    ],
    take: 100
  });

  return (
    <>
      <Topbar title="Facturas de Penalizaciones" subtitle="Historial de penalizaciones facturadas" />
      <div style={{ padding: '24px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>CUPS</th>
                  <th>Producto</th>
                  <th>Importe (con IVA)</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No hay facturas de penalización generadas
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                      <td>{inv.issueDate.toLocaleDateString('es-ES')}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.client.businessName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{inv.client.vatNumber}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{inv.supplyPoint.cups}</td>
                      <td>{inv.contract?.product?.name || '-'}</td>
                      <td style={{ fontWeight: 'bold' }}>{inv.amount.toFixed(2)} €</td>
                      <td>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          background: inv.status === 'EMITIDA' ? 'rgba(52, 211, 153, 0.1)' : 'var(--bg-elevated)',
                          color: inv.status === 'EMITIDA' ? '#34d399' : 'var(--text-muted)'
                        }}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.pdfUrl ? (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '6px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Download size={14} /> PDF
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
