'use client';

import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';

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

  const [availableCierres, setAvailableCierres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  
  // New state for selecting a unit when in MATRICIAL or UPR mode
  const [selectedUnit, setSelectedUnit] = useState<string>('');

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
      if (json.units) {
        const keys = Object.keys(json.units);
        if (keys.length > 0) {
          setSelectedUnit(keys[0]);
        } else {
          setSelectedUnit('');
        }
      }
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Determine what data to show in the table
  let tableDataToShow: any[] = [];
  let showUnitSelector = false;
  let availableUnits: string[] = [];

  if (data) {
    if (data.units) {
      showUnitSelector = true;
      availableUnits = Object.keys(data.units).sort();
      if (selectedUnit && data.units[selectedUnit]) {
        tableDataToShow = data.units[selectedUnit];
      }
    } else if (data.data) {
      tableDataToShow = data.data;
    }
  }

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

      {/* RESULTS AREA */}
      {data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ 
            background: 'var(--bg-card)', 
            padding: '24px', 
            borderRadius: '12px', 
            border: '1px solid var(--border)' 
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Resultados del mes</h2>
            
            {showUnitSelector && availableUnits.length > 0 && (
              <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Seleccionar {nivelDetalle === 'UPR' ? 'UPR' : 'Unidad de Programación'}:
                </label>
                <select 
                  value={selectedUnit}
                  onChange={e => setSelectedUnit(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    minWidth: '250px'
                  }}
                >
                  {availableUnits.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            )}

            {Array.isArray(tableDataToShow) && tableDataToShow.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <th rowSpan={2} style={{ padding: '12px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Concepto</th>
                      <th colSpan={3} style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Energía (MWh)</th>
                      <th colSpan={3} style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Importe (EUR)</th>
                      <th colSpan={2} style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Precio Medio (EUR/MWh)</th>
                    </tr>
                    <tr style={{ background: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ventas</th>
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Compras</th>
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Saldo</th>
                      
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Derechos Cobro</th>
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Obligaciones Pago</th>
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>Saldo</th>
                      
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Venta</th>
                      <th style={{ padding: '8px 20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Compra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Order specific concepts to appear first if they exist
                      const conceptOrder = ['BS3', 'CBM', 'RAD3', 'CAD', 'DSV', 'PC3'];
                      
                      const orderedData = [...tableDataToShow].sort((a, b) => {
                        const aIdx = conceptOrder.indexOf(a.concept);
                        const bIdx = conceptOrder.indexOf(b.concept);
                        
                        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                        if (aIdx !== -1) return -1;
                        if (bIdx !== -1) return 1;
                        return a.concept.localeCompare(b.concept);
                      });

                      const formatNum = (num: number | undefined, currency: boolean = false) => {
                        if (!num || Math.abs(num) < 0.001) return '';
                        if (currency) return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        return num.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                      };

                      let totalVentas = 0;
                      let totalCompras = 0;
                      let totalSaldoEn = 0;
                      let totalDer = 0;
                      let totalObl = 0;
                      let totalSaldoIm = 0;

                      orderedData.forEach(row => {
                        totalVentas += (row.energyVentas || 0);
                        totalCompras += (row.energyCompras || 0);
                        totalSaldoEn += (row.energySaldo || 0);
                        totalDer += (row.costDerechos || 0);
                        totalObl += (row.costObligaciones || 0);
                        totalSaldoIm += (row.costSaldo || 0);
                      });

                      return (
                        <>
                          {orderedData.map((row: any) => {
                            const prVenta = row.energyVentas ? (row.costDerechos / row.energyVentas) : 0;
                            const prCompra = row.energyCompras ? (row.costObligaciones / row.energyCompras) : 0;

                            const saldoEn = (row.energyVentas || 0) - (row.energyCompras || 0);
                            const saldoIm = (row.costDerechos || 0) - (row.costObligaciones || 0);

                            const desc = CONCEPT_MAP[row.concept];

                            return (
                              <tr key={row.concept} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s', background: row.concept === 'DSV' ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                  {desc ? desc : row.concept}
                                </td>
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)' }}>{formatNum(row.energyVentas)}</td>
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)' }}>{formatNum(row.energyCompras)}</td>
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{formatNum(saldoEn)}</td>
                                
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)' }}>{formatNum(row.costDerechos, true)}</td>
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)' }}>{formatNum(row.costObligaciones, true)}</td>
                                <td style={{ padding: '12px 20px', color: saldoIm < 0 ? 'var(--danger)' : 'var(--text-primary)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{formatNum(saldoIm, true)}</td>
                                
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)' }}>{formatNum(prVenta, true)}</td>
                                <td style={{ padding: '12px 20px', color: 'var(--text-primary)' }}>{formatNum(prCompra, true)}</td>
                              </tr>
                            );
                          })}
                          
                          {/* Total Row */}
                          <tr style={{ background: 'rgba(255,255,255,0.02)', borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                            <td style={{ padding: '12px 20px', color: 'var(--text-primary)', textAlign: 'left', borderRight: '1px solid var(--border)' }}>
                              Total
                            </td>
                            <td style={{ padding: '12px' }}>{formatNum(totalVentas)}</td>
                            <td style={{ padding: '12px' }}>{formatNum(totalCompras)}</td>
                            <td style={{ padding: '12px', borderRight: '1px solid var(--border)' }}>{formatNum(totalSaldoEn)}</td>
                            
                            <td style={{ padding: '12px' }}>{formatNum(totalDer, true)}</td>
                            <td style={{ padding: '12px' }}>{formatNum(totalObl, true)}</td>
                            <td style={{ padding: '12px', borderRight: '1px solid var(--border)', color: totalSaldoIm < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatNum(totalSaldoIm, true)}</td>
                            
                            <td colSpan={2} style={{ padding: '12px' }}></td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No se encontraron datos para los filtros seleccionados.</p>
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
