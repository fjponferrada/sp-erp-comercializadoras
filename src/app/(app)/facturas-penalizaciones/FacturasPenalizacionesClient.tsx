'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Download,
  CheckCircle,
  Mail,
  Loader2,
  Receipt,
  Clock,
  Wallet,
  AlertCircle,
  FileSpreadsheet,
  Archive,
  RotateCcw,
} from 'lucide-react';
import DeletePenaltyButton from '@/components/DeletePenaltyButton';
import PaginationFooter from '@/components/PaginationFooter';
import {
  getPaginatedPenaltyInvoicesAction,
  sendSelectedPenaltyInvoicesAction,
  markSelectedPenaltyInvoicesAsComunicatedAction,
  updatePenaltyPaymentStatusAction,
} from '@/app/actions/penaltyInvoiceActions';
import type { PenaltyInvoicesKpiSummary } from '@/lib/penaltyInvoicesServer';

export default function FacturasPenalizacionesClient({
  initialInvoices,
  initialTotalCount,
  initialKpis,
  userRole,
}: {
  initialInvoices: any[];
  initialTotalCount: number;
  initialKpis: PenaltyInvoicesKpiSummary;
  userRole: string;
}) {
  const canManage = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const [invoices, setInvoices] = useState<any[]>(initialInvoices);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [kpis, setKpis] = useState<PenaltyInvoicesKpiSummary>(initialKpis);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [paymentFilter, setPaymentFilter] = useState('TODOS');
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isFirstRender = useRef(true);

  const reloadData = async (overridePage?: number) => {
    setFetching(true);
    try {
      const res = await getPaginatedPenaltyInvoicesAction({
        page: overridePage ?? page,
        itemsPerPage,
        searchTerm,
        statusFilter,
        paymentFilter,
        typeFilter,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });
      if (res.success) {
        setInvoices(res.invoices || []);
        setTotalCount(res.totalCount || 0);
        if (res.kpis) setKpis(res.kpis);
      }
    } catch (err) {
      console.error('Error fetching penalty invoices:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (
      isFirstRender.current &&
      page === 1 &&
      itemsPerPage === 100 &&
      searchTerm === '' &&
      statusFilter === 'TODOS' &&
      paymentFilter === 'TODOS' &&
      typeFilter === 'TODOS' &&
      !dateFrom &&
      !dateTo
    ) {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;

    const timer = setTimeout(() => {
      reloadData();
    }, 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, itemsPerPage, searchTerm, statusFilter, paymentFilter, typeFilter, dateFrom, dateTo]);

  const showToast = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  };

  const toggleAll = () => {
    if (selectedIds.size === invoices.length && invoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.id)));
    }
  };

  const toggleOne = (id: string, index: number, shiftKey: boolean) => {
    const newSet = new Set(selectedIds);
    if (shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        if (invoices[i]) newSet.add(invoices[i].id);
      }
    } else {
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
    }
    setSelectedIds(newSet);
    setLastSelectedIndex(index);
  };

  const handleMarkAsCommunicated = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `¿Seguro que quieres marcar ${selectedIds.size} facturas como comunicadas SIN enviar email?`
      )
    )
      return;

    setLoading(true);
    const res = await markSelectedPenaltyInvoicesAsComunicatedAction(Array.from(selectedIds));
    setLoading(false);

    if (res.success) {
      showToast(res.message || 'Facturas marcadas como comunicadas.');
      setSelectedIds(new Set());
      await reloadData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `¿Enviar por email (con PDF adjunto) las ${selectedIds.size} facturas seleccionadas?`
      )
    )
      return;

    setLoading(true);
    const res = await sendSelectedPenaltyInvoicesAction(Array.from(selectedIds));
    setLoading(false);

    if (res.success) {
      showToast(res.message || 'Envío completado.');
      setSelectedIds(new Set());
      await reloadData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handlePaymentStatusChange = async (
    ids: string[],
    nextPaymentStatus: 'PENDIENTE' | 'PAGADA' | 'IMPAGADA'
  ) => {
    setLoading(true);
    const res = await updatePenaltyPaymentStatusAction(ids, nextPaymentStatus);
    setLoading(false);
    if (res.success) {
      showToast(res.message || 'Estado de cobro actualizado.');
      setSelectedIds(new Set());
      await reloadData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleExportExcel = async () => {
    setExportingXlsx(true);
    try {
      const res = await fetch('/api/facturas-penalizaciones/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchTerm,
          statusFilter,
          paymentFilter,
          typeFilter,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          invoiceIds: selectedIds.size > 0 ? Array.from(selectedIds) : undefined,
        }),
      });
      if (!res.ok) throw new Error('Error generando archivo Excel');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'facturas_penalizaciones.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'No se pudo exportar Excel');
    } finally {
      setExportingXlsx(false);
    }
  };

  const handleDownloadZip = async () => {
    if (selectedIds.size === 0) return;
    setDownloadingZip(true);
    try {
      const res = await fetch('/api/facturas-penalizaciones/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error || 'Error descargando ZIP de PDFs');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'facturas_penalizaciones_seleccionadas.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error al descargar ZIP');
    } finally {
      setDownloadingZip(false);
    }
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    statusFilter !== 'TODOS' ||
    paymentFilter !== 'TODOS' ||
    typeFilter !== 'TODOS' ||
    dateFrom !== '' ||
    dateTo !== '';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setPaymentFilter('TODOS');
    setTypeFilter('TODOS');
    setDateFrom('');
    setDateTo('');
    setSelectedIds(new Set());
    setPage(1);
  };

  const getPaymentBadgeStyle = (paymentStatus?: string) => {
    switch (paymentStatus) {
      case 'PAGADA':
        return {
          background: 'rgba(16, 185, 129, 0.14)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        };
      case 'IMPAGADA':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
      case 'ANULADA':
        return {
          background: 'rgba(107, 114, 128, 0.15)',
          color: '#9ca3af',
          border: '1px solid rgba(107, 114, 128, 0.3)',
        };
      default:
        return {
          background: 'rgba(245, 158, 11, 0.14)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.28)',
        };
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* KPIs Financieros y Operativos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[
          {
            label: 'Facturación Neta (c/IVA)',
            value: kpis.totalNetWithVat.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR',
            }),
            sub: `Base imponible neta: ${kpis.totalNetBase.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR',
            })}`,
            color: 'var(--info)',
            icon: Receipt,
          },
          {
            label: 'Sin Comunicar',
            value: String(kpis.pendingCommunicateCount),
            sub: `${kpis.totalCount} documentos en filtro`,
            color: 'var(--warning)',
            icon: Clock,
          },
          {
            label: 'Importe Cobrado',
            value: kpis.paidAmount.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR',
            }),
            sub: `${kpis.paidCount} facturas pagadas`,
            color: 'var(--success)',
            icon: Wallet,
          },
          {
            label: 'Pendiente / Impagado',
            value: kpis.pendingCollectAmount.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR',
            }),
            sub: `${kpis.pendingCollectCount} facturas abiertas`,
            color: 'var(--danger)',
            icon: AlertCircle,
          },
        ].map((k, idx) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className={`card-stat animate-fade-in-up delay-${(idx + 1) * 100}`}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {k.label}
                </p>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={15} color={k.color} />
                </div>
              </div>
              <div
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  color: k.color,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.1,
                }}
              >
                {k.value}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                {k.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de Búsqueda, Filtros y Acciones Masivas */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div style={{ position: 'relative', flex: '1', minWidth: '260px', maxWidth: '480px' }}>
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
                placeholder="Buscar por Nº Factura, Cliente, CIF, Contrato o CUPS..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ paddingLeft: '36px', fontSize: '0.82rem', width: '100%' }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {message && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 mr-2">
                  <CheckCircle size={14} /> {message}
                </span>
              )}

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportingXlsx}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5"
              >
                {exportingXlsx ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                {selectedIds.size > 0
                  ? `Excel (${selectedIds.size})`
                  : 'Exportar Excel'}
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={downloadingZip || selectedIds.size === 0}
                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 disabled:opacity-50"
                title="Descargar PDFs seleccionados en un archivo .ZIP"
              >
                {downloadingZip ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Archive size={15} />
                )}
                Descargar ZIP ({selectedIds.size})
              </button>

              {canManage && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handlePaymentStatusChange(Array.from(selectedIds), 'PAGADA')
                  }
                  disabled={loading}
                  className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Wallet size={15} />
                  Marcar Pagadas ({selectedIds.size})
                </button>
              )}

              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={handleMarkAsCommunicated}
                    disabled={loading || selectedIds.size === 0}
                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {loading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle size={15} />
                    )}
                    Marcar Comunicadas ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading || selectedIds.size === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {loading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Mail size={15} />
                    )}
                    Comunicar ({selectedIds.size})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Fila Secundaria de Filtros */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-input"
              style={{ width: '175px', fontSize: '0.78rem' }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="TODOS">Comunicación (Todas)</option>
              <option value="EMITIDA">Sin comunicar</option>
              <option value="COMUNICADA">Comunicadas</option>
            </select>

            <select
              className="form-input"
              style={{ width: '175px', fontSize: '0.78rem' }}
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="TODOS">Estado Cobro (Todos)</option>
              <option value="PENDIENTE">Pendiente de cobro</option>
              <option value="PAGADA">Pagada</option>
              <option value="IMPAGADA">Impagada / Devuelta</option>
              <option value="ANULADA">Anulada / Rectificada</option>
            </select>

            <select
              className="form-input"
              style={{ width: '170px', fontSize: '0.78rem' }}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="TODOS">Tipo Doc. (Todos)</option>
              <option value="PENALIZACION">Facturas Penalización</option>
              <option value="ABONO">Abonos Rectificativos</option>
            </select>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Desde:</span>
              <input
                type="date"
                className="form-input"
                style={{ fontSize: '0.78rem', padding: '5px 8px', height: 'auto' }}
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Hasta:</span>
              <input
                type="date"
                className="form-input"
                style={{ fontSize: '0.78rem', padding: '5px 8px', height: 'auto' }}
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-ghost"
                style={{
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RotateCcw size={13} /> Limpiar
              </button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {fetching ? 'Actualizando...' : `${totalCount} documentos`}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {canManage && (
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === invoices.length && invoices.length > 0}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                )}
                <th>Factura</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>CUPS / Contrato</th>
                <th>Producto</th>
                <th>Base / IVA (21%)</th>
                <th>Total (c/IVA)</th>
                <th>Cobro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 10 : 9}
                    style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No se encontraron facturas de penalización con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                invoices.map((inv, index) => {
                  const isAbono = inv.invoiceType === 'ABONO';
                  const rawTotal = Math.abs(Number(inv.amount || 0));
                  const rawBase =
                    inv.baseAmount !== null && inv.baseAmount !== undefined
                      ? Math.abs(Number(inv.baseAmount))
                      : Math.round((rawTotal / 1.21) * 100) / 100;
                  const rawTax =
                    inv.taxAmount !== null && inv.taxAmount !== undefined
                      ? Math.abs(Number(inv.taxAmount))
                      : Math.round((rawTotal - rawBase) * 100) / 100;

                  const sign = isAbono ? -1 : 1;
                  const recipientEmail =
                    inv.client?.invoiceEmail || inv.client?.contactEmail || '';

                  return (
                    <tr
                      key={inv.id}
                      style={{
                        background: selectedIds.has(inv.id)
                          ? 'rgba(99, 102, 241, 0.06)'
                          : '',
                        transition: 'background 0.18s ease',
                      }}
                    >
                      {canManage && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(inv.id)}
                            onChange={(e: any) => {
                              e.stopPropagation();
                              toggleOne(inv.id, index, Boolean(e.nativeEvent?.shiftKey));
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                      )}

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: isAbono ? '#f87171' : 'var(--text-primary)',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '0.82rem',
                            }}
                          >
                            {inv.invoiceNumber}
                          </span>
                          {isAbono && (
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 6px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                              }}
                            >
                              ABONO
                            </span>
                          )}
                        </div>
                        {inv.rectifiedPenalty?.invoiceNumber && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Rectif.: {inv.rectifiedPenalty.invoiceNumber}
                          </div>
                        )}
                        <div style={{ marginTop: '4px' }}>
                          {inv.status === 'COMUNICADA' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.64rem',
                                background: 'rgba(34, 197, 94, 0.18)',
                                color: '#4ade80',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                padding: '1px 7px',
                                borderRadius: '12px',
                              }}
                              title={
                                inv.communicatedAt
                                  ? `Comunicada el ${new Date(
                                      inv.communicatedAt
                                    ).toLocaleString('es-ES')}`
                                  : 'Comunicada'
                              }
                            >
                              <CheckCircle size={10} /> Comunicada
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.64rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              Sin comunicar
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ fontSize: '0.8rem' }}>
                        {new Date(inv.issueDate).toLocaleDateString('es-ES')}
                      </td>

                      <td>
                        <a
                          href={`/clientes/${inv.clientId}`}
                          className="hover:text-amber-400 hover:underline transition-colors"
                          style={{ fontWeight: 600, fontSize: '0.84rem' }}
                        >
                          {inv.client?.businessName || 'Cliente'}
                        </a>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                          {inv.client?.vatNumber}{' '}
                          {recipientEmail ? `· ${recipientEmail}` : '· Sin email'}
                        </div>
                      </td>

                      <td>
                        <a
                          href={`/contratos/${inv.contractId}`}
                          className="hover:text-amber-500 hover:underline transition-colors font-mono"
                          style={{ fontSize: '0.76rem' }}
                        >
                          {inv.supplyPoint?.cups}
                        </a>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {inv.contract?.contractCode || '-'}
                        </div>
                      </td>

                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {inv.contract?.product?.name || '-'}
                      </td>

                      <td
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        <div>{(sign * rawBase).toFixed(2)} €</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          IVA: {(sign * rawTax).toFixed(2)} €
                        </div>
                      </td>

                      <td
                        style={{
                          fontWeight: 700,
                          fontFamily: "'JetBrains Mono', monospace",
                          color: isAbono ? '#f87171' : 'var(--text-primary)',
                        }}
                      >
                        {(sign * rawTotal).toFixed(2)} €
                      </td>

                      <td>
                        {isAbono || inv.paymentStatus === 'ANULADA' ? (
                          <span
                            className="badge"
                            style={{
                              ...getPaymentBadgeStyle('ANULADA'),
                              fontSize: '0.68rem',
                            }}
                          >
                            {isAbono ? 'Rectificativa' : 'Anulada'}
                          </span>
                        ) : canManage ? (
                          <select
                            value={inv.paymentStatus || 'PENDIENTE'}
                            onChange={(e) =>
                              handlePaymentStatusChange(
                                [inv.id],
                                e.target.value as 'PENDIENTE' | 'PAGADA' | 'IMPAGADA'
                              )
                            }
                            disabled={loading}
                            style={{
                              ...getPaymentBadgeStyle(inv.paymentStatus || 'PENDIENTE'),
                              borderRadius: '999px',
                              padding: '3px 8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option
                              value="PENDIENTE"
                              style={{ background: '#111827', color: '#fbbf24' }}
                            >
                              Pendiente
                            </option>
                            <option
                              value="PAGADA"
                              style={{ background: '#111827', color: '#34d399' }}
                            >
                              Pagada
                            </option>
                            <option
                              value="IMPAGADA"
                              style={{ background: '#111827', color: '#f87171' }}
                            >
                              Impagada
                            </option>
                          </select>
                        ) : (
                          <span
                            className="badge"
                            style={{
                              ...getPaymentBadgeStyle(inv.paymentStatus),
                              fontSize: '0.7rem',
                            }}
                          >
                            {inv.paymentStatus || 'PENDIENTE'}
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {inv.pdfUrl ? (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary"
                              style={{
                                padding: '5px 10px',
                                display: 'inline-flex',
                                gap: '5px',
                                alignItems: 'center',
                                fontSize: '0.75rem',
                              }}
                            >
                              <Download size={13} /> PDF
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                          {canManage && (
                            <DeletePenaltyButton
                              id={inv.id}
                              invoiceNumber={inv.invoiceNumber}
                              status={inv.status}
                              invoiceType={inv.invoiceType}
                              paymentStatus={inv.paymentStatus}
                              hasRectifications={Boolean(
                                inv.rectifications && inv.rectifications.length > 0
                              )}
                              userRole={userRole}
                              onCompleted={(msg) => {
                                if (msg) showToast(msg);
                                reloadData();
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationFooter
          currentPage={page}
          itemsPerPage={itemsPerPage}
          totalItems={totalCount}
          itemName="facturas"
          onPageChange={setPage}
          onItemsPerPageChange={(val) => {
            setItemsPerPage(val);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
