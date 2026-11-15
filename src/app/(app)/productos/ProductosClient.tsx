'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Package, Plus, Search, Info, Globe } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import PaginationFooter from '@/components/PaginationFooter';
import ProductModal from './ProductModal';
import Topbar from '@/components/Topbar';

const TARIFF_LIST = ['2.0TD', '3.0TD', '3.0TDVE', '6.1TD', '6.1TDVE', '6.2TD', '6.3TD', '6.4TD'];

export default function ProductosClient({ initialProducts }: { initialProducts: any[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role || 'COMERCIAL';
  const canEdit = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);

  const [products, setProducts] = useState<any[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTariff, setFilterTariff] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    if (!canEdit) return;
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = (p.name || '').toLowerCase().includes(search.toLowerCase());

      let matchType = true;
      if (filterType === 'FIXED') {
        const isIdx = p.pricingModel === 'INDEXED' || (!p.pricingModel && (p.type || '').toLowerCase().includes('index'));
        matchType = !isIdx;
      } else if (filterType === 'INDEXED') {
        matchType = p.pricingModel === 'INDEXED' || (p.type || '').toLowerCase().includes('index');
      }

      const matchTariff = filterTariff === '' || p.tariff === filterTariff;

      let matchStatus = true;
      if (filterStatus === 'CRM') matchStatus = Boolean(p.isAvailableCrm);
      else if (filterStatus === 'WEB') matchStatus = Boolean(p.isAvailableWeb);
      else if (filterStatus === 'HIDDEN') matchStatus = !p.isAvailableCrm;

      return matchSearch && matchType && matchTariff && matchStatus;
    });
  }, [products, search, filterType, filterTariff, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Topbar title="Catálogo de Productos" subtitle="Gestiona las tarifas y diccionarios de precios" />

      <div
        style={{
          padding: '24px 32px',
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          paddingBottom: '120px',
        }}
      >
        {canEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleNew}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.875rem', gap: '8px' }}
            >
              <Plus size={18} />
              Nuevo Producto
            </button>
          </div>
        )}

        {/* Filters */}
        <div
          className="card animate-fade-in-up"
          style={{ padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="form-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
              className="form-input min-w-[150px]"
            >
              <option value="">Modalidad (Todas)</option>
              <option value="FIXED">Fijo</option>
              <option value="INDEXED">Indexado</option>
            </select>

            <select
              value={filterTariff}
              className="form-input min-w-[130px]"
              onChange={(e) => {
                setFilterTariff(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tarifa (Todas)</option>
              {TARIFF_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {canEdit && (
              <select
                value={filterStatus}
                className="form-input min-w-[175px]"
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Visibilidad (Todos)</option>
                <option value="CRM">Disponibles en CRM</option>
                <option value="WEB">Visibles en Web</option>
                <option value="HIDDEN">Ocultos / Archivados</option>
              </select>
            )}
          </div>
        </div>

        <div className="card animate-fade-in-up delay-200" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Tarifa</th>
                  <th>Modalidad</th>
                  <th style={{ textAlign: 'center' }}>Precios / Fee</th>
                  <th style={{ textAlign: 'center' }}>Comisión Base</th>
                  <th style={{ textAlign: 'right' }}>Visibilidad</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((product) => {
                  const isIndexed =
                    product.pricingModel === 'INDEXED' || (product.type || '').toLowerCase().includes('index');
                  const tooltipText = isIndexed
                    ? `Fee: ${product.fee ?? 0} €/MWh${
                        canEdit
                          ? `\nMargen FC: ${product.marginFC ?? '-'} €/MWh\nIP1: ${product.ip1 ?? '-'} €/kW/año`
                          : ''
                      }\nExcedentes: ${product.pexc ?? '-'}`
                    : `Energía (€/kWh):\nP1: ${product.p1e ?? '-'}, P2: ${product.p2e ?? '-'}, P3: ${product.p3e ?? '-'}${
                        product.tariff !== '2.0TD'
                          ? `, P4: ${product.p4e ?? '-'}, P5: ${product.p5e ?? '-'}, P6: ${product.p6e ?? '-'}`
                          : ''
                      }\n\nPotencia (€/kW/año):\nP1: ${product.p1p ?? '-'}, P2: ${product.p2p ?? '-'}${
                        product.tariff !== '2.0TD'
                          ? `, P3: ${product.p3p ?? '-'}, P4: ${product.p4p ?? '-'}, P5: ${product.p5p ?? '-'}, P6: ${product.p6p ?? '-'}`
                          : ''
                      }`;

                  return (
                    <tr
                      key={product.id}
                      onClick={() => handleEdit(product)}
                      className="hover:bg-slate-700/20 transition-colors cursor-pointer group"
                    >
                      <td style={{ fontWeight: 500, color: '#fff' }}>
                        <div
                          style={{ transition: 'color 0.2s', cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--lime)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#fff')}
                        >
                          {product.name}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-draft" style={{ color: 'var(--info)', borderColor: 'var(--info)' }}>
                          {product.tariff || 'Sin Tarifa'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${isIndexed ? 'badge-draft' : 'badge-active'}`}
                          style={isIndexed ? { color: 'var(--warning)', borderColor: 'var(--warning)' } : {}}
                        >
                          {isIndexed ? 'Indexado' : 'Fijo'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div
                          className="inline-flex items-center justify-center p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors relative group/tooltip"
                          title={tooltipText}
                        >
                          <Info size={18} />
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge badge-draft"
                          style={
                            product.commissionType === 'MARGIN_PERCENTAGE'
                              ? { color: '#a855f7', borderColor: '#a855f7' }
                              : { color: '#f97316', borderColor: '#f97316' }
                          }
                        >
                          {product.commissionType === 'MARGIN_PERCENTAGE' ? '% sobre Margen' : 'Por Tramos (Potencia)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            justifyContent: 'flex-end',
                            flexWrap: 'wrap',
                          }}
                        >
                          {product.isAvailableCrm ? (
                            <span className="badge badge-active">CRM</span>
                          ) : (
                            <span className="badge badge-draft">Oculto</span>
                          )}
                          {product.isAvailableWeb && (
                            <span
                              className="badge badge-draft"
                              style={{
                                color: '#38bdf8',
                                borderColor: 'rgba(56, 189, 248, 0.45)',
                                background: 'rgba(56, 189, 248, 0.12)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Visible en el catálogo de la Web Pública (API)"
                            >
                              <Globe size={12} />
                              Web
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {paginated.length === 0 && (
          <div className="card animate-fade-in-up" style={{ padding: '48px', textAlign: 'center' }}>
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No hay productos que coincidan con los filtros aplicados.</p>
            {canEdit && (
              <button className="mt-4 font-medium text-sm" style={{ color: 'var(--lime)' }} onClick={handleNew}>
                Crear nuevo producto
              </button>
            )}
          </div>
        )}
        <div
          className="card animate-fade-in-up delay-300"
          style={{ padding: '16px 24px', display: 'flex', justifyContent: 'center' }}
        >
          <PaginationFooter
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            itemName="productos"
            onPageChange={setPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>

        {isModalOpen && (
          <ProductModal
            product={editingProduct}
            onClose={() => setIsModalOpen(false)}
            onSaved={() => {
              setIsModalOpen(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
