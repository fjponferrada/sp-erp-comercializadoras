'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const CONCEPT_MAP: Record<string, string> = {
  'BS3': 'Banda Secundaria CF',
  'RAD3': 'Coste a BRP servicio de respuesta activa',
  'CAD': 'Costes asignados a la demanda',
  'PC3': 'Pagos capacidad (Financiación)',
  'DSV': 'Desvíos',
  'CBM': 'Contratos bilaterales mercado'
};

export default function ReganecuViewerClient() {
  const [dateStr, setDateStr] = useState<string>('');
  const [cierre, setCierre] = useState<string>('');
  const [region, setRegion] = useState<string>('peninsula');
  const [nivelDetalle, setNivelDetalle] = useState<string>('TOTAL');
  const [desglosarUpr, setDesglosarUpr] = useState<boolean>(false);

  const [availableCierres, setAvailableCierres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  
  // Pagination state
  const [page, setPage] = useState<number>(1);
  const limit = 100;

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

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setData(null);
    setSummaryData(null);
  }, [dateStr, cierre, region, nivelDetalle, desglosarUpr]);

  const handleConsultar = async (targetPage: number = page) => {
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
      const matricial = nivelDetalle === 'MATRICIAL' ? 'SI' : 'NO';
      const upr = desglosarUpr ? 'SI' : 'NO';

      const res = await fetch(`/api/reganecu/query?date=${dateStr}&cierre=${cierre}&region=${region}&matricial=${matricial}&upr=${upr}&page=${targetPage}&limit=${limit}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al obtener datos');
      
      setData(json);
      setPage(targetPage);

      // Fetch summary table data
      if (targetPage === 1) {
        const sumRes = await fetch(`/api/reganecu/summary?date=${dateStr}&region=${region}`);
        if (sumRes.ok) {
          const sumJson = await sumRes.json();
          setSummaryData(sumJson.summary || null);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!dateStr || !cierre) {
      alert('Faltan parámetros para exportar');
      return;
    }
    const matricial = nivelDetalle === 'MATRICIAL' ? 'SI' : 'NO';
    const upr = desglosarUpr ? 'SI' : 'NO';
    window.location.href = `/api/reganecu/export?date=${dateStr}&cierre=${cierre}&region=${region}&matricial=${matricial}&upr=${upr}`;
  };

  const formatNum = (num: number | undefined, currency: boolean = false) => {
    if (!num || Math.abs(num) < 0.001) return '0,000';
    if (currency) return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return num.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
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
            <option value="MATRICIAL">Matricial</option>
          </select>
        </div>

        {nivelDetalle === 'MATRICIAL' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px' }}>
            <input 
              type="checkbox" 
              id="upr_check" 
              checked={desglosarUpr} 
              onChange={e => setDesglosarUpr(e.target.checked)} 
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="upr_check" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Desglosar por UPR
            </label>
          </div>
        )}

        <button 
          onClick={() => handleConsultar(1)}
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

      {/* RESULTS AREA */}
      {data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              Resultados del mes ({data.rawRecords || 0} registros procesados)
            </h2>
            <button 
              onClick={handleExport}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Download size={16} /> Exportar a Excel
            </button>
          </div>

          <div style={{ 
            background: 'var(--bg-card)', 
            padding: '24px', 
            borderRadius: '12px', 
            border: '1px solid var(--border)' 
          }}>
            
            {Array.isArray(data.data) && data.data.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      {nivelDetalle === 'MATRICIAL' && (
                        <>
                          <th rowSpan={2} style={{ padding: '12px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Día</th>
                          <th rowSpan={2} style={{ padding: '12px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Periodo</th>
                          <th rowSpan={2} style={{ padding: '12px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Unidad</th>
                          {desglosarUpr && <th rowSpan={2} style={{ padding: '12px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>UPR</th>}
                        </>
                      )}
                      
                      <th rowSpan={2} style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Concepto</th>
                      
                      <th colSpan={3} style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Energía (MWh)</th>
                      <th colSpan={3} style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Importe (EUR)</th>
                      <th colSpan={2} style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Precio Medio (EUR/MWh)</th>
                    </tr>
                    <tr style={{ background: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ventas</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Compras</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Saldo</th>
                      
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Der. Cobro</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Oblig. Pago</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Saldo</th>
                      
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Venta</th>
                      <th style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((row: any, i: number) => {
                      const prVenta = row.energyVentas ? (row.costDerechos / row.energyVentas) : 0;
                      const prCompra = row.energyCompras ? (row.costObligaciones / row.energyCompras) : 0;

                      const desc = CONCEPT_MAP[row.concept];

                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', background: row.concept === 'DSV' ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                          
                          {nivelDetalle === 'MATRICIAL' && (
                            <>
                              <td style={{ padding: '12px 10px', color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.85rem' }}>{row.date}</td>
                              <td style={{ padding: '12px 10px', color: 'var(--text-primary)', textAlign: 'center', fontSize: '0.85rem' }}>{row.period}</td>
                              <td style={{ padding: '12px 10px', color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600 }}>{row.unit}</td>
                              {desglosarUpr && <td style={{ padding: '12px 10px', color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.85rem' }}>{row.upr}</td>}
                            </>
                          )}
                          
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                            {desc ? desc : row.concept}
                          </td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>{formatNum(row.energyVentas)}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>{formatNum(row.energyCompras)}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{formatNum(row.energySaldo)}</td>
                          
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>{formatNum(row.costDerechos, true)}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>{formatNum(row.costObligaciones, true)}</td>
                          <td style={{ padding: '12px 10px', color: (row.costSaldo || 0) < 0 ? 'var(--danger)' : 'var(--text-primary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{formatNum(row.costSaldo, true)}</td>
                          
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>{formatNum(prVenta, true)}</td>
                          <td style={{ padding: '12px 10px', color: 'var(--text-primary)' }}>{formatNum(prCompra, true)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No se encontraron datos para los filtros seleccionados.</p>
            )}

            {/* Pagination Controls */}
            {nivelDetalle === 'MATRICIAL' && data.pagination && data.pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                <button 
                  onClick={() => handleConsultar(page - 1)}
                  disabled={page === 1 || loading}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: (page === 1 || loading) ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: (page === 1 || loading) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <ChevronLeft size={18} /> Anterior
                </button>
                
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  Página <strong>{page}</strong> de {data.pagination.totalPages}
                </span>

                <button 
                  onClick={() => handleConsultar(page + 1)}
                  disabled={page === data.pagination.totalPages || loading}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: (page === data.pagination.totalPages || loading) ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: (page === data.pagination.totalPages || loading) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  Siguiente <ChevronRight size={18} />
                </button>
              </div>
            )}
            
            {/* SUMMARY TABLE */}
            {summaryData && Object.keys(summaryData).length > 0 && (
              <div style={{ marginTop: '40px', overflowX: 'auto' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '16px' }}>Evolución Liquidaciones</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                      <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Concepto</th>
                      {Object.keys(summaryData).sort().map((c, idx, arr) => (
                        <React.Fragment key={c}>
                          <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>{c}</th>
                          {idx > 0 && (
                            <th style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{c} - {arr[idx-1]}</th>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary)', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)', fontWeight: 600 }}>Total Base Imponible</td>
                      {Object.keys(summaryData).sort().map((c, idx, arr) => {
                        const val = summaryData[c];
                        const prevVal = idx > 0 ? summaryData[arr[idx-1]] : null;
                        const diff = prevVal !== null ? val - prevVal : 0;
                        return (
                          <React.Fragment key={c}>
                            <td style={{ padding: '12px 20px', color: val < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatNum(val, true)} €</td>
                            {idx > 0 && (
                              <td style={{ padding: '12px 20px', color: diff < 0 ? 'var(--danger)' : 'var(--text-primary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{formatNum(diff, true)} €</td>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 20px', color: 'var(--text-primary)', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)', fontWeight: 600 }}>Total con IVA (21%)</td>
                      {Object.keys(summaryData).sort().map((c, idx, arr) => {
                        const val = summaryData[c] * 1.21;
                        const prevVal = idx > 0 ? summaryData[arr[idx-1]] * 1.21 : null;
                        const diff = prevVal !== null ? val - prevVal : 0;
                        return (
                          <React.Fragment key={c}>
                            <td style={{ padding: '12px 20px', color: val < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatNum(val, true)} €</td>
                            {idx > 0 && (
                              <td style={{ padding: '12px 20px', color: diff < 0 ? 'var(--danger)' : 'var(--text-primary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{formatNum(diff, true)} €</td>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
          </div>
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
          <Search size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <p>Selecciona los filtros y haz clic en "Consultar Datos"</p>
        </div>
      )}
    </div>
  );
}
