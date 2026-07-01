'use client';

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

export default function ReganecuViewerClient() {
  const [dateStr, setDateStr] = useState<string>('');
  const [cierre, setCierre] = useState<string>('C2');
  const [region, setRegion] = useState<string>('peninsula');
  const [matricial, setMatricial] = useState<string>('NO');
  const [total, setTotal] = useState<string>('NO');
  const [upr, setUpr] = useState<string>('NO');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const handleConsultar = async () => {
    if (!dateStr) {
      alert('Por favor selecciona un mes');
      return;
    }
    
    setLoading(true);
    try {
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
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '150px'
            }}
          >
            <option value="C1">C1</option>
            <option value="C2">C2</option>
            <option value="C3">C3</option>
            <option value="C4">C4</option>
            <option value="C5">C5</option>
            <option value="C6">C6</option>
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
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Matricial</label>
          <select 
            value={matricial}
            onChange={e => setMatricial(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '100px'
            }}
          >
            <option value="NO">NO</option>
            <option value="SI">SI</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total</label>
          <select 
            value={total}
            onChange={e => setTotal(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '100px'
            }}
          >
            <option value="NO">NO</option>
            <option value="SI">SI</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Con UPR</label>
          <select 
            value={upr}
            onChange={e => setUpr(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-base)',
              color: 'var(--text-primary)',
              minWidth: '100px'
            }}
          >
            <option value="NO">NO</option>
            <option value="SI">SI</option>
          </select>
        </div>

        <button
          onClick={handleConsultar}
          disabled={loading}
          style={{
            padding: '8px 24px',
            backgroundColor: 'var(--red)', // matching the screenshot red button
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: '38px' // matching inputs
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Consultar Datos'}
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
