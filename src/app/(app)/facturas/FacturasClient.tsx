'use client';

import React, { useState } from 'react';
import { Search, Filter, Download, Eye, MessageCircle, Phone, FileCode2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import PaginationFooter from '@/components/PaginationFooter';
import { formatDateUTC } from '@/lib/utils/date';
import SendInvoicesButton from '@/components/facturas/SendInvoicesButton';
import RequestPaymentButton from '@/components/facturas/RequestPaymentButton';
import ForceResendButton from '@/components/facturas/ForceResendButton';

interface Client {
  id: string;
  businessName: string | null;
  firstName: string | null;
  lastName: string | null;
  lastName2?: string | null;
  contactEmail: string | null;
  invoiceEmail?: string | null;
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
  paymentDate?: Date | null;
  totalAmount: number;
  pdfUrl: string | null;
  xmlUrl?: string | null;
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
  invoiceTypes?: string[];
}

function isCloudAssetUrl(url: string | null | undefined): url is string {
  return Boolean(url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('airtable'));
}

function isExpiredLegacyUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes('airtable'));
}

function getInvoiceTypeBadgeStyle(type: string | null | undefined): React.CSSProperties {
  const t = (type || 'Normal').trim();
  const lower = t.toLowerCase();

  if (lower.includes('abono') || lower === 'anuladora') {
    return {
      background: 'rgba(59, 130, 246, 0.12)',
      color: '#60a5fa',
      border: '1px solid rgba(59, 130, 246, 0.32)',
    };
  }
  if (lower.includes('rectific')) {
    return {
      background: 'rgba(244, 63, 94, 0.12)',
      color: '#fb7185',
      border: '1px solid rgba(244, 63, 94, 0.32)',
    };
  }
  if (lower.includes('complement')) {
    return {
      background: 'rgba(168, 85, 247, 0.14)',
      color: '#c084fc',
      border: '1px solid rgba(168, 85, 247, 0.35)',
    };
  }
  if (lower.includes('regulariz')) {
    return {
      background: 'rgba(6, 182, 212, 0.14)',
      color: '#22d3ee',
      border: '1px solid rgba(6, 182, 212, 0.35)',
    };
  }
  if (lower.includes('penaliz')) {
    return {
      background: 'rgba(245, 158, 11, 0.14)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.35)',
    };
  }
  return {
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  };
}

