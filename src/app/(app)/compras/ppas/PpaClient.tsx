'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  Zap,
  Pencil,
  Info,
  RefreshCw,
  Calculator,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import PpaForm from '@/components/compras/PpaForm';
import LiquidacionesPpa from '@/components/compras/LiquidacionesPpa';
import {
  estimateNominalAnnualMwh,
  formatMadridDateEs,
  getPpaTemporalStatus,
} from '@/lib/ppaEngine';

function formatPpaPriceLabel(ppa: any): string {
  const val = Number(ppa.priceValue ?? 0);
  const fmt = val.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (ppa.priceType === 'FIJO') {
    return `${fmt} €/MWh`;
  }
  if (val === 0) return 'OMIE puro (0,00 €/MWh)';
  if (val > 0) return `OMIE + ${fmt} €/MWh`;
  return `OMIE - ${Math.abs(val).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €/MWh`;
}

export default function PpaClient() {
  const [ppas, setPpas] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [lastPortfolioSyncAt, setLastPortfolioSyncAt] = useState<string | null>(null);
  const [syncingPortfolio, setSyncingPortfolio] = useState(false);
  const [needsPortfolioSync, setNeedsPortfolioSync] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPpa, setEditingPpa] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'liquidaciones'>('list');
  const [selectedForSettlementId, setSelectedForSettlementId] = useState<string>('');

  const fetchPpas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ppas?withMeta=1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPpas(data);
        } else {
          setPpas(data.ppas || []);
          setCanManage(Boolean(data.canManage));
          setLastPortfolioSyncAt(data.lastPortfolioSyncAt || null);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPpas();
  }, []);

  const handleSyncPortfolio = async () => {
    setSyncingPortfolio(true);
    setSyncFeedback(null);
    try {
      const res = await fetch('/api/cron/update-portfolio', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al sincronizar el portfolio');
      }
      setLastPortfolioSyncAt(data.syncedAt || new Date().toISOString());
      setNeedsPortfolioSync(false);
      setSyncFeedback(data.message || 'Curva Base del Portfolio actualizada correctamente.');
    } catch (err: any) {
      alert('Error sincronizando portfolio: ' + err.message);
    } finally {
      setSyncingPortfolio(false);
    }
  };

  const handleTogglePricing = async (ppa: any) => {
    if (!canManage) return;
    try {
      const res = await fetch(`/api/ppas/${ppa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeInPricing: !ppa.includeInPricing }),
      });
      if (res.ok) {
        setNeedsPortfolioSync(true);
        fetchPpas();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (ppa: any) => {
    if (!confirm(`¿Seguro que deseas eliminar el contrato PPA "${ppa.name}"?`)) return;
    try {
      const res = await fetch(`/api/ppas/${ppa.id}`, { method: 'DELETE' });
      if (res.ok) {
        if (ppa.includeInPricing) setNeedsPortfolioSync(true);
        fetchPpas();
      } else {
        const d = await res.json();
        alert(d.error || 'Error al eliminar');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  };

  const activeCount = ppas.filter((p) => getPpaTemporalStatus(p) === 'EN_VIGOR').length;
  const activeAnnualMwh = ppas
    .filter((p) => getPpaTemporalStatus(p) === 'EN_VIGOR')
    .reduce((acc, p) => acc + estimateNominalAnnualMwh(p), 0);
  const pricingCount = ppas.filter((p) => p.includeInPricing).length;

  return (
    <div>
      {/* Cabecera de control + estado de sincronización con Pricing */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            PPAs en vigor:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{activeCount}</strong> · Cobertura
            anual:{' '}
            <strong style={{ color: 'var(--lime)' }}>
              {activeAnnualMwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} MWh/año
            </strong>{' '}
            · En Pricing:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{pricingCount}</strong>
          </div>

          {lastPortfolioSyncAt && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Última sincr. Curva Base:{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {format(new Date(lastPortfolioSyncAt), 'dd/MM/yyyy HH:mm')}
              </strong>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {canManage && (
            <button
              onClick={handleSyncPortfolio}
              disabled={syncingPortfolio}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: needsPortfolioSync
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'var(--bg-elevated)',
                color: needsPortfolioSync ? '#FBBF24' : 'var(--text-primary)',
                border: `1px solid ${
                  needsPortfolioSync ? 'rgba(245, 158, 11, 0.45)' : 'var(--border)'
                }`,
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: syncingPortfolio ? 'wait' : 'pointer',
              }}
              title="Recalcula la Curva Base del Portfolio (1.250 días) integrando Futuros OMIE y PPAs marcados en Pricing"
            >
              <RefreshCw size={16} className={syncingPortfolio ? 'animate-spin' : ''} />
              {syncingPortfolio ? 'Sincronizando Curva...' : 'Sincronizar Portfolio Ahora'}
            </button>
          )}

          {canManage && (
            <button
              onClick={() => {
                setEditingPpa(null);
                setIsFormOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--lime)',
                color: 'var(--bg-base)',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Plus size={18} />
              Añadir PPA
            </button>
          )}
        </div>
      </div>

      {needsPortfolioSync && (
        <div
          style={{
            marginBottom: '18px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#FBBF24',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>
            Has modificado coberturas PPA vinculadas al Cotizador. Pulsa{' '}
            <strong>"Sincronizar Portfolio Ahora"</strong> para actualizar inmediatamente la Curva
            Base de ofertas y proyecciones.
          </span>
        </div>
      )}

      {syncFeedback && (
        <div
          style={{
            marginBottom: '18px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#4ADE80',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <CheckCircle2 size={17} />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Pestañas */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '8px',
        }}
      >
        <button
          onClick={() => setActiveTab('list')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'list' ? 700 : 500,
            color: activeTab === 'list' ? 'var(--lime)' : 'var(--text-secondary)',
            cursor: 'pointer',
            paddingBottom: '8px',
            borderBottom:
              activeTab === 'list' ? '2px solid var(--lime)' : '2px solid transparent',
            marginBottom: '-10px',
          }}
        >
          Listado de Contratos PPA ({ppas.length})
        </button>
        <button
          onClick={() => setActiveTab('liquidaciones')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: activeTab === 'liquidaciones' ? 700 : 500,
            color: activeTab === 'liquidaciones' ? 'var(--lime)' : 'var(--text-secondary)',
            cursor: 'pointer',
            paddingBottom: '8px',
            borderBottom:
              activeTab === 'liquidaciones'
                ? '2px solid var(--lime)'
                : '2px solid transparent',
            marginBottom: '-10px',
          }}
        >
          Liquidaciones OMIE y Proyección MtM
        </button>
      </div>

      {activeTab === 'liquidaciones' && (
        <LiquidacionesPpa
          initialPpas={ppas}
          initialSelectedPpaId={selectedForSettlementId}
        />
      )}

      {activeTab === 'list' && (
        <>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Cargando contratos PPA...
            </div>
          ) : ppas.length === 0 ? (
            <div
              style={{
                padding: '60px 20px',
                textAlign: 'center',
                background: 'var(--bg-elevated)',
                borderRadius: '12px',
                border: '1px dashed var(--border)',
              }}
            >
              <FileText size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                No hay PPAs configurados en esta comercializadora
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Añade tu primer contrato PPA Físico o Financiero para integrarlo en compras diarias OMIE, liquidaciones y pricing.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Contrato / Contraparte
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Estado
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Modalidad y Volumen
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Vigencia
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Precio / Cláusulas
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center' }}>
                      En Pricing
                    </th>
                    <th style={{ padding: '12px 16px', fontSize: '0.73rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ppas.map((ppa) => {
                    const status = getPpaTemporalStatus(ppa);
                    const annualMwh = estimateNominalAnnualMwh(ppa);

                    const statusBadge =
                      status === 'EN_VIGOR'
                        ? { label: 'En vigor', bg: 'rgba(34, 197, 94, 0.12)', color: '#4ADE80' }
                        : status === 'PROXIMO'
                        ? { label: 'Próximo', bg: 'rgba(245, 158, 11, 0.12)', color: '#FBBF24' }
                        : { label: 'Vencido', bg: 'rgba(148, 163, 184, 0.12)', color: '#94A3B8' };

                    return (
                      <tr key={ppa.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                            <Zap size={15} color="var(--lime)" />
                            <span>{ppa.name}</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              marginTop: '3px',
                              fontSize: '0.76rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {ppa.counterparty && <span>{ppa.counterparty}</span>}
                            {ppa.contractPdfUrl && (
                              <a
                                href={ppa.contractPdfUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: 'var(--lime)',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                }}
                              >
                                <FileText size={12} />
                                PDF
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: statusBadge.bg,
                              color: statusBadge.color,
                            }}
                          >
                            {statusBadge.label}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px', fontSize: '0.84rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                padding: '3px 7px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background:
                                  ppa.type === 'FISICO'
                                    ? 'rgba(59, 130, 246, 0.12)'
                                    : 'rgba(168, 85, 247, 0.12)',
                                color: ppa.type === 'FISICO' ? '#60A5FA' : '#C084FC',
                              }}
                            >
                              {ppa.type}
                            </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                              {ppa.subtype === 'CARGA_BASE'
                                ? `Carga Base (${ppa.basePowerMw} MW)`
                                : 'Perfil Fijo 12×24'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                            ≈ {annualMwh.toLocaleString('es-ES', { maximumFractionDigits: 0 })} MWh/año
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                          {formatMadridDateEs(ppa.startDate)} —{' '}
                          {ppa.endDate ? formatMadridDateEs(ppa.endDate) : 'Indefinido'}
                        </td>

                        <td style={{ padding: '14px 16px', fontSize: '0.84rem' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                            {formatPpaPriceLabel(ppa)}
                          </div>
                          {((ppa.annualDegradationPct ?? 0) > 0 ||
                            (ppa.annualEscalationPct ?? 0) !== 0) && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {(ppa.annualDegradationPct ?? 0) > 0 &&
                                `Deg. -${ppa.annualDegradationPct}%/año`}
                              {(ppa.annualDegradationPct ?? 0) > 0 &&
                                (ppa.annualEscalationPct ?? 0) !== 0 &&
                                ' · '}
                              {(ppa.annualEscalationPct ?? 0) !== 0 &&
                                `IPC ${ppa.annualEscalationPct > 0 ? '+' : ''}${ppa.annualEscalationPct}%/año`}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => handleTogglePricing(ppa)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              border: `1px solid ${
                                ppa.includeInPricing
                                  ? 'rgba(163, 230, 53, 0.4)'
                                  : 'var(--border)'
                              }`,
                              background: ppa.includeInPricing
                                ? 'rgba(163, 230, 53, 0.12)'
                                : 'transparent',
                              color: ppa.includeInPricing
                                ? 'var(--lime)'
                                : 'var(--text-muted)',
                              cursor: canManage ? 'pointer' : 'default',
                            }}
                            title={
                              canManage
                                ? 'Clic para activar/desactivar inclusión en Pricing'
                                : undefined
                            }
                          >
                            {ppa.includeInPricing ? 'Activado' : 'Oculto'}
                          </button>
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => {
                                setSelectedForSettlementId(ppa.id);
                                setActiveTab('liquidaciones');
                              }}
                              style={{
                                background: 'rgba(163, 230, 53, 0.1)',
                                border: '1px solid rgba(163, 230, 53, 0.25)',
                                color: 'var(--lime)',
                                cursor: 'pointer',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                              title="Abrir liquidaciones y MtM de este PPA"
                            >
                              <Calculator size={14} />
                              Liquidar
                            </button>

                            {canManage && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingPpa(ppa);
                                    setIsFormOpen(true);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '6px',
                                  }}
                                  title="Editar PPA"
                                >
                                  <Pencil size={17} />
                                </button>
                                <button
                                  onClick={() => handleDelete(ppa)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '6px',
                                  }}
                                  title="Eliminar PPA"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              background: 'var(--bg-elevated)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
            }}
          >
            <h4
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Info size={18} style={{ color: 'var(--lime)' }} />
              Arquitectura de Cobertura PPA en Compras y Pricing
            </h4>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }} className="space-y-2">
              <p>
                • <strong>PPAs Físicos:</strong> Se descuentan automáticamente de la predicción diaria de compra en OMIE (<em>Compras de Energía → TOTAL_OMIE</em>) y liquidan factura bilateral al productor mostrando además el ahorro frente a spot.
              </p>
              <p>
                • <strong>PPAs Financieros (CfD / Swap):</strong> La comercializadora continúa comprando el 100% físico en OMIE y liquida mensualmente por diferencias <code>(OMIE - Strike) × MWh</code>.
              </p>
              <p>
                • <strong>Inclusión en Pricing:</strong> Los contratos marcados como <em>Activado</em> alimentan la Curva Base del Cotizador al pulsar <strong>Sincronizar Portfolio Ahora</strong>; si se dejan como <em>Oculto</em>, las ofertas a nuevos clientes se cotizan a coste de reposición OMIE puro reteniendo el margen del PPA en el EBITDA de la comercializadora.
              </p>
            </div>
          </div>
        </>
      )}

      {isFormOpen && (
        <PpaForm
          initialData={editingPpa}
          onClose={() => {
            setIsFormOpen(false);
            setEditingPpa(null);
          }}
          onSuccess={(impactsPricing) => {
            setIsFormOpen(false);
            setEditingPpa(null);
            if (impactsPricing) setNeedsPortfolioSync(true);
            fetchPpas();
          }}
        />
      )}
    </div>
  );
}
