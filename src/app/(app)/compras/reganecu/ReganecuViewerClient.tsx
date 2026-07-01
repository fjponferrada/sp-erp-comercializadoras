'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function ReganecuViewerClient() {
  const [dateStr, setDateStr] = useState<string>('');
  const [cierre, setCierre] = useState<string>('');
  const [region, setRegion] = useState<string>('peninsula');
  const [nivelDetalle, setNivelDetalle] = useState<string>('TOTAL');

  const [availableCierres, setAvailableCierres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (dateStr) {
      fetch(`/api/reganecu/cierres?date=${dateStr}`)
        .then(res => res.json())
        .then(json => {
          if (json.cierres && json.cierres.length > 0) {
            setAvailableCierres(json.cierres);
            if (!json.cierres.includes(cierre)) {
              setCierre(json.cierres[0]);
            }
          } else {
            setAvailableCierres([]);
            setCierre('');
          }
        })
        .catch(err => console.error(err));
    } else {
      setAvailableCierres([]);
      setCierre('');
    }
  }, [dateStr]);

  const handleConsultar = async () => {
    if (!dateStr) {
      alert('Por favor selecciona un mes');
      return;
    }
    if (!cierre) {
      alert('No hay cierres disponibles para el mes seleccionado');
      return;
    }
    
    setLoading(true);
    try {
      const matricial = (nivelDetalle === 'MATRICIAL' || nivelDetalle === 'UPR') ? 'SI' : 'NO';
      const total = nivelDetalle === 'TOTAL' ? 'SI' : 'NO';
      const upr = nivelDetalle === 'UPR' ? 'SI' : 'NO';

      const res = await fetch(`/api/reganecu/query?date=${dateStr}&cierre=${cierre}&region=${region}&matricial=${matricial}&total=${total}&upr=${upr}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al obtener datos');
      
      setData(json);
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* FILTER BAR */}
      <div style={{ 
        background: 'var(--bg-card)', 
        padding: '24px', 
        borderRadius: '12px', 
        border: '1px solid var(--border)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '20px',
        alignItems: 'flex-end'
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Mes</label>
          <input 
            type="month" 
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '200px'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tipo de cierre</label>
          <select 
            value={cierre}
            onChange={e => setCierre(e.target.value)}
            disabled={availableCierres.length === 0}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '150px'
            }}
          >
            {availableCierres.length === 0 && <option value="">-</option>}
            {availableCierres.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tipo de region</label>
          <select 
            value={region}
            onChange={e => setRegion(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '150px'
            }}
          >
            <option value="peninsula">peninsula</option>
            <option value="baleares">baleares</option>
            <option value="canarias">canarias</option>
            <option value="ceuta">ceuta</option>
            <option value="melilla">melilla</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nivel de Detalle</label>
          <select 
            value={nivelDetalle}
            onChange={e => setNivelDetalle(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '160px'
            }}
          >
            <option value="TOTAL">Total Empresa</option>
            <option value="MATRICIAL">Matricial (Por Unidad)</option>
            <option value="UPR">Por Unidad y UPR</option>
          </select>
        </div>

          <button 
            onClick={handleConsultar}
            disabled={loading}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--text-primary)',
              color: 'var(--bg-base)',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: 'auto'
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Consultar Datos'}
          </button>

      </div>

      {/* DATA VIEW */}
      <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', minHeight: '300px' }}>
        {data ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 600 }}>Resultados del Mes</h3>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Se han procesado {data.rawRecords !== undefined ? data.rawRecords : '?'} ficheros diarios para este filtro.
              </span>
            </div>
            
            {Array.isArray(data.data) && data.data.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', minWidth: '150px' }}>Concepto</th>
                      <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Energía Sumada (MWh)</th>
                      <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Importe Sumado (€)</th>
                      <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Registros Contados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((row: any) => {
                      return (
                        <tr key={row.concept} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {row.concept}
                          </td>
                          <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>
                            {row.energySum ? row.energySum.toLocaleString('es-ES', { maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td style={{ padding: '16px 20px', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {row.costSum ? row.costSum.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : '0 €'}
                          </td>
                          <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {row.count} líneas proc.
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No se encontraron datos para los filtros seleccionados.</p>
            )}
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
            <Search size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>Selecciona los filtros y haz clic en "Consultar Datos"</p>
          </div>
        )}
      </div>

    </div>
  );
}
