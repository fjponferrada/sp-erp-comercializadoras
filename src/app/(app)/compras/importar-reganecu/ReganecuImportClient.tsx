'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { parseJsonResponseSafe, prepareFilteredZipBatches } from '@/lib/zipClientFilter';

function isReganecuRelevantFile(lowerBaseName: string): boolean {
  return lowerBaseName.includes('_reganecu_') || lowerBaseName.includes('_reganecuqh_');
}

export default function ReganecuImportClient() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('Procesando...');
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.zip')) {
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
      if (selectedFile.name.toLowerCase().endsWith('.zip')) {
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
    setStatusLabel('Filtrando ficheros del ZIP...');
    setUploadResult(null);

    try {
      const { matchedCount, batches } = await prepareFilteredZipBatches(file, isReganecuRelevantFile);

      if (matchedCount === 0 || batches.length === 0) {
        throw new Error('No se encontraron ficheros válidos de REGANECU dentro del ZIP.');
      }

      let totalProcessedCount = 0;
      const accumulatedMonths = new Set<string>();

      for (let i = 0; i < batches.length; i++) {
        const isLastBatch = i === batches.length - 1;
        setStatusLabel(
          batches.length > 1
            ? `Importando lote ${i + 1} de ${batches.length}...`
            : 'Importando en base de datos...'
        );

        const formData = new FormData();
        formData.append('file', batches[i], `reganecu_batch_${i + 1}.zip`);
        if (!isLastBatch) {
          formData.append('skipRecalc', 'true');
        } else if (accumulatedMonths.size > 0) {
          formData.append('extraMonths', JSON.stringify(Array.from(accumulatedMonths)));
        }

        const res = await fetch('/api/reganecu/import', {
          method: 'POST',
          body: formData,
        });

        const data = await parseJsonResponseSafe(res);
        if (!res.ok) {
          throw new Error(data.error || `Error al procesar el lote ${i + 1} de ${batches.length}`);
        }

        totalProcessedCount += data.processedCount || 0;
        if (Array.isArray(data.affectedMonths)) {
          data.affectedMonths.forEach((m: string) => accumulatedMonths.add(m));
        }
      }

      setUploadResult({
        type: 'success',
        message: `Importación exitosa. Se procesaron ${totalProcessedCount} archivos REGANECU (Horarios/Cuartohorarios).`,
      });
      setFile(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setUploadResult({ type: 'error', message: err.message });
    } finally {
      setIsUploading(false);
      setStatusLabel('Procesando...');
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
          gap: '16px',
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
          accept=".zip,.ZIP"
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
              gap: '8px',
            }}
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {statusLabel}
              </>
            ) : (
              'Comenzar Importación'
            )}
          </button>
        </div>
      )}

      {uploadResult && (
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backgroundColor: uploadResult.type === 'success' ? 'rgba(163, 230, 53, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${uploadResult.type === 'success' ? 'var(--lime)' : 'var(--red)'}`,
          }}
        >
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
