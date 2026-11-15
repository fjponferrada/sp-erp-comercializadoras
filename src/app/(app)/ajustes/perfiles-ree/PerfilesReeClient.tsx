'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, CheckCircle2, AlertCircle, Database, Calendar } from 'lucide-react';
import Papa from 'papaparse';
import { uploadReeProfilesAction } from '@/app/actions/reeProfileActions';

export default function PerfilesReeClient({ summary }: { summary: { year: number; count: number }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [targetYear, setTargetYear] = useState<string>(new Date().getFullYear().toString());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccess(null);
    }
  };

  const processUpload = async () => {
    if (!file) {
      setError('Por favor selecciona un archivo CSV primero.');
      return;
    }

    const yearNum = parseInt(targetYear, 10);
    if (isNaN(yearNum) || yearNum < 2010 || yearNum > 2100) {
      setError('Por favor introduce un año válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rawData = results.data as any[];

          if (rawData.length === 0) {
            throw new Error('El archivo CSV está vacío.');
          }

          const profilesToUpload = rawData.map((row, i) => {
            const y = parseInt(row.year || row.año || row.anio, 10);
            const m = parseInt(row.month || row.mes, 10);
            const d = parseInt(row.day || row.dia, 10);
            const h = parseInt(row.hour || row.hora, 10);

            const p20 = parseFloat(String(row.p20td || row.P20TD || row.PERFIL_A || row.A || '0').replace(',', '.'));
            const p30 = parseFloat(String(row.p30td || row.P30TD || row.PERFIL_B || row.B || '0').replace(',', '.'));
            const p30ve = parseFloat(String(row.p30tdve || row.P30TDVE || row.PERFIL_C || row.C || '0').replace(',', '.'));
            const pSol = parseFloat(String(row.pSolar || row.PSOLAR || row.psolar || '0').replace(',', '.'));

            if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(h)) {
              throw new Error(`Error en la línea ${i + 2}: Formato de fecha/hora inválido.`);
            }

            return {
              year: y,
              month: m,
              day: d,
              hour: h,
              p20td: p20,
              p30td: p30,
              p30tdve: isNaN(p30ve) ? null : p30ve,
              pSolar: isNaN(pSol) ? 0 : pSol,
            };
          });

          const mismatch = profilesToUpload.find((p) => p.year !== yearNum);
          if (mismatch) {
            throw new Error(`El archivo contiene datos del año ${mismatch.year}, pero has seleccionado importar el año ${yearNum}.`);
          }

          if (profilesToUpload.length < 8760) {
            console.warn(`El archivo contiene ${profilesToUpload.length} registros, se esperaban 8760 o 8784.`);
          }

          const response = await uploadReeProfilesAction(yearNum, profilesToUpload);

          if (response.success) {
            setSuccess(`Se han importado ${response.count} perfiles horarios correctamente para el año ${yearNum}.`);
            setFile(null);
            router.refresh();
          } else {
            setError(response.error || 'Error desconocido al subir.');
          }
        } catch (err: any) {
          setError(err.message || 'Error al procesar el archivo CSV.');
        } finally {
          setLoading(false);
        }
      },
      error: (err) => {
        setError(`Error al parsear CSV: ${err.message}`);
        setLoading(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 card p-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-[var(--lime)]" />
            Importar Perfiles Iniciales (CSV)
          </h2>

          <div className="text-sm text-slate-400 space-y-3 mb-6">
            <p>
              Sube un archivo CSV con los coeficientes de perfilado horario publicados por Red Eléctrica de España. Estos
              perfiles se utilizan para <strong className="text-slate-200">simular facturas</strong> en el cotizador y para{' '}
              <strong className="text-slate-200">repartir el volumen</strong> cuando la curva de carga real (CCH) no está
              disponible.
            </p>
            <div>
              <p className="mb-1.5">El archivo debe contener las siguientes cabeceras:</p>
              <code className="inline-block bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-[var(--lime)] font-mono">
                year, month, day, hour, p20td, p30td, p30tdve, pSolar
              </code>
            </div>
            <p className="text-xs text-slate-500 italic">
              * Nota: Al importar, se reemplazarán los perfiles existentes para el año seleccionado.
            </p>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="form-label">Año de los Perfiles</label>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <label className="form-label">Archivo CSV</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-700 border-dashed rounded-xl hover:border-[var(--lime)]/60 bg-slate-900/40 transition-colors">
                <div className="space-y-1.5 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-500" />
                  <div className="flex items-center justify-center text-sm text-slate-400">
                    <label className="relative cursor-pointer rounded-md font-semibold text-[var(--lime)] hover:underline">
                      <span>Seleccionar archivo CSV</span>
                      <input type="file" accept=".csv" onChange={handleFileChange} className="sr-only" />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">CSV hasta 10 MB (8.760 u 8.784 horas)</p>
                </div>
              </div>
            </div>

            {file && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
                <span className="font-medium truncate mr-4">{file.name}</span>
                <span className="text-emerald-400 text-xs whitespace-nowrap">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            <button
              onClick={processUpload}
              disabled={!file || loading}
              className="w-full bg-[var(--lime)] hover:opacity-90 text-black font-semibold py-2.5 px-4 rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/20 border-t-black"></div>
                  Procesando...
                </>
              ) : (
                'Importar Perfiles'
              )}
            </button>
          </div>
        </div>

        <div className="card p-6 h-fit">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-[var(--lime)]" />
            Estado en Base de Datos
          </h2>

          <div className="space-y-3">
            {summary.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No hay perfiles horarios almacenados.</p>
            ) : (
              summary.map((s) => (
                <div
                  key={s.year}
                  className="flex items-center justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800"
                >
                  <div className="flex items-center gap-2 text-slate-200 font-semibold">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    Año {s.year}
                  </div>
                  <div className="text-sm text-slate-400 font-mono">
                    <span className={s.count >= 8760 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {s.count.toLocaleString('es-ES')}
                    </span>{' '}
                    / 8.760 h
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
