import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationFooterProps {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  itemName?: string; // e.g. "facturas", "clientes"
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
}

export default function PaginationFooter({
  currentPage,
  itemsPerPage,
  totalItems,
  itemName = 'registros',
  onPageChange,
  onItemsPerPageChange
}: PaginationFooterProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  return (
    <div className="bg-slate-900/30 border-t border-slate-700 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span>Mostrar</span>
        <select 
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-rose-500"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>{itemName} por página</span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">
          Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}
        </span>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="px-3 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300 font-medium">
            {currentPage} / {totalPages}
          </div>
          <button 
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
