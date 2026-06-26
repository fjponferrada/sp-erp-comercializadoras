"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

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
    <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.5rem', color: '#111827' }}>Carga de archivo maestro</h2>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '24px' }}>
        Sube un archivo ZIP (incluso si contiene otros ZIPs anidados) con los ficheros de liquidación de REE (C1, C2, C3, C4, C5). El sistema procesará todos los componentes internamente.
      </p>

      <div
        {...getRootProps()}
        style={{
          border: isDragActive ? '2px dashed #3b82f6' : '2px dashed #d1d5db',
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive ? '#eff6ff' : '#f9fafb',
          transition: 'all 0.2s ease',
          marginBottom: '24px'
        }}
      >
        <input {...getInputProps()} />
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📁</div>
        {isDragActive ? (
          <p style={{ fontWeight: 600, color: '#3b82f6', margin: 0 }}>Suelta el ZIP aquí...</p>
        ) : (
          <div>
            <p style={{ fontWeight: 600, color: '#374151', margin: '0 0 8px 0' }}>Arrastra tu archivo .zip aquí</p>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>o haz clic para seleccionar desde tu equipo</p>
          </div>
        )}
      </div>

      {file && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f3f4f6', borderRadius: '8px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>📄</span>
            <div>
              <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem', color: '#111827' }}>{file.name}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button 
            onClick={handleUpload} 
            disabled={loading}
            style={{
              padding: '8px 16px',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Procesando...' : 'Iniciar Importación'}
          </button>
        </div>
      )}

      {result && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: result.success ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${result.success ? '#a7f3d0' : '#fecaca'}`,
          display: 'flex',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.2rem' }}>{result.success ? '✅' : '❌'}</span>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: result.success ? '#065f46' : '#991b1b' }}>
              {result.success ? '¡Importación completada!' : 'Error de importación'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: result.success ? '#064e3b' : '#7f1d1d' }}>{result.message}</p>
            
            {result.success && result.details && (
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#064e3b' }}>
                <li>Ficheros CSV procesados: {result.details.filesProcessed}</li>
                <li>Días (filas) insertados/actualizados: {result.details.rowsInserted}</li>
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
