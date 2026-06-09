'use client';

import React, { useState, useMemo } from 'react';
import { Package, Plus, Search, Filter, Info } from 'lucide-react';
import PaginationFooter from '@/components/PaginationFooter';
import ProductModal from './ProductModal';

export default function ProductosClient({ initialProducts }: { initialProducts: any[] }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterTariff, setFilterTariff] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleNew = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const filtered = useMemo(() => {
    return initialProducts.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === '' || p.type === filterType;
      const matchTariff = filterTariff === '' || p.tariff === filterTariff;
      return matchSearch && matchType && matchTariff;
    });
  }, [initialProducts, search, filterType, filterTariff]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="text-indigo-500" />
            Catálogo de Productos
          </h1>
          <p className="text-slate-400 mt-1">Gestiona las tarifas y diccionarios de precios</p>
        </div>
        <button 
          onClick={handleNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors font-medium"
        >
          <Plus size={18} />
          Nuevo Producto
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <select 
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-700 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none min-w-[150px]"
          >
            <option value="">Tipo de Producto</option>
            <option value="Fijo">Fijo</option>
            <option value="Indexado">Indexado</option>
          </select>

          <select 
            value={filterTariff}
            className="bg-slate-900 border border-slate-700 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none min-w-[120px]"
            onChange={(e) => {
              setFilterTariff(e.target.value); setPage(1);
            }}
          >
            <option value="">Tarifa</option>
            <option value="2.0TD">2.0TD</option>
            <option value="3.0TD">3.0TD</option>
            <option value="6.1TD">6.1TD</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Producto</th>
                <th className="px-6 py-4 font-semibold">Tarifa</th>
                <th className="px-6 py-4 font-semibold">Tipo</th>
                <th className="px-6 py-4 font-semibold text-center">Precios / Fee</th>
                <th className="px-6 py-4 font-semibold text-center">Comisión Base</th>
                <th className="px-6 py-4 font-semibold text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {paginated.map((product) => (
                <tr 
                  key={product.id}
                  onClick={() => handleEdit(product)}
                  className="hover:bg-slate-700/20 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                      {product.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {product.tariff || 'Sin Tarifa'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      product.type === 'Indexado' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {product.type === 'Indexado' ? 'Indexado' : 'Fijo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div 
                      className="inline-flex items-center justify-center p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors relative group/tooltip"
                      title={product.type === 'Indexado' 
                        ? `Fee: ${product.fee ?? 0} €/MWh\nIP: ${product.airtableData?.['IP'] || '-'}\nFC: ${product.airtableData?.['FC'] || '-'}\nExcedentes: ${product.pexc ?? '-'}`
                        : `Energía:\nP1: ${product.p1e ?? '-'}, P2: ${product.p2e ?? '-'}, P3: ${product.p3e ?? '-'}, P4: ${product.p4e ?? '-'}, P5: ${product.p5e ?? '-'}, P6: ${product.p6e ?? '-'}\n\nPotencia:\nP1: ${product.p1p ?? '-'}, P2: ${product.p2p ?? '-'}, P3: ${product.p3p ?? '-'}, P4: ${product.p4p ?? '-'}, P5: ${product.p5p ?? '-'}, P6: ${product.p6p ?? '-'}`
                      }
                    >
                      <Info size={18} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${product.commissionType === 'MARGIN_PERCENTAGE' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'}`}>
                      {product.commissionType === 'MARGIN_PERCENTAGE' ? '% sobre Margen' : 'Por Tramos (Potencia)'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {product.isAvailableCrm ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Activo
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        Oculto
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        {paginated.length === 0 && (
          <div className="py-12 text-center bg-slate-800/20 rounded-2xl border border-slate-800 border-dashed mt-6">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No hay productos en el catálogo.</p>
            <button className="mt-4 text-indigo-400 hover:text-indigo-300 font-medium text-sm" onClick={handleNew}>
              Crear tu primer producto
            </button>
          </div>
        )}
      <div className="mt-6 rounded-xl overflow-hidden border border-slate-700">
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
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
