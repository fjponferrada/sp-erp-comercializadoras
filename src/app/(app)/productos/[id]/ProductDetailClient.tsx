'use client';

import React from 'react';
import Topbar from '@/components/Topbar';

export default function ProductDetailClient({ product }: { product: any }) {
  const formatVal = (val: any) => val !== null && val !== undefined ? val.toString().replace('.', ',') : '-';

  return (
    <>
      <Topbar title={`Producto: ${product.name}`} subtitle="Detalle de configuración y precios" />
      
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Información General */}
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-700/50 pb-4">Información General</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Tarifa</label>
                <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-700/50 text-slate-200 inline-block font-medium">
                  {product.tariff || '-'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Tipo de producto</label>
                <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-700/50 text-slate-200 inline-block font-medium">
                  {product.type === 'FIX' ? 'Precio fijo único' : product.type === 'INDEXED' ? 'Indexado' : product.type || '-'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Meses permanencia</label>
                <div className="text-slate-200 font-medium px-4 py-2">{product.permanenceMonths || '0'}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">¿Autoconsumo?</label>
                <div className="bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-700/50 text-slate-200 inline-block font-medium">
                  {product.hasSelfConsumption ? 'SÍ' : 'NO'}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Modalidad Autoconsumo</label>
                <div className="text-slate-400 font-medium px-4 py-2">{product.selfConsumptionType || 'No aplica'}</div>
              </div>
            </div>
          </div>

          {/* Precios Energía */}
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-700/50 pb-4">Precios Energía €/kWh</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P1E</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p1e)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P2E</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p2e)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P3E</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p3e)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P4E</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p4e)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P5E</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p5e)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P6E</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p6e)}</div>
              </div>
            </div>
          </div>

          {/* Precios Potencia */}
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-700/50 pb-4">Precios Potencia €/kW/año</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P1P</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p1p)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P2P</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p2p)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P3P</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p3p)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P4P</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p4p)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P5P</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p5p)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">P6P</label>
                <div className="text-slate-200 text-lg">{formatVal(product.p6p)}</div>
              </div>
            </div>
          </div>

          {/* Otra Información */}
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-700/50 pb-4">Otra Información</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Fee Index €/MWh</label>
                <div className="text-slate-200 text-lg">{formatVal(product.fee)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Coste Desvío €/MWh</label>
                <div className="text-slate-200 text-lg">{formatVal(product.deviationCost)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Precio Excedente €/MWh</label>
                <div className="text-slate-200 text-lg">{formatVal(product.pexc)}</div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Fee Excedente €/MWh</label>
                <div className="text-slate-200 text-lg">{formatVal(product.feeExcedentes)}</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
