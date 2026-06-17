'use client';

import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, Eye, MessageCircle, Phone } from 'lucide-react';
import Link from 'next/link';
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
}

interface FacturasClientProps {
  initialInvoices: Invoice[];
  pendingCount: number;
  initialTotalCount: number;
}

export default function FacturasClient({ initialInvoices, pendingCount, initialTotalCount }: FacturasClientProps) {
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
  }, [searchTerm, filterType, itemsPerPage, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por Nº Factura, Nombre, CIF o CUPS..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
          />
        </div>
        <div className="relative w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-rose-500 appearance-none"
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
            className="bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 cursor-pointer"
            title="Fecha Desde"
          />
          <span className="text-slate-500">-</span>
          <input 
            type="date" 
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
            className="bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 cursor-pointer"
            title="Fecha Hasta"
          />
        </div>
        <SendInvoicesButton pendingCount={pendingCount} />
        <button className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
          <Download size={18} />
          Exportar
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 whitespace-nowrap">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Nº Factura / Emisión</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Suministro (CUPS, Dir, Proc)</th>
                <th className="px-6 py-4">Periodo Facturado</th>
                <th className="px-6 py-4">Consumo</th>
                <th className="px-6 py-4 text-right">Total €</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{invoice.invoiceNumber}</div>
                    <div className="text-xs text-slate-400 mt-1">{formatDateUTC(invoice.issueDate)}</div>
                    <div className="mt-1.5">
                      <span className={`text-[10px] uppercase border px-2 py-0.5 rounded-full ${
                        invoice.invoiceType === 'Normal' ? 'bg-slate-800/50 border-slate-700 text-slate-300' :
                        invoice.invoiceType === 'Abono' ? 'bg-indigo-900/30 border-indigo-500/30 text-indigo-400' :
                        invoice.invoiceType === 'Rectificativa' ? 'bg-rose-900/30 border-rose-500/30 text-rose-400' :
                        'bg-slate-800/50 border-slate-700 text-slate-400'
                      }`}>
                        {invoice.invoiceType || 'Normal'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link href={`/clientes/${invoice.clientId}`} className="font-medium text-white hover:text-rose-400 transition-colors">
                          {invoice.client.businessName || `${invoice.client.firstName} ${invoice.client.lastName}`}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-mono text-lime-400 font-bold">{invoice.supplyPoint?.cups || '-'}</div>
                      {invoice.supplyPoint && (
                        <div className="text-xs text-slate-400 truncate max-w-[200px]" title={[invoice.supplyPoint.address, invoice.supplyPoint.postalCode, invoice.supplyPoint.city, invoice.supplyPoint.province].filter(Boolean).join(', ')}>
                          {[invoice.supplyPoint.address, invoice.supplyPoint.postalCode, invoice.supplyPoint.city, invoice.supplyPoint.province].filter(Boolean).join(', ') || '-'}
                        </div>
                      )}
                      {invoice.origin ? (
                        <div className="text-[10px] uppercase bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded inline-block self-start mt-1">
                          Proc: {invoice.origin}
                        </div>
                      ) : (
                        <div className="text-[10px] uppercase bg-slate-800/50 border border-slate-700/50 text-slate-500 px-2 py-0.5 rounded inline-block self-start mt-1">
                          Sin Procedencia
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {(invoice as any).desde && (invoice as any).hasta ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between w-32"><span className="text-slate-500">Desde:</span> <span className="text-slate-300 font-medium">{formatDateUTC((invoice as any).desde)}</span></div>
                        <div className="flex justify-between w-32"><span className="text-slate-500">Hasta:</span> <span className="text-slate-300 font-medium">{formatDateUTC((invoice as any).hasta)}</span></div>
                      </div>
                    ) : invoice.billingStart && invoice.billingEnd ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between w-32"><span className="text-slate-500">Desde:</span> <span className="text-slate-300 font-medium">{formatDateUTC(invoice.billingStart)}</span></div>
                        <div className="flex justify-between w-32"><span className="text-slate-500">Hasta:</span> <span className="text-slate-300 font-medium">{formatDateUTC(invoice.billingEnd)}</span></div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">No especificado</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {invoice.totalMWh ? (
                      <span className="font-medium text-slate-200">{(invoice.invoiceType === 'Abono' ? -Math.abs(invoice.totalMWh) : invoice.totalMWh).toLocaleString('es-ES')} <span className="text-slate-400 font-normal">kWh</span></span>
                    ) : '-'}
                  </td>
                  <td className={`px-6 py-4 text-right font-medium ${invoice.invoiceType === 'Abono' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {(invoice.invoiceType === 'Abono' ? -Math.abs(invoice.totalAmount) : invoice.totalAmount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => window.location.href = `/facturas/${invoice.id}`} className="btn-ghost" style={{ padding: '6px' }} title="Ver Ficha">
                        <Eye size={16} className="text-lime-400" />
                      </button>
                      {invoice.pdfUrl && (
                        <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ padding: '6px' }} title="Descargar PDF">
                          <Download size={16} className="text-indigo-400" />
                        </a>
                      )}
                      
                      {invoice.client.contactPhone && (
                        <>
                          <div className="h-4 w-px bg-slate-700 mx-1"></div>
                          <a href={`https://wa.me/34${invoice.client.contactPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ padding: '6px' }} title="Enviar WhatsApp">
                            <MessageCircle size={16} className="text-green-500" />
                          </a>
                          <a href={`tel:${invoice.client.contactPhone.replace(/\D/g, '')}`} className="btn-ghost" style={{ padding: '6px' }} title="Llamar">
                            <Phone size={16} className="text-blue-400" />
                          </a>
                        </>
                      )}

                      <div className="h-4 w-px bg-slate-700 mx-1"></div>
                      <RequestPaymentButton invoiceId={invoice.id} type="transfer" />
                      <RequestPaymentButton invoiceId={invoice.id} type="overdue" />
                    </div>
                    {!invoice.pdfUrl && <div className="text-slate-500 text-xs italic mt-1">Pendiente de PDF</div>}
                  </td>
                </tr>
              ))}
              
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
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
