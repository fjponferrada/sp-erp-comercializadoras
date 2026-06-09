"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createSolarQuoteAction } from "@/app/actions/solarActions";

export default function AutoconsumoCalculator() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Datos Cliente
  const [clientData, setClientData] = useState({
    name: "",
    lastName: "",
    email: "",
    phone: "",
    city: ""
  });

  // Parámetros
  const [panelsCount, setPanelsCount] = useState(10);
  const [panelPowerWp, setPanelPowerWp] = useState(450);
  const [subtotalBudget, setSubtotalBudget] = useState(5000);
  
  // Consumos
  const [consumptions, setConsumptions] = useState<number[]>(Array(12).fill(300));

  // Cálculos en Tiempo Real
  const peakPowerKwp = (panelsCount * panelPowerWp) / 1000;
  const totalBudget = subtotalBudget * 1.21;
  const subsidy = 600 * peakPowerKwp;
  
  // Estimación muy básica de ahorro: 60% del consumo a 0.15€/kWh
  const totalAnnualConsumption = consumptions.reduce((a, b) => a + Number(b), 0);
  const annualSavings = totalAnnualConsumption * 0.60 * 0.15; 
  const monthlySavings = annualSavings / 12;
  
  const paybackYears = annualSavings > 0 ? (totalBudget - subsidy) / annualSavings : 0;
  
  // Fórmulas de Airtable
  const rawInstallments = Math.ceil(paybackYears * 12 + 12);
  const installmentsCount = Math.min(Math.max(rawInstallments, 12), 120);
  const installmentAmount = (totalBudget * 1.3) / installmentsCount;

  const handleConsChange = (index: number, val: string) => {
    const newCons = [...consumptions];
    newCons[index] = Number(val);
    setConsumptions(newCons);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    const res = await createSolarQuoteAction({
      clientData,
      panelsCount,
      panelPowerWp,
      peakPowerKwp,
      totalBudget,
      subsidy,
      annualSavings,
      monthlySavings,
      paybackYears,
      installmentsCount,
      installmentAmount,
      consumptions
    });

    if (res.success) {
      router.push("/autoconsumo");
    } else {
      alert("Error: " + res.error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">Calculadora Solar</h1>
          <p className="text-slate-400 mt-2">Introduce los datos para calcular rentabilidad y generar presupuesto</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSubmitting}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
        >
          {isSubmitting ? "Guardando..." : "Generar y Guardar PDF"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Columna Izquierda: Inputs */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">1. Datos del Cliente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Nombre</label>
                <input type="text" value={clientData.name} onChange={e=>setClientData({...clientData, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200" placeholder="Ej. María" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Apellidos</label>
                <input type="text" value={clientData.lastName} onChange={e=>setClientData({...clientData, lastName: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200" placeholder="Ej. García" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">2. Parámetros de la Instalación</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Número de Paneles</label>
                <input type="number" value={panelsCount} onChange={e=>setPanelsCount(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Potencia Panel (Wp)</label>
                <input type="number" value={panelPowerWp} onChange={e=>setPanelPowerWp(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Subtotal Base (€)</label>
                <input type="number" value={subtotalBudget} onChange={e=>setSubtotalBudget(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200" />
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">3. Histórico de Consumos (kWh)</h2>
            <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
              {consumptions.map((val, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Mes {i+1}</label>
                  <input type="number" value={val} onChange={e=>handleConsChange(i, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-slate-200 text-sm" />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Columna Derecha: Resultados */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(245,158,11,0.05)] sticky top-8">
            <h2 className="text-xl font-semibold text-amber-400 mb-6 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Rentabilidad
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-slate-400">Potencia Pico</span>
                <span className="font-mono text-lg text-slate-200">{peakPowerKwp.toFixed(2)} kWp</span>
              </div>
              
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-slate-400">Total Presupuesto (IVA inc)</span>
                <span className="font-mono text-lg text-slate-200">{totalBudget.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-slate-400">Subvención (Estimada)</span>
                <span className="font-mono text-lg text-emerald-400">-{subsidy.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-slate-400">Ahorro Mensual</span>
                <span className="font-mono text-lg text-emerald-400">+{monthlySavings.toLocaleString('es-ES', {style: 'currency', currency: 'EUR'})}</span>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl mt-6">
                <div className="text-sm text-slate-400 mb-1">Payback (Amortización)</div>
                <div className="text-3xl font-bold text-amber-400">{paybackYears.toFixed(1)} años</div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl">
                <div className="text-sm text-slate-400 mb-1">Financiación Sugerida</div>
                <div className="flex items-end gap-2">
                  <div className="text-3xl font-bold text-slate-200">{installmentAmount.toFixed(2)}€</div>
                  <div className="text-slate-400 pb-1">/ mes ({installmentsCount} cuotas)</div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
