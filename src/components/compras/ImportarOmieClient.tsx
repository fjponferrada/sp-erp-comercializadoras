'use client';

import React, { useState } from 'react';
import { Upload, Loader2, FileCheck, AlertCircle } from 'lucide-react';

export default function ImportarOmieClient() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Por favor selecciona un fichero para importar.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/compras/importar-omie', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error desconocido al subir el fichero.');
      }

      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
        Importar Ficheros OMIE
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem', lineHeight: 1.5 }}>
        Sube los ficheros XLS de precios SPOT diarios de OMIE descargados desde ESIOS (REE). 
        El sistema procesará automáticamente los periodos cuartohorarios para incorporarlos a la base de datos de precios.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>
        
        {/* File Input */}
        <div style={{
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          padding: '40px 24px',
          textAlign: 'center',
          background: 'var(--bg-base)',
          position: 'relative',
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}>
          <input 
            type="file" 
            accept=".xls,.csv,.html"
            onChange={handleFileChange}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              opacity: 0,
              cursor: 'pointer',
              width: '100%'
            }}
          />
          <Upload size={32} color="var(--text-secondary)" style={{ margin: '0 auto 16px auto' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '8px' }}>
            {file ? file.name : 'Haz clic o arrastra un fichero aquí'}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Formatos soportados: XLS (HTML de ESIOS), CSV
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          style={{
            padding: '14px 24px',
            borderRadius: '8px',
            background: 'var(--text-primary)',
            color: 'var(--bg-base)',
            border: 'none',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: (!file || loading) ? 'not-allowed' : 'pointer',
            opacity: (!file || loading) ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            transition: 'background 0.2s'
          }}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Procesando fichero...
            </>
          ) : (
            <>
              <Upload size={20} />
              Importar Datos
            </>
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: '16px', 
            borderRadius: '8px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            color: 'var(--danger)'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{error}</p>
          </div>
        )}

        {/* Success Message */}
        {result && result.success && (
          <div style={{ 
            padding: '16px', 
            borderRadius: '8px', 
            background: 'rgba(34, 197, 94, 0.1)', 
            border: '1px solid rgba(34, 197, 94, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            color: '#22c55e'
          }}>
            <FileCheck size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Importación completada</strong>
              <p style={{ margin: 0 }}>{result.message}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
