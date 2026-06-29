"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, CheckCircle, XCircle } from 'lucide-react';

export default function ImportarClient() {
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
        onMouseOver={(e) => {
          if (!isDragActive) e.currentTarget.style.borderColor = 'var(--text-secondary)';
        }}
        onMouseOut={(e) => {
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
            {loading ? 'Procesando...' : 'Iniciar Importación'}
          </button>
        </div>
      )}

      {result && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          borderRadius: '8px',
          display: 'flex',
          gap: '12px',
          background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${result.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
        }}>
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
                <li>Días (filas) insertados/actualizados: <strong style={{ color: 'var(--text-primary)' }}>{result.details.rowsInserted}</strong></li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
