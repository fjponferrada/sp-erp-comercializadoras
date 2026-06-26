'use client';

import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calculator, Zap, Settings, Loader2, UploadCloud, FileText, RefreshCw, Info, CheckCircle, Download } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Topbar from '@/components/Topbar';
import toast from 'react-hot-toast';
import { fetchSipsForPricingAction } from '@/app/actions/supplyPointActions';

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<any>(null);

  const [quoteMode, setQuoteMode] = useState<'generico' | 'cups'>('generico');
  const [cupsInput, setCupsInput] = useState('');
  const [fetchingSips, setFetchingSips] = useState(false);

  const [tariff, setTariff] = useState('2.0TD');
  const [margin, setMargin] = useState('10');
  const [deviations, setDeviations] = useState('3.5');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMonths, setDurationMonths] = useState('12');
  const [riskLevel, setRiskLevel] = useState('2');
  
  const [inputType, setInputType] = useState('estimado');
  const [annualConsumption, setAnnualConsumption] = useState('10000');
  
  const [sipsData, setSipsData] = useState<any>(null);
  const [sipsFileName, setSipsFileName] = useState('');
  const [sipsSuccess, setSipsSuccess] = useState('');

  const [cchData, setCchData] = useState<number[] | null>(null);

  const handleFetchSips = async () => {
    if (!cupsInput || cupsInput.length < 20) {
      toast.error('Por favor introduce un CUPS válido (al menos 20 caracteres)');
      return;
    }
    
    setFetchingSips(true);
    setErrorMsg('');
    setSipsSuccess('');
    
    try {
      const loadingToast = toast.loading('Consultando INGEBAU SIPS...');
      const res = await fetchSipsForPricingAction(cupsInput.trim().toUpperCase());
      toast.dismiss(loadingToast);
      
      if (res.success) {
        if (res.tarifa) setTariff(res.tarifa);
        setInputType('sips');
        if (res.consumos) {
          setSipsData(res.consumos);
          const { p1, p2, p3, p4, p5, p6 } = res.consumos;
          const total = p1 + p2 + p3 + p4 + p5 + p6;
          setSipsSuccess(`Datos obtenidos de SIPS correctamente: ${total.toFixed(0)} kWh anuales.`);
        }
        toast.success('Datos de SIPS cargados correctamente');
      } else {
        setErrorMsg(res.error || 'Error desconocido');
        toast.error(res.error || 'Error al obtener SIPS');
      }
    } catch (e: any) {
      setErrorMsg('Error al conectar con el servidor para consultar SIPS');
      toast.error('Error al conectar con SIPS');
    } finally {
      setFetchingSips(false);
    }
  };

  const handleSyncPortfolio = async () => {
    setSyncing(true);
    setSyncMessage('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/cron/update-portfolio', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      setSyncMessage(data.message || 'Portfolio sincronizado correctamente. La curva base actualizada ya está disponible.');
      setTimeout(() => setSyncMessage(''), 8000); // Ocultar tras 8s
    } catch (error: any) {
      setErrorMsg(error.message);
      setTimeout(() => setErrorMsg(''), 8000);
    } finally {
      setSyncing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSipsFileName(file.name);
    setSipsSuccess('');
    setErrorMsg('');
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        let p1=0, p2=0, p3=0, p4=0, p5=0, p6=0;
        let maxDate = 0;
        let detectedTariff = '';
        
        // 1. Encontrar la fecha más reciente en el CSV
        for (const row of rows) {
          const keys = Object.keys(row);
          for (const k of keys) {
            const kl = k.toUpperCase();
            if (kl.includes('LECTURA HASTA') || kl.includes('FECHA_FIN') || kl.includes('FECHA HASTA')) {
              const d = new Date(row[k]).getTime();
              if (!isNaN(d) && d > maxDate) maxDate = d;
            }
          }
        }
        
        // 2. Calcular fecha de corte (365 días antes)
        const cutoff = maxDate > 0 ? maxDate - (365 * 24 * 60 * 60 * 1000) : 0;
        
        for (const row of rows) {
          // Si tenemos fecha de corte, ignoramos filas antiguas
          if (cutoff > 0) {
            let rowMaxDate = 0;
            const keys = Object.keys(row);
            for (const k of keys) {
              const kl = k.toUpperCase();
              if (kl.includes('LECTURA HASTA') || kl.includes('LECTURA DESDE') || kl.includes('FECHA')) {
                const d = new Date(row[k]).getTime();
                if (!isNaN(d) && d > rowMaxDate) rowMaxDate = d;
              }
            }
            // Si la fecha de esta fila es más antigua que el corte (aprox 1 año), la saltamos
            if (rowMaxDate > 0 && rowMaxDate < cutoff) continue;
          }

          const keys = Object.keys(row);
          for (const k of keys) {
            const kl = k.toUpperCase();
            if ((kl.includes('ENERGIA') || kl.includes('ACTIVA') || kl.includes('AE_')) && !kl.includes('REACTIVA') && !kl.includes('REAC')) {
              const val = parseFloat(row[k]?.toString().replace(',', '.') || '0');
              if (isNaN(val)) continue;
              if (kl.includes('P1')) p1 += val;
              else if (kl.includes('P2')) p2 += val;
              else if (kl.includes('P3')) p3 += val;
              else if (kl.includes('P4')) p4 += val;
              else if (kl.includes('P5')) p5 += val;
              else if (kl.includes('P6')) p6 += val;
            } else if (kl.includes('TARIFA') && typeof row[k] === 'string' && row[k].trim() !== '') {
               detectedTariff = row[k].trim().toUpperCase();
            }
          }
        }
        
        if (detectedTariff) {
          if (detectedTariff.includes('2.0')) setTariff('2.0TD');
          else if (detectedTariff.includes('3.0')) setTariff('3.0TD');
          else if (detectedTariff.includes('6.1')) setTariff('6.1TD');
          else if (detectedTariff.includes('6.2')) setTariff('6.2TD');
          else if (detectedTariff.includes('6.3')) setTariff('6.3TD');
          else if (detectedTariff.includes('6.4')) setTariff('6.4TD');
        }

        if (p1+p2+p3+p4+p5+p6 === 0) {
          setErrorMsg('No se encontraron columnas de energía P1-P6 en el CSV');
          setSipsData(null);
        } else {
          setSipsData({ p1, p2, p3, p4, p5, p6 });
          setSipsSuccess(`SIPS procesado correctamente: ${(p1+p2+p3+p4+p5+p6).toFixed(0)} kWh totales`);
        }
      },
      error: (err) => setErrorMsg(`Error leyendo CSV: ${err.message}`)
    });
  };

  const handleCchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSipsFileName(file.name);
    setSipsSuccess('');
    setErrorMsg('');
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const dataArr: number[] = [];
        let total = 0;
        
        for (const row of rows) {
          const keys = Object.keys(row);
          let val = NaN;
          for (const k of keys) {
            const kl = k.toLowerCase();
            if (kl.includes('energia') || kl.includes('activa')) {
              val = parseFloat(row[k]?.toString().replace(',', '.') || '0');
              break;
            } else if (keys.length === 2 && !kl.includes('date') && !kl.includes('fecha') && !kl.includes('tiempo')) {
              val = parseFloat(row[k]?.toString().replace(',', '.') || '0');
            }
          }
          if (!isNaN(val)) {
            dataArr.push(val);
            total += val;
          }
        }
        
        if (dataArr.length === 0) {
          setErrorMsg('No se pudo extraer la curva horaria del CSV.');
          setCchData(null);
        } else {
          setCchData(dataArr);
          setSipsSuccess(`Curva procesada: ${dataArr.length} horas, Total: ${(total/1000).toFixed(2)} MWh`);
        }
      },
      error: (err) => setErrorMsg(`Error leyendo CSV: ${err.message}`)
    });
  };

  const handleCalculate = async () => {
    if (inputType === 'sips' && !sipsData) {
      return setErrorMsg('Debes subir un archivo SIPS primero');
    }
    if (inputType === 'cch' && !cchData) {
      return setErrorMsg('Debes subir el archivo CSV de la CCH real primero');
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const payload: any = {
        tariff,
        margin: Number(margin),
        deviations: Number(deviations),
        startDate,
        durationMonths: Number(durationMonths),
        riskLevel: Number(riskLevel)
      };
      
      if (inputType === 'estimado') {
        payload.annualConsumptionKwh = Number(annualConsumption);
      } else if (inputType === 'sips') {
        payload.sipsData = sipsData;
      } else if (inputType === 'cch') {
        payload.cchData = cchData;
      }

      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cotizar');
      
      setResult(data);
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!result || !result.hourlyDetails) return;
    
    const totConsKwh = result.hourlyDetails.reduce((sum: number, h: any) => sum + h.consumoKwh, 0);
    const totConsMwh = totConsKwh / 1000;
    
    const periodsSummary = [];
    for (const p of ['P1','P2','P3','P4','P5','P6']) {
      if (!result.periods[p]) continue;
      const hoursInP = result.hourlyDetails.filter((h: any) => h.per === p);
      const c = hoursInP.reduce((s: number, h: any) => s + h.consumoKwh, 0);
      const eAbs = hoursInP.reduce((s: number, h: any) => s + (h.energiaPuraEur * h.consumoKwh/1000), 0);
      const lossAbs = hoursInP.reduce((s: number, h: any) => s + ((h.costeConPerdidasEur - h.energiaPuraEur) * h.consumoKwh/1000), 0);
      const regAbs = hoursInP.reduce((s: number, h: any) => s + (h.regTotalEur * h.consumoKwh/1000), 0);
      const costAbs = hoursInP.reduce((s: number, h: any) => s + h.absTotalEur, 0); 
      const offerMwh = result.periods[p].priceEurMwh;

      periodsSummary.push({
        CONCEPTO: p,
        'PRECIO COSTE (€/MWh)': Number((offerMwh - Number(margin)).toFixed(3)),
        'COSTE ENERGÍA (€/MWh)': Number((eAbs / (c/1000)).toFixed(2)),
        'COSTE PÉRDIDAS (€/MWh)': Number((lossAbs / (c/1000)).toFixed(2)),
        'COSTE REGULADO (€/MWh)': Number((regAbs / (c/1000)).toFixed(2)),
        'MARGEN (€/MWh)': Number(margin),
        'PRECIO OFERTA (€/MWh)': Number(offerMwh.toFixed(3)),
        'PRECIO OFERTA (€/kWh)': Number((offerMwh / 1000).toFixed(6)),
        'CONSUMO PROYECTADO (kWh)': Math.ceil(c),
        'CONSUMO PROYECTADO (MWh)': Number((c / 1000).toFixed(3)),
        '% CONSUMO': Number(((c / totConsKwh) * 100).toFixed(2)),
        'COSTE TOTAL ESTIMADO (€)': Number(costAbs.toFixed(2)) 
      });
    }
    
    periodsSummary.push({
      CONCEPTO: 'PRECIO FIJO 24H (TOTALES)',
      'PRECIO COSTE (€/MWh)': Number((result.flatPriceEurMwh - Number(margin)).toFixed(3)),
      'COSTE ENERGÍA (€/MWh)': Number((result.breakdown.energyCostEur / totConsMwh).toFixed(2)),
      'COSTE PÉRDIDAS (€/MWh)': Number((result.breakdown.lossesCostEur / totConsMwh).toFixed(2)),
      'COSTE REGULADO (€/MWh)': Number((result.breakdown.regulatedCostEur / totConsMwh).toFixed(2)),
      'MARGEN (€/MWh)': Number(margin),
      'PRECIO OFERTA (€/MWh)': Number(result.flatPriceEurMwh.toFixed(3)),
      'PRECIO OFERTA (€/kWh)': Number((result.flatPriceEurMwh / 1000).toFixed(6)),
      'CONSUMO PROYECTADO (kWh)': Math.ceil(totConsKwh),
      'CONSUMO PROYECTADO (MWh)': Number((totConsMwh).toFixed(3)),
      '% CONSUMO': 100.0,
      'COSTE TOTAL ESTIMADO (€)': Number(result.breakdown.totalEur.toFixed(2))
    });

    const wb = XLSX.utils.book_new();
    const wsPropuesta = XLSX.utils.json_to_sheet(periodsSummary);
    XLSX.utils.book_append_sheet(wb, wsPropuesta, "PROPUESTA_COMERCIAL");

    const detalleExport = result.hourlyDetails.map((h: any) => ({
      datetime: h.datetime,
      per: h.per,
      consumo: Number(h.consumoKwh.toFixed(3)),
      loss_f: Number(h.lossFactor.toFixed(4)),
      Unit_Base_Mercado: Number(h.baseMercadoEur.toFixed(3)),
      Unit_Restricciones: Number(h.restriccionesEur.toFixed(3)),
      Unit_OS: Number(h.osEur.toFixed(3)),
      Unit_Desvios: Number(h.desviosEur.toFixed(3)),
      Unit_Energia_Pura: Number(h.energiaPuraEur.toFixed(3)),
      Unit_Coste_Con_Perdidas: Number(h.costeConPerdidasEur.toFixed(3)),
      Unit_Reg_Total: Number(h.regTotalEur.toFixed(3)),
      Unit_Margen: Number(h.margenEur.toFixed(3)),
      Unit_Subtotal: Number(h.subtotalEur.toFixed(3)),
      Unit_Tasa_Munic: Number(h.tasaMunicEur.toFixed(3)),
      Unit_Precio_Final: Number(h.precioFinalEur.toFixed(3)),
      Abs_Total: Number(h.absTotalEur.toFixed(3))
    }));
    
    const wsDetalle = XLSX.utils.json_to_sheet(detalleExport);
    XLSX.utils.book_append_sheet(wb, wsDetalle, "DETALLE_HORARIO");

    const tsNow = new Date().toISOString().replace(/[-:T]/g, '').slice(0,12);
    XLSX.writeFile(wb, `${tsNow}_${tariff}_riesgo_${riskLevel}_fee_${margin}.xlsx`);
  };

  const getChartData = () => {
    if (!result) return [];
    return Object.entries(result.periods).map(([period, data]: [string, any]) => ({
      name: period,
      PrecioOfertado: data.priceEurMwh,
      CostePuro: data.costEurMwh,
    }));
  };

  const COLORS = ['var(--accent)', '#ea580c', '#16a34a', '#0284c7', '#9333ea', '#db2777'];
  const getPieData = () => {
    if (!result) return [];
    const b = result.breakdown;
    return [
      { name: 'Energía Base', value: b.energyCostEur },
      { name: 'Pérdidas', value: b.lossesCostEur },
      { name: 'Costes Regulados', value: b.regulatedCostEur },
      { name: 'Margen Comercial', value: b.marginEur },
      { name: 'Impuestos', value: (b.totalEur - (b.energyCostEur + b.lossesCostEur + b.regulatedCostEur + b.marginEur)) }
    ].filter(i => i.value > 0);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '40px' }}>
      <Topbar 
        title="Pricing & Cotizador" 
        subtitle="Motor financiero predictivo con reconstrucción CCH vía REE."
        customActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {syncMessage && (
              <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }} className="animate-in fade-in duration-300">
                <CheckCircle size={16} /> {syncMessage}
              </span>
            )}
            <button 
              onClick={handleSyncPortfolio} 
              disabled={syncing}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Portfolio Ahora'}
            </button>
          </div>
        }
      />
      
      <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }} className="space-y-6 animate-in fade-in duration-500">

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }} className="shadow-sm">
          <Info className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--accent)', marginTop: '2px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Información del Orquestador PPA:</strong> La curva base del portfolio se calcula automáticamente todos los días a las 02:00 AM para reflejar las últimas cotizaciones de OMIE (Futuros) y los nuevos contratos dados de alta (Base Load), ponderando los PPAs disponibles. También puedes forzar el recálculo en tiempo real haciendo clic en el botón <em>"Sincronizar Portfolio Ahora"</em> en la barra superior.
          </p>
        </div>

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem' }}>
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* FORMULARIO */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }} className="lg:col-span-1 flex flex-col space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" style={{ color: 'var(--accent)' }}/> 
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Parámetros</h2>
              </div>
            </div>

            {/* Selector de Modo */}
            <div style={{ display: 'flex', background: 'var(--bg-base)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setQuoteMode('generico')}
                style={{ 
                  flex: 1, padding: '8px 0', fontSize: '0.85rem', fontWeight: 600, borderRadius: '6px',
                  background: quoteMode === 'generico' ? 'var(--bg-elevated)' : 'transparent',
                  color: quoteMode === 'generico' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: quoteMode === 'generico' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Cálculo Genérico
              </button>
              <button 
                onClick={() => setQuoteMode('cups')}
                style={{ 
                  flex: 1, padding: '8px 0', fontSize: '0.85rem', fontWeight: 600, borderRadius: '6px',
                  background: quoteMode === 'cups' ? 'var(--bg-elevated)' : 'transparent',
                  color: quoteMode === 'cups' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: quoteMode === 'cups' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                Por CUPS
              </button>
            </div>

            {quoteMode === 'cups' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Introducir CUPS</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={cupsInput} 
                      onChange={(e) => setCupsInput(e.target.value.toUpperCase())}
                      placeholder="ES..."
                      style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                      className="outline-none flex-1 font-mono uppercase"
                    />
                    <button
                      onClick={handleFetchSips}
                      disabled={fetchingSips || !cupsInput}
                      className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                      title="Consultar SIPS"
                    >
                      {fetchingSips ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    </button>
                  </div>
                </div>
                {tariff && inputType === 'sips' && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-green-400">
                      <strong>Tarifa Detectada:</strong> {tariff}
                    </p>
                  </div>
                )}
              </div>
            )}

            {quoteMode === 'generico' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Tarifa de Acceso</label>
                <select 
                  value={tariff} 
                  onChange={(e) => setTariff(e.target.value)}
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                  className="outline-none"
                >
                  <option value="2.0TD">2.0TD (Hogares / Pequeñas Pymes)</option>
                  <option value="3.0TD">3.0TD (PYMEs)</option>
                  <option value="6.1TD">6.1TD (Alta Tensión)</option>
                  <option value="6.2TD">6.2TD (Alta Tensión)</option>
                </select>
              </div>
            )}


            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Fecha de Inicio</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                  className="outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Período</label>
                <select 
                  value={durationMonths} 
                  onChange={(e) => setDurationMonths(e.target.value)}
                  style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                  className="outline-none"
                >
                  <option value="12">12 Meses</option>
                  <option value="24">24 Meses</option>
                  <option value="36">36 Meses</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Nivel de Riesgo (Cobertura)</label>
              <select 
                value={riskLevel} 
                onChange={(e) => setRiskLevel(e.target.value)}
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                className="outline-none"
              >
                <option value="1">1 - Bajo (Protección de margen, precios más altos)</option>
                <option value="2">2 - Medio (Costes de sistema estándar)</option>
                <option value="3">3 - Alto (Costes ajustados, máxima competitividad)</option>
              </select>
            </div>
            
            {quoteMode === 'generico' && (
              <div style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', padding: '16px', borderRadius: '12px', borderStyle: 'solid', borderWidth: '1px' }} className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '8px', padding: '4px' }}>
                <button 
                  onClick={() => setInputType('estimado')}
                  style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: inputType === 'estimado' ? 'var(--accent)' : 'transparent', color: inputType === 'estimado' ? '#fff' : 'var(--text-muted)' }}
                >
                  Volumen
                </button>
                <button 
                  onClick={() => setInputType('sips')}
                  style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: inputType === 'sips' ? 'var(--accent)' : 'transparent', color: inputType === 'sips' ? '#fff' : 'var(--text-muted)' }}
                >
                  SIPS CSV
                </button>
                <button 
                  onClick={() => setInputType('cch')}
                  style={{ flex: 1, padding: '6px 0', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: inputType === 'cch' ? 'var(--accent)' : 'transparent', color: inputType === 'cch' ? '#fff' : 'var(--text-muted)' }}
                >
                  CCH Real
                </button>
              </div>

              {inputType === 'estimado' ? (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Consumo Anual (kWh)</label>
                  <input 
                    type="number" 
                    value={annualConsumption} 
                    onChange={(e) => setAnnualConsumption(e.target.value)}
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                    className="outline-none"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Se aplicará el perfil REE al volumen proporcionado.</p>
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in">
                  <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {inputType === 'sips' ? 'Sube el archivo SIPS (.csv)' : 'Sube la Curva CCH Horaria (.csv)'}
                  </label>
                  <div style={{ borderColor: 'var(--accent)', background: 'var(--bg-elevated)', borderStyle: 'dashed', borderWidth: '2px', borderRadius: '12px', padding: '24px', textAlign: 'center', cursor: 'pointer', position: 'relative' }} className="hover:opacity-80 transition-opacity">
                    <input type="file" accept=".csv" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} onChange={inputType === 'sips' ? handleFileUpload : handleCchUpload} />
                    <UploadCloud className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--accent)' }} />
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{sipsFileName || 'Arrastra el CSV o haz clic'}</p>
                  </div>
                  {sipsSuccess && (
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: '#10b981', background: '#ecfdf5', padding: '8px', borderRadius: '8px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                      <FileText className="w-4 h-4 mr-2" />
                      {sipsSuccess}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Margen Comercial Neto (€/MWh)</label>
              <input 
                type="number" 
                value={margin} 
                onChange={(e) => setMargin(e.target.value)}
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                className="outline-none font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Coste de Desvíos Previsto (€/MWh)</label>
              <input 
                type="number" 
                value={deviations} 
                onChange={(e) => setDeviations(e.target.value)}
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', width: '100%', padding: '10px', borderRadius: '8px', borderStyle: 'solid', borderWidth: '1px' }}
                className="outline-none"
              />
            </div>

            <button 
              onClick={handleCalculate} 
              disabled={loading} 
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '1rem' }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
              {loading ? 'Calculando 8760 horas...' : 'Generar Cotización'}
            </button>
          </div>

          {/* DASHBOARD */}
          <div className="lg:col-span-2 space-y-6">
            {!result ? (
              <div style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderStyle: 'dashed', borderWidth: '2px', borderRadius: '24px', padding: '48px', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Zap className="w-20 h-20 mb-6 animate-pulse" style={{ color: 'var(--border)' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>Motor a la espera</h3>
                <p style={{ textAlign: 'center', maxWidth: '300px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ajusta los parámetros a la izquierda y cotiza para generar la matriz financiera.</p>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                {/* KPIS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: '16px', padding: '20px', borderLeft: '4px solid var(--accent)' }} className="border shadow-sm">
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Precio Fijo 24h</h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>{result.flatPriceEurMwh.toFixed(2)}</div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--accent)', marginTop: '4px' }}>€/MWh</p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: '16px', padding: '20px', borderLeft: '4px solid #10b981' }} className="border shadow-sm">
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Beneficio Neto</h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: '#10b981' }}>+{result.breakdown.marginEur.toFixed(0)}</div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#10b981', marginTop: '4px' }}>€ ({durationMonths} Meses)</p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: '16px', padding: '20px', borderLeft: '4px solid #a855f7' }} className="border shadow-sm">
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Cargos y Peajes</h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>{result.breakdown.regulatedCostEur.toFixed(0)}</div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#a855f7', marginTop: '4px' }}>€ (Regulado)</p>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: '16px', padding: '20px', borderLeft: '4px solid #f97316' }} className="border shadow-sm">
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Facturación Est.</h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>{result.breakdown.totalEur.toFixed(0)}</div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: '#f97316', marginTop: '4px' }}>€ Totales</p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={handleExportExcel} className="btn" style={{ background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontWeight: 600 }}>
                    <Download size={18} />
                    Exportar Detalle y Propuesta (XLSX)
                  </button>
                </div>

                {/* GRÁFICOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: '16px', padding: '24px' }} className="border shadow-sm">
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '24px' }}>Ofertado vs Coste</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getChartData()} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontWeight: 500}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} tickFormatter={(val) => `€${val}`} />
                          <Tooltip 
                            cursor={{fill: 'var(--border)'}}
                            contentStyle={{borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                            formatter={(value: any) => [`${Number(value).toFixed(2)} €/MWh`, 'Precio']} 
                          />
                          <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', color: 'var(--text-secondary)'}}/>
                          <Bar dataKey="PrecioOfertado" fill="var(--accent)" name="Precio Ofertado" radius={[6, 6, 0, 0]} barSize={24} />
                          <Bar dataKey="CostePuro" fill="#ea580c" name="Coste Empresa" radius={[6, 6, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', borderRadius: '16px', padding: '24px' }} className="border shadow-sm">
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '24px' }}>Distribución del Coste</h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getPieData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                          >
                            {getPieData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                            formatter={(val: any) => [`${Number(val).toFixed(2)} €`, '']} 
                          />
                          <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '12px', color: 'var(--text-secondary)'}}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
