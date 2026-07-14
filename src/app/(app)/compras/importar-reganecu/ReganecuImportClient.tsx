'use client';

import { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Loader2 } from 'lucide-react';

export default function ReganecuImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.zip')) {
        setFile(droppedFile);
        setUploadResult(null);
      } else {
        alert('Por favor, suba un archivo .zip');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile);
        setUploadResult(null);
      } else {
        alert('Por favor, suba un archivo .zip');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/reganecu/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el archivo');
      }

      setUploadResult({ type: 'success', message: data.message });
      setFile(null);
    } catch (err: any) {
      console.error(err);
      setUploadResult({ type: 'error', message: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'rgba(0,0,0,0.2)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}
        onClick={() => document.getElementById('reganecu-file-upload')?.click()}
      >
        <div style={{ background: 'var(--bg-elevated)', borderRadius: '50%', display: 'inline-flex', padding: '16px' }}>
          <UploadCloud size={32} color="var(--text-secondary)" />
        </div>
        <div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '1.1rem', marginBottom: '8px' }}>
            Arrastra y suelta aquí tu ZIP
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            o haz clic para explorar en tus archivos
          </p>
        </div>
        
        <input 
          id="reganecu-file-upload" 
          type="file" 
          accept=".zip" 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={24} color="var(--lime)" />
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem' }}>{file.name}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            style={{
              padding: '8px 24px',
              backgroundColor: 'var(--lime)',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              opacity: isUploading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Procesando...
              </>
            ) : (
              'Comenzar Importación'
            )}
          </button>
        </div>
      )}

      {uploadResult && (
        <div style={{ 
          marginTop: '24px', 
          padding: '16px', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: '12px',
          backgroundColor: uploadResult.type === 'success' ? 'rgba(163, 230, 53, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${uploadResult.type === 'success' ? 'var(--lime)' : 'var(--red)'}`
        }}>
          {uploadResult.type === 'success' ? (
            <CheckCircle2 size={24} color="var(--lime)" style={{ flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={24} color="var(--red)" style={{ flexShrink: 0 }} />
          )}
          <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5, marginTop: '2px' }}>
            {uploadResult.message}
          </p>
        </div>
      )}
    </div>
  );
}
