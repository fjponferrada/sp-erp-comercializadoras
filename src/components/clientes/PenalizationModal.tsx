'use client';

import React, { useState, useRef } from 'react';
import { createPenalizationInvoiceAction } from '@/app/actions/invoiceActions';
import { X, UploadCloud, AlertTriangle, Send } from 'lucide-react';
// import { uploadFile } from '@/lib/blobUpload';

export default function PenalizationModal({ contract, onClose }: { contract: any, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    invoiceNumber: `PEN-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
    amount: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Debes adjuntar el PDF de la factura de penalización");
      return;
    }
    
    setLoading(true);
    
    try {
      // 1. Subir PDF a Vercel Blob
      // const url = await uploadFile(file);
      const url = "mock_url";

      // 2. Crear Factura en DB y Enviar Email
      const res = await createPenalizationInvoiceAction({
        contractId: contract.id,
        invoiceNumber: formData.invoiceNumber,
        amount: parseFloat(formData.amount),
        pdfUrl: url
      });

      if (res.success) {
        onClose();
      } else {
        alert("Error: " + res.error);
      }
    } catch (err: any) {
      alert("Error subiendo el archivo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-rose-500/10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="text-rose-500" /> Emitir Penalización
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-900/50 p-4 rounded-xl text-sm text-slate-300 border border-slate-700 mb-6">
            Al confirmar, se creará la factura en el sistema y se enviará automáticamente un email al cliente (<b>{contract.client.contactEmail || 'Sin email'}</b>) notificando el incumplimiento de permanencia.
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Nº Factura de Penalización</label>
            <input 
              required 
              type="text" 
              value={formData.invoiceNumber}
              onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-rose-500 font-mono" 
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Importe Penalización (€)</label>
            <input 
              required 
              type="number" 
              step="0.01"
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-rose-500 font-mono" 
              placeholder="ej. 150.00"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Documento PDF</label>
            <input 
              type="file" 
              accept=".pdf"
              ref={fileInputRef}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden" 
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-colors ${file ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 hover:border-slate-500 text-slate-400'}`}
            >
              <UploadCloud size={24} />
              <span className="text-sm font-medium">
                {file ? file.name : 'Seleccionar PDF de la Factura'}
              </span>
            </button>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-300 hover:text-white">Cancelar</button>
            <button type="submit" disabled={loading} className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2">
              {loading ? 'Procesando...' : <><Send size={18} /> Emitir y Notificar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
