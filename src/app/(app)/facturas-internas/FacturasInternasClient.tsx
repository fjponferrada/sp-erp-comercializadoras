'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, Eye } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import PaginationFooter from '@/components/PaginationFooter';
import { formatDateUTC } from '@/lib/utils/date';

interface Client {
  id: string;
  businessName: string | null;
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

interface SupplyPoint {
  id: string;
  cups: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  province?: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string | null;
  issueDate: Date;
  totalAmount: number;
  pdfUrl: string | null;
  clientId: string;
  client: Client;
  supplyPointId: string | null;
  supplyPoint: SupplyPoint | null;
  billingStart?: Date | null;
  billingEnd?: Date | null;
  totalMWh?: number | null;
}

interface FacturasInternasClientProps {
  initialInvoices: Invoice[];
  initialTotalCount: number;
}

export default function FacturasInternasClient({ initialInvoices, initialTotalCount }: FacturasInternasClientProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'user';
  const isClientRole = userRole === 'CLIENT' || userRole === 'CLIENTE';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Server-side state
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch from server action when filters or pagination change
  React.useEffect(() => {
    if (currentPage === 1 && itemsPerPage === 100 && searchTerm === '' && filterType === '' && dateFrom === '' && dateTo === '') {
      setInvoices(initialInvoices);
      setTotalCount(initialTotalCount);
      return;
    }

    const fetchInvoices = async () => {
      setIsLoading(true);
      try {
        const { getPaginatedConfirmedInternalInvoicesAction } = await import('@/app/actions/internalInvoiceActions');
        const result = await getPaginatedConfirmedInternalInvoicesAction(currentPage, itemsPerPage, searchTerm, filterType, dateFrom, dateTo);
        if (result.success && result.invoices) {
          setInvoices(result.invoices as Invoice[]);
          setTotalCount(result.totalCount || 0);
        }
      } catch (err) {
        console.error("Error fetching internal invoices:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceId = setTimeout(() => {
      fetchInvoices();
    }, 300); // 300ms debounce for typing in search

    return () => clearTimeout(debounceId);
  }, [currentPage, itemsPerPage, searchTerm, filterType, dateFrom, dateTo]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, itemsPerPage, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div
        className="animate-fade-in-up delay-300"
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input 
            type="text" 
            placeholder="Buscar por Nº Factura, Nombre, CIF o CUPS..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '38px' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
            className="form-input"
            title="Fecha Desde"
          />
          <span style={{ color: 'var(--text-muted)' }}>-</span>
          <input 
            type="date" 
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
            className="form-input"
            title="Fecha Hasta"
          />
        </div>
        
        <button 
          className="btn-secondary"
          onClick={() => {
            const params = new URLSearchParams();
            if (searchTerm) params.set('search', searchTerm);
            if (filterType) params.set('type', filterType);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            window.open(`/api/facturas-internas/export?${params.toString()}`, '_blank');
          }}
        >
          <Download size={14} />
          Exportar
        </button>
      </div>

      {/* Table */}
      <div className="card animate-fade-in-up delay-400" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Mobile View (Cards) */}
        <div className="block md:hidden">
          {invoices.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {isLoading ? "Cargando facturas..." : "No se encontraron facturas."}
            </div>
          )}
          {invoices.map((invoice) => (
            <div key={invoice.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{invoice.invoiceNumber}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{formatDateUTC(invoice.issueDate)}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: '#34d399' }}>
                  {(invoice.totalAmount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>

              {!isClientRole && invoice.client && (
                <div style={{ fontSize: '0.9rem' }}>
                  <Link href={`/clientes/${invoice.clientId}`} style={{ fontWeight: 600, color: 'var(--lime)', textDecoration: 'none' }}>
                    {invoice.client.businessName || `${invoice.client.firstName} ${invoice.client.lastName}`}
                  </Link>
                </div>
              )}

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>CUPS:</strong> {invoice.supplyPoint?.cups || '-'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {invoice.totalMWh ? `${(invoice.totalMWh).toLocaleString('es-ES')} kWh` : '-'}
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!isClientRole && (
                    <button onClick={() => window.location.href = `/facturacion/interna/proforma/${invoice.id}`} className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}>
                      <Eye size={16} />
                    </button>
                  )}
                  {invoice.pdfUrl && (
                    <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px', color: 'var(--lime)' }}>
                      <Download size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>

          <table className="data-table">
            <thead>
              <tr>
                <th>Factura Interna / Emisión</th>
                <th>Cliente</th>
                <th>Suministro (CUPS)</th>
                <th>Periodo Facturado</th>
                <th>Consumo</th>
                <th style={{ textAlign: 'right' }}>Total €</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{invoice.id.slice(-8).toUpperCase()}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{formatDateUTC(invoice.issueDate)}</div>
                    <div style={{ marginTop: '6px' }}>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        textTransform: 'uppercase', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-muted)',
                        border: '1px solid var(--border)'
                      }}>
                        {invoice.invoiceType || 'Normal'}
                      </span>
                    </div>
                  </td>
                  <td>
                    {invoice.client ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div>
                          <Link href={`/clientes/${invoice.clientId}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                            {invoice.client.businessName || `${invoice.client.firstName} ${invoice.client.lastName}`}
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Desconocido</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--lime)', fontWeight: 700 }}>{invoice.supplyPoint?.cups || '-'}</div>
                      {invoice.supplyPoint && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={[invoice.supplyPoint.address, invoice.supplyPoint.postalCode, invoice.supplyPoint.city, invoice.supplyPoint.province].filter(Boolean).join(', ')}>
                          {[invoice.supplyPoint.address, invoice.supplyPoint.postalCode, invoice.supplyPoint.city, invoice.supplyPoint.province].filter(Boolean).join(', ') || '-'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {invoice.billingStart && invoice.billingEnd ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '120px' }}><span style={{ color: 'var(--text-muted)' }}>Desde:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatDateUTC(invoice.billingStart)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '120px' }}><span style={{ color: 'var(--text-muted)' }}>Hasta:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatDateUTC(invoice.billingEnd)}</span></div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>No especificado</span>
                    )}
                  </td>
                  <td>
                    {invoice.totalMWh ? (
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{(invoice.totalMWh).toLocaleString('es-ES')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>kWh</span></span>
                    ) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                    {(invoice.totalAmount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {!isClientRole && (
                        <button onClick={() => window.location.href = `/facturacion/interna/proforma/${invoice.id}`} className="action-icon" title="Ver Detalle Factura Interna">
                          <Eye size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {isLoading ? "Cargando facturas..." : "No se encontraron facturas internas confirmadas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={totalCount}
          itemName="facturas internas"
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>
    </div>
  );
}
