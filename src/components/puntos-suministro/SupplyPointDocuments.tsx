'use client';

import { useState } from 'react';
import { UploadCloud, FileText, Trash2, Loader2, FileCheck } from 'lucide-react';
import { addDocumentAction, deleteDocumentAction } from '@/app/actions/documentActions';
import toast from 'react-hot-toast';

export default function SupplyPointDocuments({
  supplyPointId,
  documents = [],
  onUpdate
}: {
  supplyPointId: string;
  documents?: any[];
  onUpdate: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const loadingToast = toast.loading('Subiendo documento...');

    try {
      // 1. Upload to R2 via API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'cnmc'); // Carpeta CNMC

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error subiendo el archivo');
      }

      // La API nos devuelve la URL. Extraemos la ruta final.
      const urlStr = data.url as string;
      const parsedUrl = new URL(urlStr);
      // Extraemos solo el path, ej: cnmc/123123_cie.pdf
      const r2Path = parsedUrl.pathname.replace(/^\/+/, '');

      // 2. Register Document in DB
      const result = await addDocumentAction({
        name: file.name,
        type: file.type || 'application/pdf',
        url: r2Path, // Guardamos la ruta del R2, no la pblica completa
        sizeBytes: file.size,
        supplyPointId,
      });

      if (result.success) {
        toast.success('Documento subido correctamente', { id: loadingToast });
        onUpdate();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al procesar el documento', { id: loadingToast });
    } finally {
      setIsUploading(false);
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Seguro que deseas eliminar este documento? Esta accin no borra el archivo de Cloudflare, solo el registro.')) return;
    
    setDeletingId(id);
    const loadingToast = toast.loading('Eliminando...');
    try {
      const result = await deleteDocumentAction(id);
      if (result.success) {
        toast.success('Documento eliminado', { id: loadingToast });
        onUpdate();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm mt-8">
      <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <FileText size={18} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Documentacin Tcnica</h2>
            <p className="text-xs text-white/50">CIE, Permisos de obra, Licencias...</p>
          </div>
        </div>
        
        <div>
          <label className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-medium transition-colors cursor-pointer">
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            <span>Subir Documento</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.jpg,.jpeg,.png" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
        </div>
      </div>

      <div className="p-0 md:p-6">
        {documents.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            <FileCheck size={32} className="mx-auto mb-3 opacity-20" />
            <p>No hay documentos asociados a este CUPS.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/40 border-b border-white/5 hidden md:table-row">
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Documento</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Ruta / Enlace CNMC</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider">Fecha</th>
                  <th className="p-4 text-xs font-semibold text-white/40 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 block md:table-row-group">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors group block md:table-row p-4 md:p-0">
                    <td className="p-0 md:p-4 block md:table-cell mb-2 md:mb-0">
                      <div className="flex items-center gap-3">
                        <FileText size={20} className="text-white/40" />
                        <div>
                          <p className="text-sm font-medium text-white">{doc.name}</p>
                          <p className="text-xs text-white/40">{formatSize(doc.sizeBytes)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-0 md:p-4 block md:table-cell mb-2 md:mb-0">
                      <div className="bg-black/40 px-2 py-1.5 rounded-lg border border-white/10 flex items-center justify-between">
                        <code className="text-xs text-lime-400 font-mono break-all line-clamp-1">
                          {`https://erp.aed-energia.com/api/cnmc/document?file=${doc.url}&user=AED-CNMC&password=AED%232024Doc`}
                        </code>
                        <button
                          onClick={() => {
                            const fullUrl = `https://erp.aed-energia.com/api/cnmc/document?file=${doc.url}&user=AED-CNMC&password=AED%232024Doc`;
                            navigator.clipboard.writeText(fullUrl);
                            toast.success('Ruta CNMC copiada');
                          }}
                          className="ml-2 text-[10px] bg-white/10 px-2 py-1 rounded text-white hover:bg-white/20 shrink-0"
                        >
                          Copiar Enlace
                        </button>
                      </div>
                    </td>
                    <td className="p-0 md:p-4 block md:table-cell text-sm text-white/50 mb-4 md:mb-0">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="p-0 md:p-4 block md:table-cell text-right">
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="p-2 text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-colors inline-flex"
                        title="Eliminar registro"
                      >
                        {deletingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
