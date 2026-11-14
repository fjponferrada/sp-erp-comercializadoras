'use client';

import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Calculator, Zap, Settings, Loader2, UploadCloud, FileText,
  RefreshCw, Info, CheckCircle, Download, Copy, Database
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Topbar from '@/components/Topbar';
import toast from 'react-hot-toast';
import { fetchSipsForPricingAction } from '@/app/actions/supplyPointActions';
import { subYears } from 'date-fns';

const TARIFF_OPTIONS = [
  { value: '2.0TD', label: '2.0TD (Hogares / Pequeñas Pymes ≤ 15 kW)' },
  { value: '3.0TD', label: '3.0TD (PYMEs Baja Tensión > 15 kW)' },
  { value: '3.0TDVE', label: '3.0TDVE (Recarga Vehículo Eléctrico BT)' },
  { value: '6.1TD', label: '6.1TD (Alta Tensión 1 kV – 30 kV)' },
  { value: '6.1TDVE', label: '6.1TDVE (Recarga Vehículo Eléctrico AT)' },
  { value: '6.2TD', label: '6.2TD (Alta Tensión 30 kV – 72,5 kV)' },
  { value: '6.3TD', label: '6.3TD (Alta Tensión 72,5 kV – 145 kV)' },
  { value: '6.4TD', label: '6.4TD (Muy Alta Tensión ≥ 145 kV)' },
];

function parseFlexibleDateMs(raw: any): number {
  if (!raw) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  // Formato español DD/MM/YYYY [HH:mm[:ss]]
  const esMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (esMatch) {
    const dd = Number(esMatch[1]);
    const mm = Number(esMatch[2]);
    const yyyy = Number(esMatch[3]);
    return Date.UTC(yyyy, mm - 1, dd);
  }
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function extractIsoDatePrefix(raw: any): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const esMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (esMatch) {
    return `${esMatch[3]}-${esMatch[2].padStart(2, '0')}-${esMatch[1].padStart(2, '0')}`;
  }
  return undefined;
}

