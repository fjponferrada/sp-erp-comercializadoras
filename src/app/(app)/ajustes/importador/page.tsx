'use client';

import { useState } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function ImportadorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/etl/cch', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el archivo');
      }

      setResult(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Importador de Curvas de Carga (ETL)</h1>
        <p className="text-gray-400 mt-2">
          Sube los ficheros de las distribuidoras en formato ZIP o CSV. El motor procesará las lecturas y las inyectará en la base de datos automáticamente.
        </p>
      </div>

      <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl p-8 shadow-sm">
        <div className="border-2 border-dashed border-[#1E2A3A] rounded-lg p-10 flex flex-col items-center justify-center bg-[#0B0F19] transition-colors hover:bg-[#1E2A3A]/30 relative">
          <input 
            type="file" 
            accept=".zip,.csv,.txt" 
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-1">Haz clic o arrastra un fichero</h3>
          <p className="text-sm text-gray-500">Soporta .ZIP, .CSV y .TXT</p>
        </div>

        {file && (
          <div className="mt-6 flex items-center justify-between bg-[#1E2A3A]/50 p-4 rounded-lg border border-[#1E2A3A]">
            <div className="flex items-center space-x-3">
              <File className="h-6 w-6 text-brand-primary" />
              <div>
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={handleUpload}
              disabled={loading}
              className="bg-brand-primary text-black px-6 py-2 rounded-lg font-medium hover:bg-[#cbf478] transition-colors flex items-center disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2" />
                  Procesando...
                </>
              ) : (
                'Procesar Fichero'
              )}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-900/50 rounded-lg p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-green-900/20 border border-green-900/50 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-400 mr-2" />
              <h3 className="text-lg font-medium text-green-400">Procesamiento Completado</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#0B0F19] p-4 rounded-lg border border-[#1E2A3A]">
                <p className="text-sm text-gray-400">Curvas Procesadas</p>
                <p className="text-2xl font-bold text-white mt-1">{result.success}</p>
              </div>
              <div className="bg-[#0B0F19] p-4 rounded-lg border border-[#1E2A3A]">
                <p className="text-sm text-gray-400">Ignoradas (Picos/Vacíos)</p>
                <p className="text-2xl font-bold text-yellow-400 mt-1">{result.skipped}</p>
              </div>
              <div className="bg-[#0B0F19] p-4 rounded-lg border border-[#1E2A3A]">
                <p className="text-sm text-gray-400">Errores de Formato</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{result.errors}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
