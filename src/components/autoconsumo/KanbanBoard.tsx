'use client';

import React, { useState } from 'react';
import { updateSolarQuoteStatusAction } from '@/app/actions/solarActions';
import Link from 'next/link';
import { Zap, Sun, MapPin, Euro, FileText, CheckCircle } from 'lucide-react';

const COLUMNS = [
  { id: 'VIABILIDAD', title: '1. Viabilidad', color: 'border-slate-500' },
  { id: 'OFERTA', title: '2. Oferta Enviada', color: 'border-indigo-500' },
  { id: 'INSTALACION', title: '3. En Instalación', color: 'border-amber-500' },
  { id: 'CIE', title: '4. Legalización (CIE)', color: 'border-rose-500' },
  { id: 'COMPLETADO', title: '5. Completado', color: 'border-emerald-500' }
];

export default function KanbanBoard({ initialQuotes }: { initialQuotes: any[] }) {
  const [quotes, setQuotes] = useState(initialQuotes);

  const handleDragStart = (e: React.DragEvent, quoteId: string) => {
    e.dataTransfer.setData('quoteId', quoteId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const quoteId = e.dataTransfer.getData('quoteId');
    if (!quoteId) return;

    // Optimistic UI Update
    setQuotes(quotes.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));

    // Server Update
    await updateSolarQuoteStatusAction(quoteId, newStatus);
  };

  return (
    <div className="flex h-full gap-6 overflow-x-auto pb-4">
      {COLUMNS.map(column => (
        <div 
          key={column.id}
          className="flex-shrink-0 w-80 flex flex-col bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.id)}
        >
          {/* Header de la columna */}
          <div className={`p-4 border-t-4 ${column.color} bg-slate-800/80`}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">{column.title}</h3>
              <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-1 rounded-full">
                {quotes.filter(q => q.status === column.id).length}
              </span>
            </div>
          </div>

          {/* Lista de Tarjetas */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar">
            {quotes.filter(q => q.status === column.id).map(quote => (
              <div 
                key={quote.id}
                draggable
                onDragStart={(e) => handleDragStart(e, quote.id)}
                className="bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-xl p-4 cursor-grab active:cursor-grabbing shadow-sm transition-all"
              >
                <Link href={`/autoconsumo/${quote.id}`} className="block">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-slate-400">{quote.quoteNumber}</span>
                    {quote.peakPowerKwp > 0 && (
                      <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded flex items-center gap-1">
                        <Sun size={12} /> {quote.peakPowerKwp} kWp
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-200 mb-1">{quote.clientName} {quote.clientLastName || ''}</h4>
                  
                  {(quote.city || quote.province) && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-3">
                      <MapPin size={12} /> {quote.city || quote.province}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-700/50 mt-2">
                    <div className="text-xs font-medium text-slate-300 flex items-center gap-1">
                      <Euro size={12} className="text-emerald-400" />
                      {quote.totalBudget > 0 ? quote.totalBudget.toLocaleString('es-ES') + ' €' : 'Pte. Presupuesto'}
                    </div>
                    {column.id === 'COMPLETADO' ? (
                      <CheckCircle size={16} className="text-emerald-500" />
                    ) : (
                      <FileText size={16} className="text-indigo-400" />
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