export default function FacturasClient({
  initialInvoices,
  pendingCount,
  initialTotalCount,
  invoiceTypes = ['Abono', 'Complementaria', 'Normal', 'Rectificativa', 'Regularizadora'],
}: FacturasClientProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role || 'user';
  const showPaymentButtons = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);
  const canForceResend = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);
  const isClientRole = userRole === 'CLIENT' || userRole === 'CLIENTE';
  const showCommunicationStatus = !['CLIENT', 'CLIENTE', 'COMERCIAL', 'CANAL'].includes(userRole);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [communicationFilter, setCommunicationFilter] = useState('');
  const [pdfFilter, setPdfFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

  // Pagination state (Regla 3: 100 por defecto)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Server-side state
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const sortedInvoiceTypes = React.useMemo(() => {
    return Array.from(new Set(invoiceTypes)).sort((a, b) => a.localeCompare(b, 'es'));
  }, [invoiceTypes]);

  const resetSelectionAndFirstPage = () => {
    setCurrentPage(1);
    setSelectedInvoiceIds(new Set());
    setLastSelectedIndex(null);
  };

  // Fetch from server action when filters or pagination change
  React.useEffect(() => {
    const isInitialDefaultState =
      refreshKey === 0 &&
      currentPage === 1 &&
      itemsPerPage === 100 &&
      searchTerm === '' &&
      filterType === '' &&
      dateFrom === '' &&
      dateTo === '' &&
      communicationFilter === '' &&
      pdfFilter === '';

    const debounceId = setTimeout(async () => {
      if (isInitialDefaultState) {
        setInvoices(initialInvoices);
        setTotalCount(initialTotalCount);
        return;
      }

      setIsLoading(true);
      try {
        const { getPaginatedInvoicesAction } = await import('@/app/actions/invoiceActions');
        const result = await getPaginatedInvoicesAction(
          currentPage,
          itemsPerPage,
          searchTerm,
          filterType,
          dateFrom,
          dateTo,
          communicationFilter,
          pdfFilter
        );
        if (result.success && result.invoices) {
          setInvoices(result.invoices as Invoice[]);
          setTotalCount(result.totalCount || 0);
        }
      } catch (err) {
        console.error('Error fetching invoices:', err);
      } finally {
        setIsLoading(false);
      }
    }, isInitialDefaultState ? 0 : 300);

    return () => clearTimeout(debounceId);
  }, [
    currentPage,
    itemsPerPage,
    searchTerm,
    filterType,
    dateFrom,
    dateTo,
    communicationFilter,
    pdfFilter,
    refreshKey,
    initialInvoices,
    initialTotalCount,
  ]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(invoices.map((i) => i.id));
      setSelectedInvoiceIds(allIds);
    } else {
      setSelectedInvoiceIds(new Set());
    }
    setLastSelectedIndex(null);
  };

  const handleSelectInvoice = (index: number, id: string, checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => {
    const newSelected = new Set(selectedInvoiceIds);

    if ((e.nativeEvent as any).shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);

      for (let i = start; i <= end; i++) {
        const invId = invoices[i].id;
        if (checked) newSelected.add(invId);
        else newSelected.delete(invId);
      }
    } else {
      if (checked) newSelected.add(id);
      else newSelected.delete(id);
    }

    setSelectedInvoiceIds(newSelected);
    setLastSelectedIndex(index);
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      const res = await fetch('/api/facturas/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: Array.from(selectedInvoiceIds) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Error al generar el archivo ZIP');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'facturas_seleccionadas.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error descargando ZIP');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    const toastId = toast.loading(
      selectedInvoiceIds.size > 0
        ? `Exportando ${selectedInvoiceIds.size} facturas seleccionadas...`
        : 'Generando exportación Excel...'
    );
    try {
      const res = await fetch('/api/facturas/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: searchTerm,
          type: filterType,
          from: dateFrom,
          to: dateTo,
          status: communicationFilter,
          pdfFilter,
          invoiceIds: selectedInvoiceIds.size > 0 ? Array.from(selectedInvoiceIds) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Error al exportar facturas');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export_facturas.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel descargado correctamente.', { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al exportar Excel', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const formatClientFullName = (client: Client) => {
    if (client.businessName && client.businessName.trim()) return client.businessName;
    return [client.firstName, client.lastName, client.lastName2].filter(Boolean).join(' ') || 'Sin nombre';
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="animate-fade-in-up delay-300 flex flex-col gap-4">
        {/* Primera línea: Buscador y Filtro de fechas */}
        <div className="flex flex-wrap items-center gap-4">
          <div style={{ position: 'relative', flex: '1', minWidth: '280px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Buscar por Nº Factura, Nombre, CIF, CUPS o Contrato..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                resetSelectionAndFirstPage();
              }}
              className="form-input"
              style={{ paddingLeft: '38px' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                resetSelectionAndFirstPage();
              }}
              onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
              className="form-input"
              title="Fecha Emisión Desde"
            />
            <span style={{ color: 'var(--text-muted)' }}>-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                resetSelectionAndFirstPage();
              }}
              onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
              className="form-input"
              title="Fecha Emisión Hasta"
            />
          </div>
        </div>

        {/* Segunda línea: Filtros y Botones de acción */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div style={{ position: 'relative', minWidth: '185px' }}>
              <Filter
                size={14}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  resetSelectionAndFirstPage();
                }}
                className="form-input"
                style={{ paddingLeft: '36px', cursor: 'pointer', appearance: 'none' }}
              >
                <option value="">Tipo: Todas</option>
                {sortedInvoiceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
                <option value="Bolsillo Solar">Bolsillo Solar</option>
              </select>
            </div>

            {showCommunicationStatus && (
              <div style={{ position: 'relative', minWidth: '165px' }}>
                <Filter
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                />
                <select
                  value={communicationFilter}
                  onChange={(e) => {
                    setCommunicationFilter(e.target.value);
                    resetSelectionAndFirstPage();
                  }}
                  className="form-input"
                  style={{ paddingLeft: '36px', cursor: 'pointer', appearance: 'none' }}
                >
                  <option value="">Envío: Todas</option>
                  <option value="communicated">Comunicadas</option>
                  <option value="pending">Pte. Envío ({pendingCount})</option>
                </select>
              </div>
            )}

            <div style={{ position: 'relative', minWidth: '175px' }}>
              <Filter
                size={14}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
              <select
                value={pdfFilter}
                onChange={(e) => {
                  setPdfFilter(e.target.value);
                  resetSelectionAndFirstPage();
                }}
                className="form-input"
                style={{ paddingLeft: '36px', cursor: 'pointer', appearance: 'none' }}
              >
                <option value="">PDF: Todos</option>
                <option value="cloud">Con PDF en nube</option>
                <option value="missing">Sin PDF / Caducado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showPaymentButtons && (
              <SendInvoicesButton
                selectedInvoiceIds={Array.from(selectedInvoiceIds)}
                onSentSuccess={() => {
                  setSelectedInvoiceIds(new Set());
                  setRefreshKey((k) => k + 1);
                }}
              />
            )}
            {selectedInvoiceIds.size > 0 && (
              <button
                type="button"
                className="btn-secondary"
                disabled={isDownloadingZip}
                onClick={handleDownloadZip}
              >
                {isDownloadingZip ? (
                  <span className="animate-spin inline-block mr-1 border-2 border-current border-t-transparent rounded-full w-3 h-3" />
                ) : (
                  <Download size={14} />
                )}
                ZIP ({selectedInvoiceIds.size})
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={isExporting}
              onClick={handleExportExcel}
            >
              {isExporting ? (
                <span className="animate-spin inline-block mr-1 border-2 border-current border-t-transparent rounded-full w-3 h-3" />
              ) : (
                <Download size={14} />
              )}
              {selectedInvoiceIds.size > 0 ? `Exportar (${selectedInvoiceIds.size})` : 'Exportar'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card animate-fade-in-up delay-400" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Mobile View (Cards) */}
        <div className="block md:hidden">
          {invoices.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {isLoading ? 'Cargando facturas...' : 'No se encontraron facturas.'}
            </div>
          )}
          {invoices.map((invoice) => {
            const isAbono = invoice.invoiceType?.toLowerCase().includes('abono');
            const hasCloudPdf = isCloudAssetUrl(invoice.pdfUrl);
            const hasCloudXml = isCloudAssetUrl(invoice.xmlUrl);

            return (
              <div
                key={invoice.id}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>
                      {invoice.invoiceNumber}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatDateUTC(invoice.issueDate)}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      color: isAbono ? '#fb7185' : '#34d399',
                    }}
                  >
                    {(isAbono ? -Math.abs(invoice.totalAmount) : invoice.totalAmount).toLocaleString('es-ES', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      ...getInvoiceTypeBadgeStyle(invoice.invoiceType),
                    }}
                  >
                    {invoice.invoiceType || 'Normal'}
                  </span>
                  {showCommunicationStatus &&
                    (invoice.communicatedAt ? (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        ✅ Comunicada
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        ⏳ Pte. Envío
                      </span>
                    ))}
                </div>

                {!isClientRole && (
                  <div style={{ fontSize: '0.9rem' }}>
                    <Link
                      href={`/clientes/${invoice.clientId}`}
                      style={{ fontWeight: 600, color: 'var(--lime)', textDecoration: 'none' }}
                    >
                      {formatClientFullName(invoice.client)}
                    </Link>
                  </div>
                )}

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>CUPS:</strong> {invoice.supplyPoint?.cups || '-'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {invoice.totalMWh !== null && invoice.totalMWh !== undefined && invoice.totalMWh !== 0
                      ? `${(isAbono ? -Math.abs(invoice.totalMWh) : invoice.totalMWh).toLocaleString('es-ES')} kWh`
                      : '-'}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {!isClientRole && (
                      <Link
                        href={`/facturas/${invoice.id}`}
                        className="action-icon"
                        style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}
                        title="Ver Ficha"
                      >
                        <Eye size={16} />
                      </Link>
                    )}
                    {hasCloudPdf && (
                      <a
                        href={invoice.pdfUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-icon"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          padding: '6px',
                          borderRadius: '6px',
                          color: 'var(--lime)',
                        }}
                        title="Descargar PDF"
                      >
                        <Download size={16} />
                      </a>
                    )}
                    {hasCloudXml && (
                      <a
                        href={invoice.xmlUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="action-icon"
                        style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}
                        title="Descargar XML"
                      >
                        <FileCode2 size={16} />
                      </a>
                    )}
                    {invoice.communicatedAt && canForceResend && hasCloudPdf && (
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}>
                        <ForceResendButton invoiceId={invoice.id} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
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
              {invoices.map((invoice, index) => {
                const isAbono = invoice.invoiceType?.toLowerCase().includes('abono');
                const hasCloudPdf = isCloudAssetUrl(invoice.pdfUrl);
                const hasCloudXml = isCloudAssetUrl(invoice.xmlUrl);
                const isLegacyPdf = !hasCloudPdf && isExpiredLegacyUrl(invoice.pdfUrl);

                return (
                  <tr key={invoice.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.has(invoice.id)}
                        onChange={(e) => handleSelectInvoice(index, invoice.id, e.target.checked, e)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <Link
                        href={`/facturas/${invoice.id}`}
                        style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {formatDateUTC(invoice.issueDate)}
                      </div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            ...getInvoiceTypeBadgeStyle(invoice.invoiceType),
                          }}
                        >
                          {invoice.invoiceType || 'Normal'}
                        </span>
                        {showCommunicationStatus &&
                          (invoice.communicatedAt ? (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                              title={`Comunicada el ${formatDateUTC(new Date(invoice.communicatedAt))}`}
                            >
                              ✅ Comunicada
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(245, 158, 11, 0.1)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                              }}
                            >
                              ⏳ Pte. Envío
                            </span>
                          ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div>
                          <Link
                            href={`/clientes/${invoice.clientId}`}
                            style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                          >
                            {formatClientFullName(invoice.client)}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--lime)', fontWeight: 700 }}>
                          {invoice.supplyPoint?.cups || '-'}
                        </div>
                        {invoice.supplyPoint && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '220px',
                            }}
                            title={[
                              invoice.supplyPoint.address,
                              invoice.supplyPoint.postalCode,
                              invoice.supplyPoint.city,
                              invoice.supplyPoint.province,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          >
                            {[
                              invoice.supplyPoint.address,
                              invoice.supplyPoint.postalCode,
                              invoice.supplyPoint.city,
                              invoice.supplyPoint.province,
                            ]
                              .filter(Boolean)
                              .join(', ') || '-'}
                          </div>
                        )}
                        {invoice.origin ? (
                          <div
                            style={{
                              fontSize: '0.65rem',
                              textTransform: 'uppercase',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              alignSelf: 'flex-start',
                              marginTop: '4px',
                            }}
                          >
                            Proc: {invoice.origin}
                          </div>
                        ) : (
                          <div
                            style={{
                              fontSize: '0.65rem',
                              textTransform: 'uppercase',
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              color: 'var(--text-muted)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              alignSelf: 'flex-start',
                              marginTop: '4px',
                            }}
                          >
                            Sin Procedencia
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {invoice.billingStart && invoice.billingEnd ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '125px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Desde:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {formatDateUTC(invoice.billingStart)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '125px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Hasta:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {formatDateUTC(invoice.billingEnd)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                          No especificado
                        </span>
                      )}
                    </td>
                    <td>
                      {invoice.totalMWh !== null && invoice.totalMWh !== undefined && invoice.totalMWh !== 0 ? (
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {(isAbono ? -Math.abs(invoice.totalMWh) : invoice.totalMWh).toLocaleString('es-ES')}{' '}
                          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>kWh</span>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: isAbono ? '#fb7185' : '#34d399' }}>
                      {(isAbono ? -Math.abs(invoice.totalAmount) : invoice.totalAmount).toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {!isClientRole && (
                          <Link href={`/facturas/${invoice.id}`} className="action-icon" title="Ver Ficha Detallada">
                            <Eye size={16} />
                          </Link>
                        )}
                        {hasCloudPdf && (
                          <a
                            href={invoice.pdfUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-icon"
                            title="Descargar PDF"
                          >
                            <Download size={16} />
                          </a>
                        )}
                        {hasCloudXml && (
                          <a
                            href={invoice.xmlUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-icon"
                            title="Descargar XML"
                          >
                            <FileCode2 size={16} />
                          </a>
                        )}

                        {!isClientRole && invoice.client.contactPhone && (
                          <>
                            <div style={{ height: '16px', width: '1px', background: 'var(--border)', margin: '0 4px' }} />
                            <a
                              href={`https://wa.me/34${invoice.client.contactPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="action-icon"
                              title="Enviar WhatsApp"
                            >
                              <MessageCircle size={16} style={{ color: '#22c55e' }} />
                            </a>
                            <a
                              href={`tel:${invoice.client.contactPhone.replace(/\D/g, '')}`}
                              className="action-icon"
                              title="Llamar"
                            >
                              <Phone size={16} style={{ color: '#60a5fa' }} />
                            </a>
                          </>
                        )}

                        {showPaymentButtons && (
                          <>
                            <div style={{ height: '16px', width: '1px', background: 'var(--border)', margin: '0 4px' }} />
                            <RequestPaymentButton invoiceId={invoice.id} type="transfer" disabled={!hasCloudPdf} />
                            <RequestPaymentButton invoiceId={invoice.id} type="overdue" disabled={!hasCloudPdf} />
                          </>
                        )}
                        {invoice.communicatedAt && canForceResend && (
                          <ForceResendButton invoiceId={invoice.id} disabled={!hasCloudPdf} />
                        )}
                      </div>
                      {!hasCloudPdf && (
                        <div
                          style={{
                            color: isLegacyPdf ? '#f59e0b' : 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontStyle: 'italic',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title={
                            isLegacyPdf
                              ? 'Enlace antiguo de Airtable caducado. Puedes adjuntar el PDF definitivo desde Importar Facturas.'
                              : 'Aún no se ha subido el PDF a la nube (R2).'
                          }
                        >
                          {isLegacyPdf ? (
                            <>
                              <AlertTriangle size={12} /> PDF legado caducado
                            </>
                          ) : (
                            'Pendiente de PDF'
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {isLoading ? 'Cargando facturas...' : 'No se encontraron facturas.'}
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
          onItemsPerPageChange={(n) => {
            setItemsPerPage(n);
            resetSelectionAndFirstPage();
          }}
        />
      </div>
    </div>
  );
}
