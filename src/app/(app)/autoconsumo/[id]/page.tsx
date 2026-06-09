import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Sun, MapPin, User, ArrowLeft, Zap, FileText, CheckCircle, Euro } from 'lucide-react';
import Link from 'next/link';

export default async function SolarQuoteDetailsPage({ params }: { params: { id: string } }) {
  const quote = await prisma.solarQuote.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      supplyPoint: true
    }
  });

  if (!quote) notFound();

  const STATUS_COLORS: Record<string, string> = {
    'VIABILIDAD': 'bg-slate-500 text-white',
    'OFERTA': 'bg-indigo-500 text-white',
    'INSTALACION': 'bg-amber-500 text-slate-900',
    'CIE': 'bg-rose-500 text-white',
    'COMPLETADO': 'bg-emerald-500 text-white'
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Link href="/autoconsumo" className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sun className="text-amber-400" />
              Expediente Fotovoltaico: {quote.quoteNumber}
            </h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[quote.status]}`}>
              {quote.status}
            </span>
          </div>
          <p className="text-slate-400 mt-1">
            Creado el {new Date(quote.createdAt).toLocaleDateString('es-ES')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* INFO DEL CLIENTE */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <User className="text-indigo-400" size={20} /> Titular
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500">Nombre</p>
              <p className="text-slate-200 font-medium">{quote.clientName} {quote.clientLastName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Contacto</p>
              <p className="text-slate-200">{quote.clientPhone || 'Sin teléfono'}</p>
              <p className="text-slate-200">{quote.clientEmail || 'Sin email'}</p>
            </div>
            <div className="pt-4 border-t border-slate-700/50">
              <p className="text-sm text-slate-500">Dirección de Instalación</p>
              <p className="text-slate-200 flex items-center gap-1 mt-1">
                <MapPin size={16} className="text-slate-400" /> {quote.address}, {quote.city}
              </p>
            </div>
            {quote.clientId && (
              <div className="pt-4">
                <Link href={`/clientes/${quote.clientId}`} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                  Ver Ficha de Cliente 360º &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* PARÁMETROS TÉCNICOS */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="text-amber-400" size={20} /> Diseño Técnico
            </h2>
            <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">Editar</button>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500">Potencia Pico</p>
              <p className="text-2xl font-bold text-amber-400">{quote.peakPowerKwp > 0 ? `${quote.peakPowerKwp} kWp` : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Módulos</p>
              <p className="text-2xl font-bold text-slate-200">{quote.panelsCount > 0 ? quote.panelsCount : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Inversor</p>
              <p className="text-slate-200 font-medium">{quote.inverter || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Pot. Inversor</p>
              <p className="text-slate-200 font-medium">{quote.inverterPower ? `${quote.inverterPower} kW` : '-'}</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-500 mb-1">CUPS Asociado</p>
            <p className="text-slate-200 font-mono">{quote.cups || 'No introducido'}</p>
          </div>
        </div>

        {/* ECONOMÍA Y DOCUMENTACIÓN */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Euro className="text-emerald-400" size={20} /> Económico
            </h2>
            <div className="flex items-end justify-between bg-slate-900/50 p-4 rounded-xl">
              <div>
                <p className="text-sm text-slate-500">Presupuesto Total</p>
                <p className="text-3xl font-bold text-emerald-400">
                  {quote.totalBudget > 0 ? quote.totalBudget.toLocaleString('es-ES') + ' €' : '0 €'}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <FileText className="text-rose-400" size={20} /> Legalización
            </h2>
            <div className="space-y-3">
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className={quote.cieFileUrl ? 'text-emerald-400' : 'text-slate-600'} />
                  <span className={`text-sm ${quote.cieFileUrl ? 'text-white' : 'text-slate-500'}`}>CIE</span>
                </div>
                {quote.cieFileUrl ? (
                  <a href={quote.cieFileUrl} target="_blank" className="text-xs text-indigo-400 hover:text-indigo-300">Descargar</a>
                ) : (
                  <button className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded">Subir</button>
                )}
              </div>
              <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className={quote.grantFileUrl ? 'text-emerald-400' : 'text-slate-600'} />
                  <span className={`text-sm ${quote.grantFileUrl ? 'text-white' : 'text-slate-500'}`}>Subvención</span>
                </div>
                {quote.grantFileUrl ? (
                  <a href={quote.grantFileUrl} target="_blank" className="text-xs text-indigo-400 hover:text-indigo-300">Descargar</a>
                ) : (
                  <button className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded">Subir</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
