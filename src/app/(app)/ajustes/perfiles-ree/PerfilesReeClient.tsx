'use client';

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Database, Calendar } from 'lucide-react';
import Papa from 'papaparse';
import { uploadReeProfilesAction } from '@/app/actions/reeProfileActions';

export default function PerfilesReeClient({ summary }: { summary: { year: number, count: number }[] }) {
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

          // Format expected: year, month, day, hour, p20td, p30td, p30tdve
          const profilesToUpload = rawData.map((row, i) => {
            // Tolerate different column names from ESÍOS or user
            const y = parseInt(row.year || row.año || row.anio, 10);
            const m = parseInt(row.month || row.mes, 10);
            const d = parseInt(row.day || row.dia, 10);
            const h = parseInt(row.hour || row.hora, 10);
            
            const p20 = parseFloat((row.p20td || row.P20TD || row.PERFIL_A || row.A || '0').replace(',', '.'));
            const p30 = parseFloat((row.p30td || row.P30TD || row.PERFIL_B || row.B || '0').replace(',', '.'));
            let p30ve = parseFloat((row.p30tdve || row.P30TDVE || row.PERFIL_C || row.C || '0').replace(',', '.'));
            let pSol = parseFloat((row.pSolar || row.PSOLAR || row.psolar || '0').replace(',', '.'));

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
              pSolar: isNaN(pSol) ? 0 : pSol
            };
          });

          // Ensure the data corresponds to the selected year
          const mismatch = profilesToUpload.find(p => p.year !== yearNum);
          if (mismatch) {
            throw new Error(`El archivo contiene datos del año ${mismatch.year}, pero has seleccionado importar el año ${yearNum}.`);
          }

          if (profilesToUpload.length < 8760) {
            console.warn(`El archivo contiene ${profilesToUpload.length} registros, se esperaban 8760 o 8784.`);
          }

          const response = await uploadReeProfilesAction(yearNum, profilesToUpload);
          
          if (response.success) {
            setSuccess(`Se han importado ${response.count} perfiles horarios correctamente para el año ${yearNum}. Recarga la página para ver el resumen actualizado.`);
            setFile(null);
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
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-emerald-600" />
            Importar Perfiles Iniciales (CSV)
          </h2>
          
          <div className="prose prose-sm max-w-none text-gray-600 mb-6">
            <p>
              Sube un archivo CSV con los coeficientes de perfilado horario publicados por Red Eléctrica de España. 
              Estos perfiles se utilizan para <strong>simular facturas</strong> en el cotizador y para <strong>repartir el volumen</strong> cuando la curva de carga real (CCH) no está disponible.
            </p>
            <p>El archivo debe contener las siguientes cabeceras:</p>
            <code className="bg-gray-100 px-2 py-1 rounded text-xs text-blue-800 font-mono">
              year, month, day, hour, p20td, p30td, p30tdve, pSolar
            </code>
            <p className="mt-2 text-xs italic">
              * Nota: Al importar, se eliminarán los perfiles existentes para el año seleccionado.
            </p>
          </div>

          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año de los Perfiles</label>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo CSV</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:bg-gray-50 transition-colors">
                <div className="space-y-1 text-center">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500">
                      <span>Subir archivo</span>
                      <input type="file" accept=".csv" onChange={handleFileChange} className="sr-only" />
                    </label>
                    <p className="pl-1">o arrastrar y soltar</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    CSV hasta 10MB
                  </p>
                </div>
              </div>
            </div>
            
            {file && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
                <span className="font-medium truncate mr-4">{file.name}</span>
                <span className="text-emerald-600 text-xs">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{success}</span>
              </div>
            )}

            <button
              onClick={processUpload}
              disabled={!file || loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                  Procesando...
                </>
              ) : (
                'Importar Perfiles'
              )}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-gray-500" />
            Estado de Base de Datos
          </h2>
          
          <div className="space-y-3">
            {summary.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No hay perfiles almacenados.</p>
            ) : (
              summary.map(s => (
                <div key={s.year} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-2 text-gray-700 font-medium">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Año {s.year}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className={s.count >= 8760 ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
                      {s.count.toLocaleString()}
                    </span> / 8760 h
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
