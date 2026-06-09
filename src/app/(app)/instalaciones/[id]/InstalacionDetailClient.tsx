'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Zap, 
  MapPin, 
  Building, 
  FileText, 
  ChevronLeft,
  Calendar,
  Euro,
  Receipt,
  Activity,
  History
} from 'lucide-react';
import Topbar from '@/components/Topbar';

function formatDate(dateString: string | Date | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// Un pequeño componente de tarjeta de sección para reutilizar
function SectionCard({ title, icon: Icon, children, delay = 0 }: any) {
  return (
    <div className={`card p-6 animate-fade-in-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3 mb-6 border-b border-[var(--border)] pb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--lime-glow)] flex items-center justify-center">
          <Icon className="text-[var(--lime)]" size={20} />
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {children}
      </div>
    </div>
  );
}

function DataItem({ label, value, icon: Icon, highlight }: any) {
  return (
    <div className={`p-4 rounded-xl border ${highlight ? 'bg-[var(--lime-glow)] border-[var(--lime)]/30' : 'bg-[var(--bg-elevated)] border-[var(--border-strong)]'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {Icon && <Icon size={14} className={highlight ? "text-[var(--lime)]" : "text-gray-400"} />}
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-sm ${highlight ? 'text-[var(--lime)] font-bold' : 'text-gray-200'}`}>
        {value || <span className="text-gray-500 italic">No especificado</span>}
      </div>
    </div>
  );
}

export default function InstalacionDetailClient({ initialSupplyPoint, userRole }: { initialSupplyPoint: any, userRole: string }) {
  const router = useRouter();

  // Buscar contrato activo
  const activeContract = initialSupplyPoint.contracts.find((c: any) => c.status === 'ACTIVO' || c.status === 'RENOVACION_TRAMITADA');
  
  // Extraer potencias y precios del supply point
  let potencias = {
    p1: initialSupplyPoint.p1p,
    p2: initialSupplyPoint.p2p,
    p3: initialSupplyPoint.p3p,
    p4: initialSupplyPoint.p4p,
    p5: initialSupplyPoint.p5p,
    p6: initialSupplyPoint.p6p,
  };
  let tarifa = initialSupplyPoint.tariff;
  let consumoEstimado = initialSupplyPoint.estimatedAnnualConsumption;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar
        title="Ficha Técnica CUPS"
        subtitle={initialSupplyPoint.cups}
        customActions={
          <Link href="/instalaciones" className="btn-ghost flex items-center gap-2">
            <ChevronLeft size={16} /> Volver a Instalaciones
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        
        {/* HEADER */}
        <div className="bg-slate-800/30 border border-slate-700 p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fade-in-up">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Zap className="w-48 h-48" />
          </div>
          
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-[var(--lime-glow)] border border-[var(--lime)]/30 flex items-center justify-center">
              <Zap className="w-10 h-10 text-[var(--lime)]" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold font-mono tracking-widest text-white">{initialSupplyPoint.cups}</h1>
                {activeContract ? (
                  <span className="badge badge-lime">CONTRATO ACTIVO</span>
                ) : (
                  <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' }}>INACTIVO</span>
                )}
              </div>
              <p className="text-slate-400 flex items-center gap-2">
                <MapPin size={14} /> {initialSupplyPoint.address}, {initialSupplyPoint.city} ({initialSupplyPoint.province})
              </p>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col items-end gap-2 text-right">
            <span className="text-xs text-gray-500 uppercase tracking-widest">Titular Actual</span>
            <Link href={`/clientes/${initialSupplyPoint.clientId}`} className="text-lg font-semibold text-white hover:text-[var(--lime)] transition-colors">
              {initialSupplyPoint.client?.businessName || `${initialSupplyPoint.client?.firstName || ''} ${initialSupplyPoint.client?.lastName || ''}`}
            </Link>
            <span className="text-sm font-mono text-gray-400">NIF: {initialSupplyPoint.client?.vatNumber}</span>
          </div>
        </div>

        {/* DATOS TÉCNICOS EXTRAÍDOS DEL CONTRATO ACTIVO */}
        <SectionCard title="Realidad Técnica (Contrato Activo)" icon={Activity} delay={100}>
          <DataItem highlight icon={Zap} label="Tarifa de Acceso" value={tarifa} />
          <DataItem icon={Activity} label="Consumo Anual Estimado" value={consumoEstimado ? `${consumoEstimado} kWh` : null} />
          
          <div className="col-span-1 md:col-span-2 border border-[var(--border)] bg-[var(--bg-elevated)] p-4 rounded-xl mt-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Potencias Contratadas (kW)</div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {Object.entries(potencias).map(([p, val]) => (
                <div key={p} className="flex flex-col items-center bg-[var(--bg-base)] p-3 rounded-lg border border-[var(--border-strong)]">
                  <span className="text-xs text-gray-500 font-bold uppercase">{p}</span>
                  <span className="text-sm font-mono font-semibold text-[var(--lime)]">{val ? Number(val).toFixed(3) : '-'}</span>
                </div>
              ))}
            </div>
            {!activeContract && (
              <p className="text-xs text-amber-500 mt-4 text-center">
                * CUPS sin contrato activo. Se muestran las últimas potencias conocidas (Caché).
              </p>
            )}
          </div>
        </SectionCard>

        {/* HISTORIAL DE CONTRATOS */}
        <div className="card p-0 overflow-hidden animate-fade-in-up delay-200">
          <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <History size={16} className="text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Historial de Contratos en este CUPS</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha Alta</th>
                  <th>ID Contrato</th>
                  <th>Titular</th>
                  <th>Producto</th>
                  <th>Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {initialSupplyPoint.contracts.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay contratos asociados.</td></tr>
                ) : (
                  initialSupplyPoint.contracts.map((c: any) => (
                    <tr key={c.id}>
                      <td>{formatDate(c.createdAt)}</td>
                      <td className="font-mono text-xs">{c.airtableId || c.id.substring(0,8)}</td>
                      <td>
                        {/* En un modelo perfecto, el contrato puede tener su propio titular, pero aquí asumiremos el cliente actual */}
                        {initialSupplyPoint.client?.businessName}
                      </td>
                      <td className="text-sm">{c.product?.name || '-'}</td>
                      <td>
                        <span className={`badge ${c.status === 'ACTIVO' ? 'badge-lime' : ''}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="text-center">
                        <Link href={`/contratos/${c.id}`} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORIAL DE FACTURAS */}
        <div className="card p-0 overflow-hidden animate-fade-in-up delay-300">
          <div className="p-5 border-b border-[var(--border)] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Receipt size={16} className="text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Historial de Facturación</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nº Factura</th>
                  <th>Emisión</th>
                  <th>Periodo</th>
                  <th>Total (€)</th>
                  <th>Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {initialSupplyPoint.invoices.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay facturas asociadas a este CUPS.</td></tr>
                ) : (
                  initialSupplyPoint.invoices.map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="font-mono text-sm tracking-wide text-white">{inv.invoiceNumber}</td>
                      <td>{formatDate(inv.issueDate)}</td>
                      <td className="text-xs text-gray-400">
                        {formatDate(inv.billingStart)} - {formatDate(inv.billingEnd)}
                      </td>
                      <td className="font-mono font-bold text-emerald-400">{formatCurrency(inv.totalAmount)}</td>
                      <td>
                        {inv.paymentDate ? (
                          <span className="text-emerald-500 text-xs font-semibold">PAGADA</span>
                        ) : (
                          <span className="text-amber-500 text-xs font-semibold">PENDIENTE</span>
                        )}
                      </td>
                      <td className="text-center">
                        <Link href={`/facturas/${inv.id}`} className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                          Ver Ficha
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
