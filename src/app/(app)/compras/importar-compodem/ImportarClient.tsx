"use client";

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, CheckCircle, XCircle } from 'lucide-react';
import { parseJsonResponseSafe, prepareFilteredZipBatches } from '@/lib/zipClientFilter';

function isCompodemRelevantFile(lowerBaseName: string): boolean {
  return (
    lowerBaseName.includes('_compodem_') ||
    lowerBaseName.includes('kestimado') ||
    lowerBaseName.includes('kreal') ||
    lowerBaseName.includes('kestmedio') ||
    lowerBaseName.includes('kestimqh') ||
    lowerBaseName.includes('krealqh')
  );
}

export default function ImportarClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('Procesando...');
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
      'application/zip': ['.zip', '.ZIP'],
      'application/x-zip-compressed': ['.zip', '.ZIP'],
      'application/octet-stream': ['.zip', '.ZIP'],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setStatusLabel('Filtrando ficheros del ZIP...');
    setResult(null);

    try {
      const { matchedCount, batches } = await prepareFilteredZipBatches(file, isCompodemRelevantFile);

      if (matchedCount === 0 || batches.length === 0) {
        setResult({
          success: false,
          message: 'No se encontraron ficheros válidos de COMPODEM ni Factor K dentro del ZIP.',
        });
        return;
      }

      let totalFilesProcessed = 0;
      let totalRowsInserted = 0;
      const accumulatedMonths = new Set<string>();

      for (let i = 0; i < batches.length; i++) {
        const isLastBatch = i === batches.length - 1;
        setStatusLabel(
          batches.length > 1
            ? `Importando lote ${i + 1} de ${batches.length}...`
            : 'Importando en base de datos...'
        );

        const formData = new FormData();
        formData.append('file', batches[i], `compodem_batch_${i + 1}.zip`);
        if (!isLastBatch) {
          formData.append('skipRecalc', 'true');
        } else if (accumulatedMonths.size > 0) {
          formData.append('extraMonths', JSON.stringify(Array.from(accumulatedMonths)));
        }

        const res = await fetch('/api/compodem/import', {
          method: 'POST',
          body: formData,
        });

        const data = await parseJsonResponseSafe(res);

        if (!res.ok) {
          setResult({
            success: false,
            message: data.error || `Error al procesar el lote ${i + 1} de ${batches.length}`,
          });
          return;
        }

        totalFilesProcessed += data.filesProcessed || 0;
        totalRowsInserted += data.rowsInserted || 0;
        if (Array.isArray(data.affectedMonths)) {
          data.affectedMonths.forEach((m: string) => accumulatedMonths.add(m));
        }
      }

      setResult({
        success: true,
        message: `Se procesaron ${totalFilesProcessed} ficheros válidos y se actualizaron/insertaron ${totalRowsInserted} registros en la base de datos.`,
        details: {
          filesProcessed: totalFilesProcessed,
          rowsInserted: totalRowsInserted,
        },
      });
      setFile(null);
      router.refresh();
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Error al procesar el archivo ZIP' });
    } finally {
      setLoading(false);
      setStatusLabel('Procesando...');
    }
  };

  return (
    <div className="card">
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? 'var(--lime)' : 'var(--border-strong)'}`,
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? 'var(--lime-glow)' : 'var(--bg-elevated)',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={e => {
          if (!isDragActive) e.currentTarget.style.borderColor = 'var(--text-secondary)';
        }}
        onMouseOut={e => {
          if (!isDragActive) e.currentTarget.style.borderColor = 'var(--border-strong)';
        }}
      >
        <input {...getInputProps()} />
        <UploadCloud style={{ margin: '0 auto', height: '48px', width: '48px', marginBottom: '16px', color: isDragActive ? 'var(--lime)' : 'var(--text-secondary)' }} />
        {isDragActive ? (
          <p style={{ fontWeight: 600, color: 'var(--lime)', margin: 0 }}>Suelta el ZIP aquí...</p>
        ) : (
          <div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Arrastra tu archivo .zip aquí</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>o haz clic para seleccionar desde tu equipo</p>
          </div>
        )}
      </div>

      {file && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileIcon style={{ height: '32px', width: '32px', color: 'var(--text-secondary)' }} />
            <div>
              <p style={{ margin: 0, fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{file.name}</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            onClick={handleUpload}
            disabled={loading}
            className="btn-primary"
            style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? statusLabel : 'Iniciar Importación'}
          </button>
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            borderRadius: '8px',
            display: 'flex',
            gap: '12px',
            background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${result.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          }}
        >
          {result.success ? (
            <CheckCircle style={{ height: '24px', width: '24px', color: 'var(--success)', flexShrink: 0 }} />
          ) : (
            <XCircle style={{ height: '24px', width: '24px', color: 'var(--danger)', flexShrink: 0 }} />
          )}
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '0.875rem', fontWeight: 600, color: result.success ? 'var(--success)' : 'var(--danger)' }}>
              {result.success ? '¡Importación completada!' : 'Error de importación'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {result.message}
            </p>

            {result.success && result.details && (
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <li>Ficheros CSV procesados: <strong style={{ color: 'var(--text-primary)' }}>{result.details.filesProcessed}</strong></li>
                <li>Registros insertados/actualizados: <strong style={{ color: 'var(--text-primary)' }}>{result.details.rowsInserted}</strong></li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