export default function PricingPage() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<any>(null);

  const [quoteMode, setQuoteMode] = useState<'generico' | 'cups'>('generico');
  const [cupsInput, setCupsInput] = useState('');
  const [fetchingSips, setFetchingSips] = useState(false);
  const [cupsClientName, setCupsClientName] = useState<string | null>(null);
  const [cupsSourceMode, setCupsSourceMode] = useState<'sips' | 'db_cch'>('sips');
  const [cupsSipsPeriods, setCupsSipsPeriods] = useState<any>(null);
  const [cupsDbCch, setCupsDbCch] = useState<{
    data: number[];
    startDate?: string;
    days: number;
    totalKwh: number;
  } | null>(null);

  const [tariff, setTariff] = useState('2.0TD');
  const [margin, setMargin] = useState('10');
  const [deviations, setDeviations] = useState('3.5');
  const [startDate, setStartDate] = useState(() =>
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
  );
  const [durationMonths, setDurationMonths] = useState('12');
  const [riskLevel, setRiskLevel] = useState('2');

  // Estado propio del modo Cálculo Genérico
  const [genericoInputType, setGenericoInputType] = useState<'estimado' | 'sips' | 'cch'>('estimado');
  const [annualConsumption, setAnnualConsumption] = useState('10000');

  const [sipsData, setSipsData] = useState<any>(null);
  const [sipsFileName, setSipsFileName] = useState('');
  const [sipsSuccess, setSipsSuccess] = useState('');

  const [cchData, setCchData] = useState<number[] | null>(null);
  const [cchStartDate, setCchStartDate] = useState<string | undefined>(undefined);

  const handleFetchSips = async () => {
    if (!cupsInput || cupsInput.trim().length < 20) {
      toast.error('Por favor introduce un CUPS válido (al menos 20 caracteres)');
      return;
    }

    setFetchingSips(true);
    setErrorMsg('');
    setCupsClientName(null);

    try {
      const loadingToast = toast.loading('Consultando ERP y SIPS (INGEBAU)...');
      const res: any = await fetchSipsForPricingAction(cupsInput.trim().toUpperCase());
      toast.dismiss(loadingToast);

      if (res.success) {
        if (res.tarifa) setTariff(res.tarifa);
        setCupsClientName(res.clientName || null);
        setCupsSipsPeriods(res.consumos || null);

        if (res.dbCchData && res.dbCchDays > 0) {
          setCupsDbCch({
            data: res.dbCchData,
            startDate: res.dbCchStartDate,
            days: res.dbCchDays,
            totalKwh: res.dbCchTotalKwh,
          });
          // Si tenemos curva casi anual (>= 300 días) o no hay periodos SIPS, priorizar telemedida real
          if (res.dbCchDays >= 300 || !res.consumos) {
            setCupsSourceMode('db_cch');
          } else {
            setCupsSourceMode('sips');
          }
        } else {
          setCupsDbCch(null);
          setCupsSourceMode('sips');
        }

        toast.success(
          res.dbCchData
            ? `Datos cargados (SIPS + ${res.dbCchDays} días de telemedida CCH en ERP)`
            : 'Datos de SIPS cargados correctamente'
        );
      } else {
        setErrorMsg(res.error || 'Error desconocido al consultar el CUPS');
        toast.error(res.error || 'Error al obtener datos del CUPS');
      }
    } catch {
      setErrorMsg('Error al conectar con el servidor para consultar el CUPS');
      toast.error('Error al consultar CUPS');
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
      setSyncMessage(
        data.message || 'Portfolio sincronizado correctamente. La curva base actualizada ya está disponible.'
      );
      setTimeout(() => setSyncMessage(''), 8000);
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
        let p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0, p6 = 0;
        let maxDate = 0;
        let detectedTariff = '';

        for (const row of rows) {
          const keys = Object.keys(row);
          for (const k of keys) {
            const kl = k.toUpperCase();
            if (kl.includes('LECTURA HASTA') || kl.includes('FECHA_FIN') || kl.includes('FECHA HASTA')) {
              const d = parseFlexibleDateMs(row[k]);
              if (d > maxDate) maxDate = d;
            }
          }
        }

        const cutoff = maxDate > 0 ? subYears(new Date(maxDate), 1).getTime() : 0;

        for (const row of rows) {
          if (cutoff > 0) {
            let rowMaxDate = 0;
            const keys = Object.keys(row);
            for (const k of keys) {
              const kl = k.toUpperCase();
              if (kl.includes('LECTURA HASTA') || kl.includes('LECTURA DESDE') || kl.includes('FECHA')) {
                const d = parseFlexibleDateMs(row[k]);
                if (d > rowMaxDate) rowMaxDate = d;
              }
            }
            if (rowMaxDate > 0 && rowMaxDate < cutoff) continue;
          }

          const keys = Object.keys(row);
          for (const k of keys) {
            const kl = k.toUpperCase();
            const isExcluded =
              kl.includes('REACTIVA') ||
              kl.includes('REAC') ||
              kl.includes('SALIENTE') ||
              kl.includes('EXCEDENTE') ||
              kl.includes('GENERACION');

            if ((kl.includes('ENERGIA') || kl.includes('ACTIVA') || kl.includes('AE_')) && !isExcluded) {
              const val = parseFloat(row[k]?.toString().replace(',', '.') || '0');
              if (isNaN(val)) continue;
              if (kl.includes('P1')) p1 += val;
              else if (kl.includes('P2')) p2 += val;
              else if (kl.includes('P3')) p3 += val;
              else if (kl.includes('P4')) p4 += val;
              else if (kl.includes('P5')) p5 += val;
              else if (kl.includes('P6')) p6 += val;
            } else if (kl.includes('TARIFA') && typeof row[k] === 'string' && row[k].trim() !== '') {
              detectedTariff = row[k].trim().replace(/\s+/g, '').toUpperCase();
            }
          }
        }

        if (detectedTariff) {
          if (detectedTariff.includes('3.0TDVE')) setTariff('3.0TDVE');
          else if (detectedTariff.includes('6.1TDVE')) setTariff('6.1TDVE');
          else if (detectedTariff.includes('2.0')) setTariff('2.0TD');
          else if (detectedTariff.includes('3.0')) setTariff('3.0TD');
          else if (detectedTariff.includes('6.1')) setTariff('6.1TD');
          else if (detectedTariff.includes('6.2')) setTariff('6.2TD');
          else if (detectedTariff.includes('6.3')) setTariff('6.3TD');
          else if (detectedTariff.includes('6.4')) setTariff('6.4TD');
        }

        if (p1 + p2 + p3 + p4 + p5 + p6 === 0) {
          setErrorMsg('No se encontraron columnas de energía activa entrante P1-P6 en el CSV');
          setSipsData(null);
        } else {
          setSipsData({ p1, p2, p3, p4, p5, p6 });
          setSipsSuccess(`SIPS procesado: ${(p1 + p2 + p3 + p4 + p5 + p6).toFixed(0)} kWh anuales`);
        }
      },
      error: (err) => setErrorMsg(`Error leyendo CSV: ${err.message}`),
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
        if (!rows || rows.length === 0) {
          setErrorMsg('El archivo CSV está vacío.');
          setCchData(null);
          return;
        }

        const sampleKeys = Object.keys(rows[0] || {});
        // Identificar columna de consumo entrante (compatible con exportador propio `consumo_kwh`, distribuidoras y comercializadoras)
        const consumptionKey =
          sampleKeys.find((k) => {
            const kl = k.toLowerCase();
            const isExcluded =
              kl.includes('excedente') ||
              kl.includes('saliente') ||
              kl.includes('generacion') ||
              kl.includes('vertido') ||
              kl.includes('reactiva') ||
              kl.includes('reac');
            if (isExcluded) return false;
            return (
              kl === 'consumo_kwh' ||
              kl.includes('consumo') ||
              kl.includes('entrante') ||
              kl.includes('energia') ||
              kl.includes('energía') ||
              kl.includes('activa') ||
              kl === 'ae' ||
              kl === 'kwh'
            );
          }) ||
          (sampleKeys.length === 2
            ? sampleKeys.find((k) => {
                const kl = k.toLowerCase();
                return !kl.includes('date') && !kl.includes('fecha') && !kl.includes('tiempo') && !kl.includes('hora');
              })
            : undefined);

        const dateKey = sampleKeys.find((k) => {
          const kl = k.toLowerCase();
          return kl.includes('fecha') || kl.includes('date') || kl.includes('datetime') || kl.includes('tiempo');
        });

        if (!consumptionKey) {
          setErrorMsg(
            'No se encontró columna de consumo horario en el CSV (ej. consumo_kwh, consumo, energia, activa).'
          );
          setCchData(null);
          return;
        }

        const rawValues: number[] = [];
        let hasQuarterHourTimestamps = false;
        let firstIsoDate: string | undefined = undefined;

        for (const row of rows) {
          const rawStr = row[consumptionKey]?.toString().trim().replace(',', '.');
          if (rawStr === undefined || rawStr === '') continue;
          const val = parseFloat(rawStr);
          if (Number.isNaN(val)) continue;

          if (dateKey && row[dateKey]) {
            const ds = String(row[dateKey]);
            if (!firstIsoDate) firstIsoDate = extractIsoDatePrefix(ds);
            if (/:15|:30|:45/.test(ds)) {
              hasQuarterHourTimestamps = true;
            }
          }

          rawValues.push(val);
        }

        if (rawValues.length === 0) {
          setErrorMsg('No se pudieron extraer valores numéricos de consumo del CSV.');
          setCchData(null);
          return;
        }

        const isQuarterHourly = hasQuarterHourTimestamps || rawValues.length >= 20000;
        let hourlyArr: number[] = rawValues;
        if (isQuarterHourly) {
          hourlyArr = [];
          for (let idx = 0; idx < rawValues.length; idx += 4) {
            hourlyArr.push(
              (rawValues[idx] || 0) +
              (rawValues[idx + 1] || 0) +
              (rawValues[idx + 2] || 0) +
              (rawValues[idx + 3] || 0)
            );
          }
        }

        const totalKwh = hourlyArr.reduce((a, b) => a + b, 0);
        setCchData(hourlyArr);
        setCchStartDate(firstIsoDate);
        setSipsSuccess(
          isQuarterHourly
            ? `Curva cuarto-horaria convertida: ${hourlyArr.length} h (${rawValues.length} cuartos) · Total: ${(totalKwh / 1000).toFixed(2)} MWh`
            : `Curva horaria procesada: ${hourlyArr.length} horas · Total: ${(totalKwh / 1000).toFixed(2)} MWh`
        );
      },
      error: (err) => setErrorMsg(`Error leyendo CSV: ${err.message}`),
    });
  };

  const handleCalculate = async () => {
    const payload: any = {
      tariff,
      margin: Number(margin),
      deviations: Number(deviations),
      startDate,
      durationMonths: Number(durationMonths),
      riskLevel: Number(riskLevel),
    };

    if (quoteMode === 'cups') {
      if (cupsSourceMode === 'db_cch' && cupsDbCch) {
        payload.cchData = cupsDbCch.data;
        payload.cchStartDate = cupsDbCch.startDate;
      } else if (cupsSipsPeriods) {
        payload.sipsData = cupsSipsPeriods;
      } else {
        return setErrorMsg('Consulta primero un CUPS válido para cargar sus consumos.');
      }
    } else {
      if (genericoInputType === 'estimado') {
        if (!annualConsumption || Number(annualConsumption) <= 0) {
          return setErrorMsg('Introduce un consumo anual mayor que 0 kWh.');
        }
        payload.annualConsumptionKwh = Number(annualConsumption);
      } else if (genericoInputType === 'sips') {
        if (!sipsData) return setErrorMsg('Debes subir un archivo SIPS (.csv) primero.');
        payload.sipsData = sipsData;
      } else if (genericoInputType === 'cch') {
        if (!cchData) return setErrorMsg('Debes subir el archivo CSV de la CCH real primero.');
        payload.cchData = cchData;
        payload.cchStartDate = cchStartDate;
      }
    }

    try {
      setLoading(true);
      setErrorMsg('');

      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const handleCopyOfferPrices = () => {
    if (!result?.periods) return;
    const lines: string[] = [
      `Oferta ${tariff} (${durationMonths} meses · Inicio ${startDate})`,
      `Precio Fijo 24h: ${result.flatPriceEurMwh.toFixed(2)} €/MWh (${(result.flatPriceEurMwh / 1000).toFixed(6)} €/kWh)`,
    ];
    for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
      if (result.periods[p]) {
        const pr = result.periods[p];
        lines.push(
          `${p}: ${pr.priceEurMwh.toFixed(2)} €/MWh | ${(pr.priceEurMwh / 1000).toFixed(6)} €/kWh (${pr.percentage.toFixed(1)}%)`
        );
      }
    }
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Precios copiados al portapapeles');
  };

  const handleExportExcel = () => {
    if (!result || !result.hourlyDetails) return;

    const totConsKwh =
      result.totalConsumptionKwh ||
      result.hourlyDetails.reduce((sum: number, h: any) => sum + h.consumoKwh, 0);
    const totConsMwh = totConsKwh / 1000;
    const marginNum = Number(margin);
    const marginGrossUp = marginNum / 0.985;

    const periodsSummary = [];
    for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) {
      if (!result.periods[p]) continue;
      const hoursInP = result.hourlyDetails.filter((h: any) => h.per === p);
      const c = hoursInP.reduce((s: number, h: any) => s + h.consumoKwh, 0);
      const eAbs = hoursInP.reduce(
        (s: number, h: any) => s + (h.baseMercadoEur + h.sumCompsEur + h.desviosEur) * (h.consumoKwh / 1000),
        0
      );
      const lossAbs = hoursInP.reduce(
        (s: number, h: any) => s + (h.costeConPerdidasEur - h.energiaPuraEur) * (h.consumoKwh / 1000),
        0
      );
      const regAbs = hoursInP.reduce(
        (s: number, h: any) => s + h.regTotalEur * (h.consumoKwh / 1000),
        0
      );
      const costAbs = hoursInP.reduce((s: number, h: any) => s + h.absTotalEur, 0);
      const offerMwh = result.periods[p].priceEurMwh;
      const costMwh = result.periods[p].costEurMwh ?? offerMwh - marginGrossUp;

      periodsSummary.push({
        CONCEPTO: p,
        'COSTE EMPRESA (€/MWh)': Number(costMwh.toFixed(3)),
        'COSTE ENERGÍA + SSAA (€/MWh)': c > 0 ? Number((eAbs / (c / 1000)).toFixed(2)) : 0,
        'COSTE PÉRDIDAS (€/MWh)': c > 0 ? Number((lossAbs / (c / 1000)).toFixed(2)) : 0,
        'COSTE REGULADO (€/MWh)': c > 0 ? Number((regAbs / (c / 1000)).toFixed(2)) : 0,
        'MARGEN NETO (€/MWh)': marginNum,
        'PRECIO OFERTA (€/MWh)': Number(offerMwh.toFixed(3)),
        'PRECIO OFERTA (€/kWh)': Number((offerMwh / 1000).toFixed(6)),
        'CONSUMO PROYECTADO (kWh)': Math.round(c),
        'CONSUMO PROYECTADO (MWh)': Number((c / 1000).toFixed(3)),
        '% CONSUMO': Number(((c / totConsKwh) * 100).toFixed(2)),
        'FACTURACIÓN ESTIMADA (€)': Number(costAbs.toFixed(2)),
      });
    }

    const flatCost = result.flatCostEurMwh ?? result.flatPriceEurMwh - marginGrossUp;
    periodsSummary.push({
      CONCEPTO: 'PRECIO FIJO 24H (PONDERADO)',
      'COSTE EMPRESA (€/MWh)': Number(flatCost.toFixed(3)),
      'COSTE ENERGÍA + SSAA (€/MWh)': totConsMwh > 0 ? Number((result.breakdown.energyCostEur / totConsMwh).toFixed(2)) : 0,
      'COSTE PÉRDIDAS (€/MWh)': totConsMwh > 0 ? Number((result.breakdown.lossesCostEur / totConsMwh).toFixed(2)) : 0,
      'COSTE REGULADO (€/MWh)': totConsMwh > 0 ? Number((result.breakdown.regulatedCostEur / totConsMwh).toFixed(2)) : 0,
      'MARGEN NETO (€/MWh)': marginNum,
      'PRECIO OFERTA (€/MWh)': Number(result.flatPriceEurMwh.toFixed(3)),
      'PRECIO OFERTA (€/kWh)': Number((result.flatPriceEurMwh / 1000).toFixed(6)),
      'CONSUMO PROYECTADO (kWh)': Math.round(totConsKwh),
      'CONSUMO PROYECTADO (MWh)': Number(totConsMwh.toFixed(3)),
      '% CONSUMO': 100.0,
      'FACTURACIÓN ESTIMADA (€)': Number(result.breakdown.totalEur.toFixed(2)),
    });

    const wb = XLSX.utils.book_new();
    const wsPropuesta = XLSX.utils.json_to_sheet(periodsSummary);
    XLSX.utils.book_append_sheet(wb, wsPropuesta, 'PROPUESTA_COMERCIAL');

    const detalleExport = result.hourlyDetails.map((h: any) => ({
      datetime: h.datetime,
      per: h.per,
      consumo: Number(h.consumoKwh.toFixed(3)),
      loss_f: Number(h.lossFactor.toFixed(4)),
      Unit_Base_Mercado: Number(h.baseMercadoEur.toFixed(3)),
      Unit_Componentes_Sistema: Number(h.sumCompsEur.toFixed(3)),
      Unit_Desvios: Number(h.desviosEur.toFixed(3)),
      Unit_Energia_Pura: Number(h.energiaPuraEur.toFixed(3)),
      Unit_Coste_Con_Perdidas: Number(h.costeConPerdidasEur.toFixed(3)),
      Unit_Reg_Total: Number(h.regTotalEur.toFixed(3)),
      Unit_Margen: Number(h.margenEur.toFixed(3)),
      Unit_Subtotal: Number(h.subtotalEur.toFixed(3)),
      Unit_Tasa_Munic: Number(h.tasaMunicEur.toFixed(3)),
      Unit_Precio_Final: Number(h.precioFinalEur.toFixed(3)),
      Abs_Total: Number(h.absTotalEur.toFixed(3)),
    }));

    const wsDetalle = XLSX.utils.json_to_sheet(detalleExport);
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'DETALLE_HORARIO');

    const tsNow = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    XLSX.writeFile(wb, `${tsNow}_${tariff}_${durationMonths}m_riesgo_${riskLevel}_fee_${margin}.xlsx`);
  };

  const getChartData = () => {
    if (!result) return [];
    return Object.entries(result.periods).map(([period, data]: [string, any]) => ({
      name: period,
      PrecioOfertado: data.priceEurMwh,
      CostePuro: data.costEurMwh,
    }));
  };

  const PIE_COLORS = ['#0ea5e9', '#f97316', '#10b981', '#6366f1', '#a855f7'];
  const getPieData = () => {
    if (!result) return [];
    const b = result.breakdown;
    const taxEur =
      b.municipalTaxEur !== undefined
        ? b.municipalTaxEur
        : Math.max(0, b.totalEur - (b.energyCostEur + b.lossesCostEur + b.regulatedCostEur + b.marginEur));

    return [
      { name: 'Energía + SSAA', value: b.energyCostEur },
      { name: 'Pérdidas Red', value: b.lossesCostEur },
      { name: 'Costes Regulados', value: b.regulatedCostEur },
      { name: 'Margen Comercial', value: b.marginEur },
      { name: 'Tasa Municipal (1,5%)', value: taxEur },
    ].filter((i) => i.value > 0);
  };

  const activePeriodKeys = tariff.includes('2.0')
    ? (['p1', 'p2', 'p3'] as const)
    : (['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const);

  const estimatedHoursCount = Number(durationMonths) * 730;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '40px' }}>
      <Topbar
        title="Pricing & Cotizador"
        subtitle="Motor financiero predictivo con reconstrucción CCH vía REE y cobertura a 36 meses."
        customActions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {syncMessage && (
              <span
                style={{
                  color: '#10b981',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                className="animate-in fade-in duration-300"
              >
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

      <div
        style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto' }}
        className="space-y-6 animate-in fade-in duration-500"
      >
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            gap: '16px',
            alignItems: 'flex-start',
          }}
          className="shadow-sm"
        >
          <Info className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--accent)', marginTop: '2px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Información del Orquestador PPA:</strong> La curva base del
            portfolio se actualiza automáticamente todos los días a las 02:00 AM reflejando las últimas cotizaciones de
            OMIE (Futuros), los 14 componentes horarios de ajuste (COMPODEM), la cartera viva activa y los PPAs
            habilitados. Puedes forzar el recálculo en cualquier momento con <em>&quot;Sincronizar Portfolio Ahora&quot;</em>.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #f87171',
              color: '#b91c1c',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '0.9rem',
            }}
          >
            <strong>Error:</strong> {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FORMULARIO */}
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
            }}
            className="lg:col-span-1 flex flex-col space-y-5 shadow-sm"
          >
            <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  Parámetros
                </h2>
              </div>
            </div>

            {/* Selector de Modo */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-base)',
                borderRadius: '8px',
                padding: '4px',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setQuoteMode('generico');
                  setErrorMsg('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: quoteMode === 'generico' ? 'var(--bg-elevated)' : 'transparent',
                  color: quoteMode === 'generico' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: quoteMode === 'generico' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                Cálculo Genérico
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuoteMode('cups');
                  setErrorMsg('');
                }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: quoteMode === 'cups' ? 'var(--bg-elevated)' : 'transparent',
                  color: quoteMode === 'cups' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: quoteMode === 'cups' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                Por CUPS
              </button>
            </div>

            {quoteMode === 'cups' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Introducir CUPS
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cupsInput}
                      onChange={(e) => setCupsInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFetchSips();
                      }}
                      placeholder="ES00..."
                      style={{
                        background: 'var(--bg-base)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        borderStyle: 'solid',
                        borderWidth: '1px',
                      }}
                      className="outline-none flex-1 font-mono uppercase text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleFetchSips}
                      disabled={fetchingSips || !cupsInput}
                      className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                      title="Consultar ERP y SIPS"
                    >
                      {fetchingSips ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    </button>
                  </div>
                </div>

                {cupsClientName && (
                  <div
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Cliente en ERP: <strong style={{ color: 'var(--text-primary)' }}>{cupsClientName}</strong>
                  </div>
                )}

                {(cupsDbCch || cupsSipsPeriods) && (
                  <div
                    style={{
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                    className="space-y-3"
                  >
                    {cupsDbCch && cupsSipsPeriods && (
                      <div
                        style={{
                          display: 'flex',
                          background: 'var(--bg-elevated)',
                          borderRadius: '8px',
                          padding: '3px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setCupsSourceMode('db_cch')}
                          style={{
                            flex: 1,
                            padding: '6px 4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            background: cupsSourceMode === 'db_cch' ? 'var(--bg-base)' : 'transparent',
                            color: cupsSourceMode === 'db_cch' ? 'var(--text-primary)' : 'var(--text-muted)',
                            border: cupsSourceMode === 'db_cch' ? '1px solid var(--accent)' : '1px solid transparent',
                          }}
                        >
                          CCH Real ERP ({cupsDbCch.days}d)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCupsSourceMode('sips')}
                          style={{
                            flex: 1,
                            padding: '6px 4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            background: cupsSourceMode === 'sips' ? 'var(--bg-base)' : 'transparent',
                            color: cupsSourceMode === 'sips' ? 'var(--text-primary)' : 'var(--text-muted)',
                            border: cupsSourceMode === 'sips' ? '1px solid var(--accent)' : '1px solid transparent',
                          }}
                        >
                          Consumos SIPS
                        </button>
                      </div>
                    )}

                    {cupsSourceMode === 'db_cch' && cupsDbCch ? (
                      <div className="flex items-start gap-2 text-xs" style={{ color: '#10b981' }}>
                        <Database className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>
                          Telemedida real detectada en BD: <strong>{cupsDbCch.days} días</strong> (
                          <strong>{(cupsDbCch.totalKwh / 1000).toFixed(2)} MWh</strong>). Se cotizará sobre su curva
                          horaria real alineada estacionalmente.
                        </span>
                      </div>
                    ) : (
                      cupsSipsPeriods && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span className="font-semibold">Consumos SIPS Anuales (kWh)</span>
                            <span style={{ color: '#10b981', fontWeight: 700 }}>
                              Total:{' '}
                              {Object.values(cupsSipsPeriods)
                                .reduce((a: number, b: any) => a + (Number(b) || 0), 0)
                                .toLocaleString('es-ES', { maximumFractionDigits: 0 })}{' '}
                              kWh
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {activePeriodKeys.map((pk) => (
                              <div key={pk}>
                                <label
                                  className="block text-[11px] font-bold uppercase mb-0.5"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {pk.toUpperCase()}
                                </label>
                                <input
                                  type="number"
                                  value={cupsSipsPeriods[pk] ?? 0}
                                  onChange={(e) =>
                                    setCupsSipsPeriods({
                                      ...cupsSipsPeriods,
                                      [pk]: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  style={{
                                    background: 'var(--bg-elevated)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-primary)',
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    borderStyle: 'solid',
                                    borderWidth: '1px',
                                    fontSize: '0.8rem',
                                  }}
                                  className="outline-none font-mono"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tarifa disponible en ambos modos (editable también tras consultar CUPS) */}
            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Tarifa de Acceso
              </label>
              <select
                value={tariff}
                onChange={(e) => setTariff(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                }}
                className="outline-none"
              >
                {TARIFF_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    background: 'var(--bg-base)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                  }}
                  className="outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Período
                </label>
                <select
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  style={{
                    background: 'var(--bg-base)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    borderStyle: 'solid',
                    borderWidth: '1px',
                  }}
                  className="outline-none"
                >
                  <option value="12">12 Meses</option>
                  <option value="24">24 Meses</option>
                  <option value="36">36 Meses</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Nivel de Riesgo (Cobertura)
              </label>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                }}
                className="outline-none"
              >
                <option value="1">1 - Bajo (Protección de margen, precios más altos)</option>
                <option value="2">2 - Medio (Costes de sistema estándar)</option>
                <option value="3">3 - Alto (Costes ajustados, máxima competitividad)</option>
              </select>
            </div>

            {quoteMode === 'generico' && (
              <div
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  padding: '16px',
                  borderRadius: '12px',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                }}
                className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
              >
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-elevated)',
                    borderRadius: '8px',
                    padding: '4px',
                    border: '1px solid var(--border)',
                  }}
                >
                  {(
                    [
                      { id: 'estimado', label: 'Volumen' },
                      { id: 'sips', label: 'SIPS CSV' },
                      { id: 'cch', label: 'CCH Real' },
                    ] as const
                  ).map((tab) => {
                    const isActive = genericoInputType === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setGenericoInputType(tab.id)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          background: isActive ? 'var(--bg-base)' : 'transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                          border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {genericoInputType === 'estimado' ? (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Consumo Anual (kWh)
                    </label>
                    <input
                      type="number"
                      value={annualConsumption}
                      onChange={(e) => setAnnualConsumption(e.target.value)}
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-primary)',
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        borderStyle: 'solid',
                        borderWidth: '1px',
                      }}
                      className="outline-none"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Se perfilará hora a hora con la curva inicial REE correspondiente a {tariff}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {genericoInputType === 'sips'
                        ? 'Sube el archivo SIPS (.csv)'
                        : 'Sube la Curva CCH Horaria o Cuarto-Horaria (.csv)'}
                    </label>
                    <div
                      style={{
                        borderColor: 'var(--accent)',
                        background: 'var(--bg-elevated)',
                        borderStyle: 'dashed',
                        borderWidth: '2px',
                        borderRadius: '12px',
                        padding: '20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <input
                        type="file"
                        accept=".csv"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          cursor: 'pointer',
                          width: '100%',
                          height: '100%',
                        }}
                        onChange={genericoInputType === 'sips' ? handleFileUpload : handleCchUpload}
                      />
                      <UploadCloud className="w-9 h-9 mx-auto mb-2" style={{ color: 'var(--accent)' }} />
                      <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {sipsFileName || 'Arrastra el CSV o haz clic'}
                      </p>
                    </div>
                    {sipsSuccess && (
                      <div
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          color: '#10b981',
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          marginTop: '8px',
                        }}
                      >
                        <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>{sipsSuccess}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Margen Comercial Neto (€/MWh)
              </label>
              <input
                type="number"
                step="0.5"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                }}
                className="outline-none font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Coste de Desvíos Previsto (€/MWh)
              </label>
              <input
                type="number"
                step="0.1"
                value={deviations}
                onChange={(e) => setDeviations(e.target.value)}
                style={{
                  background: 'var(--bg-base)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  borderStyle: 'solid',
                  borderWidth: '1px',
                }}
                className="outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleCalculate}
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '12px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                fontSize: '1rem',
              }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calculator className="w-5 h-5" />}
              {loading
                ? `Calculando ${estimatedHoursCount.toLocaleString('es-ES')} horas...`
                : 'Generar Cotización'}
            </button>
          </div>

          {/* DASHBOARD */}
          <div className="lg:col-span-2 space-y-6">
            {!result ? (
              <div
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  borderStyle: 'dashed',
                  borderWidth: '2px',
                  borderRadius: '24px',
                  padding: '48px',
                  minHeight: '500px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap className="w-20 h-20 mb-6 animate-pulse" style={{ color: 'var(--border)' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Motor a la espera
                </h3>
                <p style={{ textAlign: 'center', maxWidth: '320px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Ajusta los parámetros a la izquierda y pulsa Generar Cotización para simular hora a hora la oferta.
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                {/* KPIS */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                      borderRadius: '16px',
                      padding: '20px',
                      borderLeft: '4px solid var(--accent)',
                    }}
                    className="border shadow-sm"
                  >
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Precio Fijo 24h
                    </h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {result.flatPriceEurMwh.toFixed(2)}
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>
                      €/MWh · {(result.flatPriceEurMwh / 1000).toFixed(5)} €/kWh
                    </p>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                      borderRadius: '16px',
                      padding: '20px',
                      borderLeft: '4px solid #10b981',
                    }}
                    className="border shadow-sm"
                  >
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Beneficio Neto
                    </h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: '#10b981' }}>
                      +{result.breakdown.marginEur.toFixed(0)}
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981', marginTop: '4px' }}>
                      € ({durationMonths} Meses)
                    </p>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                      borderRadius: '16px',
                      padding: '20px',
                      borderLeft: '4px solid #a855f7',
                    }}
                    className="border shadow-sm"
                  >
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Cargos y Peajes
                    </h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {result.breakdown.regulatedCostEur.toFixed(0)}
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a855f7', marginTop: '4px' }}>
                      € (Regulado Energía)
                    </p>
                  </div>
                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                      borderRadius: '16px',
                      padding: '20px',
                      borderLeft: '4px solid #f97316',
                    }}
                    className="border shadow-sm"
                  >
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Facturación Est.
                    </h3>
                    <div style={{ fontSize: '1.875rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {result.breakdown.totalEur.toFixed(0)}
                    </div>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f97316', marginTop: '4px' }}>
                      € ({((result.totalConsumptionKwh || 0) / 1000).toFixed(2)} MWh)
                    </p>
                  </div>
                </div>

                {/* TABLA EJECUTIVA DE PRECIOS POR PERIODO */}
                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                    borderRadius: '16px',
                    padding: '20px 24px',
                  }}
                  className="border shadow-sm"
                >
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Propuesta de Precios por Periodo ({tariff} · {durationMonths} Meses)
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Precios finales todo incluido (Energía + SSAA + Pérdidas + ATR Energía + FNEE + Tasa 1,5% + Fee)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyOfferPrices}
                        className="btn"
                        style={{
                          background: 'var(--bg-base)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                        }}
                      >
                        <Copy size={15} />
                        Copiar Precios
                      </button>
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="btn"
                        style={{
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                        }}
                      >
                        <Download size={15} />
                        Exportar XLSX
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th className="py-2.5 px-3 text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                            Periodo
                          </th>
                          <th
                            className="py-2.5 px-3 text-xs font-bold uppercase text-right"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Volumen ({durationMonths}m)
                          </th>
                          <th
                            className="py-2.5 px-3 text-xs font-bold uppercase text-right"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Peso
                          </th>
                          <th
                            className="py-2.5 px-3 text-xs font-bold uppercase text-right"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Coste Empresa
                          </th>
                          <th
                            className="py-2.5 px-3 text-xs font-bold uppercase text-right"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Oferta (€/MWh)
                          </th>
                          <th
                            className="py-2.5 px-3 text-xs font-bold uppercase text-right"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Oferta (€/kWh)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((p) => {
                          const pr = result.periods[p];
                          if (!pr) return null;
                          return (
                            <tr key={p} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td className="py-2.5 px-3 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {p}
                              </td>
                              <td
                                className="py-2.5 px-3 text-sm text-right font-mono"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                {Math.round(pr.consumptionKwh || 0).toLocaleString('es-ES')} kWh
                              </td>
                              <td
                                className="py-2.5 px-3 text-sm text-right font-mono"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {pr.percentage.toFixed(1)}%
                              </td>
                              <td
                                className="py-2.5 px-3 text-sm text-right font-mono"
                                style={{ color: '#ea580c', fontWeight: 600 }}
                              >
                                {pr.costEurMwh.toFixed(2)} €/MWh
                              </td>
                              <td
                                className="py-2.5 px-3 text-sm text-right font-mono font-bold"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {pr.priceEurMwh.toFixed(2)} €/MWh
                              </td>
                              <td
                                className="py-2.5 px-3 text-sm text-right font-mono font-bold"
                                style={{ color: '#10b981' }}
                              >
                                {(pr.priceEurMwh / 1000).toFixed(6)} €/kWh
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: 'var(--bg-base)' }}>
                          <td className="py-3 px-3 font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>
                            FIJO 24H
                          </td>
                          <td
                            className="py-3 px-3 text-sm text-right font-mono font-bold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {Math.round(result.totalConsumptionKwh || 0).toLocaleString('es-ES')} kWh
                          </td>
                          <td
                            className="py-3 px-3 text-sm text-right font-mono font-bold"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            100.0%
                          </td>
                          <td
                            className="py-3 px-3 text-sm text-right font-mono font-bold"
                            style={{ color: '#ea580c' }}
                          >
                            {(result.flatCostEurMwh ?? result.flatPriceEurMwh - Number(margin) / 0.985).toFixed(2)}{' '}
                            €/MWh
                          </td>
                          <td
                            className="py-3 px-3 text-sm text-right font-mono font-extrabold"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {result.flatPriceEurMwh.toFixed(2)} €/MWh
                          </td>
                          <td
                            className="py-3 px-3 text-sm text-right font-mono font-extrabold"
                            style={{ color: '#10b981' }}
                          >
                            {(result.flatPriceEurMwh / 1000).toFixed(6)} €/kWh
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* GRÁFICOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                      borderRadius: '16px',
                      padding: '24px',
                    }}
                    className="border shadow-sm"
                  >
                    <h3
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '8px',
                        marginBottom: '24px',
                      }}
                    >
                      Ofertado vs Coste Empresa
                    </h3>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getChartData()} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--text-muted)', fontWeight: 500 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'var(--text-muted)' }}
                            tickFormatter={(val) => `€${val}`}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--border)' }}
                            contentStyle={{
                              borderRadius: '12px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-elevated)',
                              color: 'var(--text-primary)',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            }}
                            formatter={(value: any) => [`${Number(value).toFixed(2)} €/MWh`, '']}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', color: 'var(--text-secondary)' }} />
                          <Bar
                            dataKey="PrecioOfertado"
                            fill="#10b981"
                            name="Precio Ofertado"
                            radius={[6, 6, 0, 0]}
                            barSize={24}
                          />
                          <Bar
                            dataKey="CostePuro"
                            fill="#ea580c"
                            name="Coste Empresa"
                            radius={[6, 6, 0, 0]}
                            barSize={24}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--bg-elevated)',
                      borderColor: 'var(--border)',
                      borderRadius: '16px',
                      padding: '24px',
                    }}
                    className="border shadow-sm"
                  >
                    <h3
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '8px',
                        marginBottom: '24px',
                      }}
                    >
                      Distribución del Coste
                    </h3>
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
                            {getPieData().map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: '12px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-elevated)',
                              color: 'var(--text-primary)',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            }}
                            formatter={(val: any) => [`${Number(val).toFixed(2)} €`, '']}
                          />
                          <Legend
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}
                          />
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
