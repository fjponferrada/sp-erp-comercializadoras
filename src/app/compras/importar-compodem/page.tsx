"use client";

import { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

export default function ImportarCompodemPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip']
    },
    maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/compodem/import', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: data.message, details: data });
        setFile(null); // Clear file after success
      } else {
        setResult({ success: false, message: data.error || 'Error al procesar el archivo' });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Importar COMPODEM</h1>
          <p className="text-muted-foreground mt-2">
            Sube un archivo ZIP (incluso si contiene otros ZIPs anidados) con los ficheros de liquidación de REE (C1, C2, C3, C4, C5). El sistema aplicará la lógica avanzada de perfilado para calcular Restricciones y Operación del Sistema.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Carga de archivo maestro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <UploadCloud className="h-8 w-8 text-primary" />
                </div>
                {isDragActive ? (
                  <p className="text-lg font-medium">Suelta el ZIP aquí...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-1">Arrastra tu archivo .zip aquí</p>
                    <p className="text-sm text-muted-foreground">o haz clic para seleccionar desde tu equipo</p>
                  </div>
                )}
              </div>
            </div>

            {file && (
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileType className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <Button 
                  onClick={handleUpload} 
                  disabled={loading}
                  className="min-w-[140px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Iniciar Importación'
                  )}
                </Button>
              </div>
            )}

            {result && (
              <div className={`p-4 rounded-lg border flex gap-3 ${
                result.success ? 'bg-green-50/50 border-green-200 text-green-900' : 'bg-red-50/50 border-red-200 text-red-900'
              }`}>
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? '¡Importación completada!' : 'Error de importación'}
                  </h3>
                  <p className="text-sm mt-1">{result.message}</p>
                  
                  {result.success && result.details && (
                    <ul className="mt-2 text-sm space-y-1 list-disc list-inside opacity-90">
                      <li>Ficheros CSV procesados: {result.details.filesProcessed}</li>
                      <li>Días (filas) insertados/actualizados: {result.details.rowsInserted}</li>
                    </ul>
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
