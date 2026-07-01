'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface MonthlyData {
  month: string;
  cierre: string;
  estimatedBcMwh: number;
  liquidatedMwh: number;
  pendingMwh: number;
  estimatedPendingCostEur: number;
}

export default function EnergiaPendienteClient() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gestion/energia-pendiente')
      .then(res => res.json())
      .then(json => {
        if (!json.success) {
          setError(json.error || 'Error desconocido al cargar los datos.');
        } else {
          setData(json.data);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatMwh = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatEur = (val: number) => {
    return val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px auto', color: 'var(--lime)' }} />
        <p>Calculando energía pendiente de los últimos 12 meses...</p>
        <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Esto puede tardar unos segundos al procesar los datos horarios de curvas de carga y REE.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <AlertCircle size={24} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Energía Pendiente de Liquidar (REE)
        </h2>
        <button 
          onClick={async () => {
            const t = toast.loading('Iniciando recálculo...');
            try {
              const res = await fetch('/api/gestion/energia-pendiente/recalculate', { method: 'POST' });
              const json = await res.json();
              if (json.success) {
                toast.success(json.message, { id: t, duration: 5000 });
              } else {
                toast.error(json.error || 'Error iniciando recálculo', { id: t });
              }
            } catch (err: any) {
              toast.error(err.message, { id: t });
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
        >
          <RefreshCw size={16} />
          Recalcular Ahora
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Este informe cruza la demanda medida en Barras de Central (curvas de carga + pérdidas) con la energía total liquidada por REE (componente CAD de la última liquidación disponible en REGANECU) para estimar los saldos pendientes de liquidación futura.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mes</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Último Cierre</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Demanda BC Estimada</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Liquidado REE</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Energía Pendiente</th>
              <th style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Valoración Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const isPositiveEnergy = row.pendingMwh > 0;
              const isPositiveCost = row.estimatedPendingCostEur > 0;
              
              // If we owe money to REE (they liquidated less than we consumed, we consumed more, so pendingMwh is > 0)
              // Wait, if Demanda BC > Liquidado REE => We consumed more than we paid for.
              // That means we OWE REE (negative impact on cash flow). Let's show as red?
              // The user just said: "saldo a favor de REE, o a favor de comercializadora".
              // If we consumed more (Demanda BC > Liquidado), we OWE REE.
              // Let's color red if we owe REE, green if REE owes us.
              const colorCode = isPositiveCost ? '#ef4444' : '#22c55e'; // Red if > 0, Green if < 0.

              return (
                <tr key={row.month} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {row.month}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                      background: row.cierre !== 'N/A' ? 'var(--lime)' : 'var(--bg-base)',
                      color: row.cierre !== 'N/A' ? 'var(--bg-base)' : 'var(--text-muted)'
                    }}>
                      {row.cierre}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {formatMwh(row.estimatedBcMwh)} MWh
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                    {row.cierre !== 'N/A' ? `${formatMwh(row.liquidatedMwh)} MWh` : '-'}
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600, textAlign: 'right', color: colorCode, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    {isPositiveEnergy ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {formatMwh(Math.abs(row.pendingMwh))} MWh {isPositiveEnergy ? '(A pagar)' : '(A cobrar)'}
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600, color: colorCode, textAlign: 'right' }}>
                    {formatEur(Math.abs(row.estimatedPendingCostEur))}
                  </td>
                </tr>
              );
            })}
            
            {data.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay datos disponibles para los últimos 12 meses.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-base)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '8px' }}>
          <strong>Nota:</strong> Los valores positivos ("A pagar" en rojo) indican que el consumo real medido (elevado a BC) es mayor que la energía que REE nos ha liquidado hasta la fecha. Esto significa que en próximos cierres nos facturarán esa diferencia. Los valores "A cobrar" en verde significan que REE nos ha liquidado más energía de la consumida, por lo que nos devolverán la diferencia en futuros cierres.
        </p>
        <p>
          <strong>Importante:</strong> Este cálculo es una estimación. La agregación de la demanda BC y la valoración del coste del desvío y energía se ha calculado hora a hora basándonos en las curvas de carga sumadas por segmento tarifario. Los datos se precalculan cada noche para mejorar el rendimiento de la plataforma.
        </p>
      </div>
    </div>
  );
}
