'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Topbar from '@/components/Topbar';
import SectionCard from '@/components/SectionCard';
import MetricCard from '@/components/MetricCard';
import { ZapOff, Calendar, AlertCircle, Zap } from 'lucide-react';
import { PendingEnergyData } from '@/app/actions/energiaPendienteActions';
import Link from 'next/link';

interface Props {
  data: PendingEnergyData[];
}


export default function EnergiaPendienteClient({ data }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);

  // Calculate totals (always for the entire dataset)
  const totalMWh = data.reduce((acc, item) => acc + item.totalPendingMWh, 0);
  const m0MWh = data.reduce((acc, item) => acc + item.m0PendingMWh, 0);
  const m1MWh = data.reduce((acc, item) => acc + item.m1PendingMWh, 0);
  const m2MWh = data.reduce((acc, item) => acc + item.m2PendingMWh, 0);
  const totalEurosRaw = data.reduce((acc, item) => acc + (item.estimatedEurosRaw || 0), 0);
  const totalEurosTaxes = data.reduce((acc, item) => acc + (item.estimatedEurosWithTaxes || 0), 0);
  const m0Euros = data.reduce((acc, item) => acc + (item.m0Euros || 0), 0);
  const m1Euros = data.reduce((acc, item) => acc + (item.m1Euros || 0), 0);
  const m2Euros = data.reduce((acc, item) => acc + (item.m2Euros || 0), 0);

  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.cups.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.contractCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const visibleData = filteredData.slice(0, visibleCount);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(num);
  };

  const today = new Date();
  const m0Name = format(today, 'MMM', { locale: es });
  const m1Name = format(new Date(today.getFullYear(), today.getMonth() - 1, 1), 'MMM', { locale: es });
  const m2Name = format(new Date(today.getFullYear(), today.getMonth() - 2, 1), 'MMM', { locale: es });

  return (
    <div className="flex-1 overflow-auto bg-[var(--bg-app)] relative pb-16">
      <Topbar title="Energía Pendiente" subtitle="Estimación de MWh pendientes de facturar por contrato" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <MetricCard title="Total Pendiente (MWh)" value={formatNumber(totalMWh)} icon={ZapOff} trend="Contratos atrasados" />
          <MetricCard title={`Mes Actual (${m0Name})`} value={formatNumber(m0MWh)} icon={Zap} trend={`€${formatNumber(m0Euros)} (Base)`} />
          <MetricCard title={`Mes -1 (${m1Name})`} value={formatNumber(m1MWh)} icon={Calendar} trend={`€${formatNumber(m1Euros)} (Base)`} />
          <MetricCard title={`Mes -2 (${m2Name})`} value={formatNumber(m2MWh)} icon={AlertCircle} trend={`€${formatNumber(m2Euros)} (Base)`} delay={300} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--bg-elevated)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center justify-between">
             <div>
               <p className="text-sm font-semibold text-[var(--text-secondary)] mb-1">Base Imponible Estimada</p>
               <h3 className="text-3xl font-bold text-amber-500">€{formatNumber(totalEurosRaw)}</h3>
             </div>
             <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
               <ZapOff size={24} />
             </div>
          </div>
          <div className="bg-[var(--bg-elevated)] p-6 rounded-xl border border-[var(--border-color)] shadow-sm flex items-center justify-between">
             <div>
               <p className="text-sm font-semibold text-[var(--text-secondary)] mb-1">Total con Impuestos (IE + IVA)</p>
               <h3 className="text-3xl font-bold text-[var(--brand-primary)]">€{formatNumber(totalEurosTaxes)}</h3>
             </div>
             <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center text-[var(--brand-primary)]">
               <AlertCircle size={24} />
             </div>
          </div>
        </div>

        <SectionCard title="Contratos con facturación pendiente" icon={ZapOff} delay={400}>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar por CUPS o Contrato..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(50);
              }}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">CUPS</th>
                  <th className="px-4 py-3">Última Facturación</th>
                  <th className="px-4 py-3 text-right">Días Pdtes.</th>
                  <th className="px-4 py-3 text-right">M-2 ({m2Name})</th>
                  <th className="px-4 py-3 text-right">M-1 ({m1Name})</th>
                  <th className="px-4 py-3 text-right">M0 ({m0Name})</th>
                  <th className="px-4 py-3 text-right font-bold text-[var(--brand-primary)]">Total Pdte (MWh / €)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {visibleData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No se han encontrado contratos pendientes de facturación.
                    </td>
                  </tr>
                ) : (
                  visibleData.map((item) => (
                    <tr key={item.contractId} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <Link href={`/contratos/${item.contractId}`} className="hover:text-[var(--brand-primary)] transition-colors">
                          {item.contractCode}
                        </Link>
                        {item.status === 'Baja' && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase">Baja</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[var(--text-secondary)]">
                        {item.cups}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {item.lastBilledDate ? format(new Date(item.lastBilledDate), 'dd/MM/yyyy') : <span className="text-amber-500">Sin facturar</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                        {item.totalPendingDays}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {item.m2PendingMWh > 0 ? formatNumber(item.m2PendingMWh) : '-'}
                        </div>
                        {item.m2Euros > 0 && (
                          <div className="text-xs text-[var(--brand-primary)] mt-0.5">
                            €{formatNumber(item.m2Euros)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {item.m1PendingMWh > 0 ? formatNumber(item.m1PendingMWh) : '-'}
                        </div>
                        {item.m1Euros > 0 && (
                          <div className="text-xs text-[var(--brand-primary)] mt-0.5">
                            €{formatNumber(item.m1Euros)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-sm text-[var(--text-secondary)]">
                          {item.m0PendingMWh > 0 ? formatNumber(item.m0PendingMWh) : '-'}
                        </div>
                        {item.m0Euros > 0 && (
                          <div className="text-xs text-[var(--brand-primary)] mt-0.5">
                            €{formatNumber(item.m0Euros)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-sm text-[var(--lime)]">
                          {formatNumber(item.totalPendingMWh)} <span className="text-xs">MWh</span>
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] mt-1 font-mono">
                          Base: €{formatNumber(item.estimatedEurosRaw || 0)}
                        </div>
                        <div className="text-xs text-[var(--brand-primary)] font-mono">
                          Total: €{formatNumber(item.estimatedEurosWithTaxes || 0)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {visibleCount < filteredData.length && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => setVisibleCount(prev => prev + 50)}
                className="px-6 py-2 bg-[var(--brand-primary)] text-white font-medium rounded-lg hover:bg-opacity-90 transition-all shadow-md flex items-center gap-2"
              >
                Cargar más contratos
              </button>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
