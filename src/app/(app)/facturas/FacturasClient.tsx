'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, Eye, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import PaginationFooter from '@/components/PaginationFooter';
import { formatDateUTC } from '@/lib/utils/date';
import SendInvoicesButton from '@/components/facturas/SendInvoicesButton';
import RequestPaymentButton from '@/components/facturas/RequestPaymentButton';

interface Client {
  id: string;
  businessName: string | null;
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address?: string | null;
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
  origin?: string | null;
  totalMWh?: number | null;
  communicatedAt?: Date | null;
}

interface FacturasClientProps {
  initialInvoices: Invoice[];
  pendingCount: number;
  initialTotalCount: number;
}

export default function FacturasClient({ initialInvoices, pendingCount, initialTotalCount }: FacturasClientProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'user';
  const showPaymentButtons = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  
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
        const { getPaginatedInvoicesAction } = await import('@/app/actions/invoiceActions');
        const result = await getPaginatedInvoicesAction(currentPage, itemsPerPage, searchTerm, filterType, dateFrom, dateTo);
        if (result.success && result.invoices) {
          setInvoices(result.invoices as Invoice[]);
          setTotalCount(result.totalCount || 0);
        }
      } catch (err) {
        console.error("Error fetching invoices:", err);
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
    setSelectedInvoiceIds(new Set()); // Clear selection when filters change
  }, [searchTerm, filterType, itemsPerPage, dateFrom, dateTo]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(invoices.map(i => i.id));
      setSelectedInvoiceIds(allIds);
    } else {
      setSelectedInvoiceIds(new Set());
    }
  };

  const handleSelectInvoice = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedInvoiceIds);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedInvoiceIds(newSelected);
  };

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
        <div style={{ position: 'relative', minWidth: '180px' }}>
          <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '36px', cursor: 'pointer', appearance: 'none' }}
          >
            <option value="">Tipo: Todas</option>
            <option value="Normal">Normal</option>
            <option value="Abono">Abono</option>
            <option value="Rectificativa">Rectificativa</option>
          </select>
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
        
        {showPaymentButtons && (
          <SendInvoicesButton 
            selectedInvoiceIds={Array.from(selectedInvoiceIds)} 
            onSentSuccess={() => setSelectedInvoiceIds(new Set())}
          />
        )}
        <button 
          className="btn-secondary"
          onClick={() => {
            const params = new URLSearchParams();
            if (searchTerm) params.set('search', searchTerm);
            if (filterType) params.set('type', filterType);
            if (dateFrom) params.set('from', dateFrom);
            if (dateTo) params.set('to', dateTo);
            window.open(`/api/facturas/export?${params.toString()}`, '_blank');
          }}
        >
          <Download size={14} />
          Exportar
        </button>
      </div>

      {/* Table */}
      <div className="card animate-fade-in-up delay-400" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={invoices.length > 0 && selectedInvoiceIds.size === invoices.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th>Nº Factura / Emisión</th>
                <th>Cliente</th>
                <th>Suministro (CUPS, Dir, Proc)</th>
                <th>Periodo Facturado</th>
                <th>Consumo</th>
                <th style={{ textAlign: 'right' }}>Total €</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td style={{ textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedInvoiceIds.has(invoice.id)}
                      onChange={(e) => handleSelectInvoice(invoice.id, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{invoice.invoiceNumber}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{formatDateUTC(invoice.issueDate)}</div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        textTransform: 'uppercase', 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        background: invoice.invoiceType === 'Normal' ? 'rgba(255,255,255,0.05)' : invoice.invoiceType === 'Abono' ? 'rgba(59,130,246,0.1)' : 'rgba(244,63,94,0.1)',
                        color: invoice.invoiceType === 'Normal' ? 'var(--text-muted)' : invoice.invoiceType === 'Abono' ? '#60a5fa' : '#fb7185',
                        border: `1px solid ${invoice.invoiceType === 'Normal' ? 'var(--border)' : invoice.invoiceType === 'Abono' ? 'rgba(59,130,246,0.3)' : 'rgba(244,63,94,0.3)'}`
                      }}>
                        {invoice.invoiceType || 'Normal'}
                      </span>
                      {invoice.communicatedAt ? (
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }} title={`Comunicada el ${formatDateUTC(new Date(invoice.communicatedAt))}`}>
                          ✅ Comunicada
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          ⏳ Pte. Envío
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div>
                        <Link href={`/clientes/${invoice.clientId}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}>
                          {invoice.client.businessName || `${invoice.client.firstName} ${invoice.client.lastName}`}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--lime)', fontWeight: 700 }}>{invoice.supplyPoint?.cups || '-'}</div>
                      {invoice.supplyPoint && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={[invoice.supplyPoint.address, invoice.supplyPoint.postalCode, invoice.supplyPoint.city, invoice.supplyPoint.province].filter(Boolean).join(', ')}>
                          {[invoice.supplyPoint.address, invoice.supplyPoint.postalCode, invoice.supplyPoint.city, invoice.supplyPoint.province].filter(Boolean).join(', ') || '-'}
                        </div>
                      )}
                      {invoice.origin ? (
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '4px' }}>
                          Proc: {invoice.origin}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '4px' }}>
                          Sin Procedencia
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {(invoice as any).desde && (invoice as any).hasta ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '120px' }}><span style={{ color: 'var(--text-muted)' }}>Desde:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatDateUTC((invoice as any).desde)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '120px' }}><span style={{ color: 'var(--text-muted)' }}>Hasta:</span> <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatDateUTC((invoice as any).hasta)}</span></div>
                      </div>
                    ) : invoice.billingStart && invoice.billingEnd ? (
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
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{(invoice.invoiceType === 'Abono' ? -Math.abs(invoice.totalMWh) : invoice.totalMWh).toLocaleString('es-ES')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>kWh</span></span>
                    ) : '-'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: invoice.invoiceType === 'Abono' ? '#fb7185' : '#34d399' }}>
                    {(invoice.invoiceType === 'Abono' ? -Math.abs(invoice.totalAmount) : invoice.totalAmount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => window.location.href = `/facturas/${invoice.id}`} className="action-icon" title="Ver Ficha">
                        <Eye size={16} />
                      </button>
                      {invoice.pdfUrl && (
                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="action-icon" title="Descargar PDF">
                          <Download size={16} />
                        </a>
                      )}
                      
                      {invoice.client.contactPhone && (
                        <>
                          <div style={{ height: '16px', width: '1px', background: 'var(--border)', margin: '0 4px' }}></div>
                          <a href={`https://wa.me/34${invoice.client.contactPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="action-icon" title="Enviar WhatsApp">
                            <MessageCircle size={16} style={{ color: '#22c55e' }} />
                          </a>
                          <a href={`tel:${invoice.client.contactPhone.replace(/\D/g, '')}`} className="action-icon" title="Llamar">
                            <Phone size={16} style={{ color: '#60a5fa' }} />
                          </a>
                        </>
                      )}

                      <div style={{ height: '16px', width: '1px', background: 'var(--border)', margin: '0 4px' }}></div>
                      {showPaymentButtons && (
                        <>
                          <RequestPaymentButton invoiceId={invoice.id} type="transfer" />
                          <RequestPaymentButton invoiceId={invoice.id} type="overdue" />
                        </>
                      )}
                    </div>
                    {!invoice.pdfUrl && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '4px' }}>Pendiente de PDF</div>}
                  </td>
                </tr>
              ))}
              
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {isLoading ? "Cargando facturas..." : "No se encontraron facturas."}
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
          itemName="facturas"
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>
    </div>
  );
}
