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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard title="Total Pendiente (MWh)" value={formatNumber(totalMWh)} icon={ZapOff} trend="Contratos atrasados" />
          <MetricCard title={`Mes Actual (${m0Name})`} value={formatNumber(m0MWh)} icon={Zap} trend="MWh pendientes" />
          <MetricCard title={`Mes -1 (${m1Name})`} value={formatNumber(m1MWh)} icon={Calendar} trend="MWh pendientes" />
          <MetricCard title={`Mes -2 (${m2Name})`} value={formatNumber(m2MWh)} icon={AlertCircle} trend="MWh pendientes" delay={300} />
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
                  <th className="px-4 py-3 text-right font-bold text-[var(--brand-primary)]">Total MWh</th>
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
                      <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                        {item.m2PendingMWh > 0 ? formatNumber(item.m2PendingMWh) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                        {item.m1PendingMWh > 0 ? formatNumber(item.m1PendingMWh) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">
                        {item.m0PendingMWh > 0 ? formatNumber(item.m0PendingMWh) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-[var(--lime)]">
                        {formatNumber(item.totalPendingMWh)}
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
