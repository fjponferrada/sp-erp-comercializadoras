'use client';

import { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as xlsx from 'xlsx';

export default function PpaForm({ 
  onClose, 
  onSuccess,
  initialData = null
}: { 
  onClose: () => void, 
  onSuccess: () => void,
  initialData?: any 
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    type: initialData?.type || 'FISICO',
    subtype: initialData?.subtype || 'CARGA_BASE',
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
    endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().split('T')[0] : '',
    priceType: initialData?.priceType || 'FIJO',
    priceValue: initialData?.priceValue !== null && initialData?.priceValue !== undefined ? initialData.priceValue.toString() : '',
    basePowerMw: initialData?.basePowerMw !== null && initialData?.basePowerMw !== undefined ? initialData.basePowerMw.toString() : '',
  });

  const [profileData, setProfileData] = useState<any>(initialData?.profileData || null);
  const [profilePreview, setProfilePreview] = useState<any>(initialData?.profileData ? {
    eneH0: initialData.profileData[0][0],
    eneH12: initialData.profileData[0][12],
    agoH12: initialData.profileData[7][12],
    totalRows: 24
  } : null);

  const handleFileUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = xlsx.utils.sheet_to_json(ws);

        // Validar que hay al menos 24 horas y los meses
        if (data.length < 24) {
          alert('El archivo no parece tener las 24 filas de horas necesarias.');
          return;
        }

        // Parseamos Enero a Diciembre para las primeras 24 filas
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const matrix: number[][] = []; // 12 meses x 24 horas

        for (let m = 0; m < 12; m++) {
          const monthKey = months[m];
          const hourlyProfile = [];
          for (let h = 0; h < 24; h++) {
            const val = data[h][monthKey];
            hourlyProfile.push(parseFloat(val || 0));
          }
          matrix.push(hourlyProfile);
        }

        setProfileData(matrix);
        // Generar un pequeño preview
        setProfilePreview({
          eneH0: matrix[0][0],
          eneH12: matrix[0][12],
          agoH12: matrix[7][12],
          totalRows: 24
        });

      } catch (err) {
        console.error(err);
        alert('Error al leer el Excel. Asegúrate de que tiene el formato correcto.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        profileData: formData.subtype === 'PERFIL_FIJO' ? profileData : null
      };

      const isEditing = !!initialData;
      const url = isEditing ? `/api/ppas/${initialData.id}` : '/api/ppas';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end'
    }}>
      <div style={{
        width: '500px', background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', height: '100%',
        animation: 'slide-in-right 0.3s ease-out'
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>{initialData ? 'Editar PPA' : 'Nuevo PPA'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <form id="ppa-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Nombre del Acuerdo</label>
              <input
                required
                type="text"
                placeholder="Ej. PPA Solar Aljaval"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '8px',
                  background: 'var(--bg-base)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tipo de PPA</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="FISICO">Físico</option>
                  <option value="FINANCIERO">Financiero</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Subtipo</label>
                <select
                  value={formData.subtype}
                  onChange={e => { setFormData({ ...formData, subtype: e.target.value }); setProfileData(null); }}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="CARGA_BASE">Carga Base</option>
                  <option value="PERFIL_FIJO">Perfil Fijo</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fecha Inicio</label>
                <input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Fecha Fin (Opcional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tipo de Precio</label>
                <select
                  value={formData.priceType}
                  onChange={e => setFormData({ ...formData, priceType: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                >
                  <option value="FIJO">Fijo (€/MWh)</option>
                  <option value="INDEXADO">Indexado (Fee OMIE)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {formData.priceType === 'INDEXADO' ? 'Fee Comercial (€/MWh)' : 'Valor (€/MWh)'}
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder={formData.priceType === 'INDEXADO' ? 'Ej. 1.50' : 'Ej. 40.50'}
                  value={formData.priceValue}
                  onChange={e => setFormData({ ...formData, priceValue: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>

            {formData.subtype === 'CARGA_BASE' && (
              <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Potencia de Carga Base (MW)
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  placeholder="Ej. 1.2"
                  value={formData.basePowerMw}
                  onChange={e => setFormData({ ...formData, basePowerMw: e.target.value })}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-base)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)'
                  }}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  El PPA obligará a comprar esta cantidad exacta de MWh cada hora.
                </p>
              </div>
            )}

            {formData.subtype === 'PERFIL_FIJO' && (
              <div style={{ background: 'rgba(168, 85, 247, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Subir Excel de Perfil Fijo
                </label>
                
                {!profileData ? (
                  <div style={{
                    border: '2px dashed var(--border)', borderRadius: '8px', padding: '30px 20px',
                    textAlign: 'center', background: 'var(--bg-base)', cursor: 'pointer',
                    position: 'relative'
                  }}>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={handleFileUpload}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }}
                    />
                    <UploadCloud size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      Arrastra o haz click para subir el .xlsx
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Debe contener 24 filas (horas) y 12 columnas (Enero-Diciembre)
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', background: 'var(--bg-base)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px' }}>
                      <CheckCircle2 size={24} color="#22c55e" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                        Matriz procesada con éxito
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Se han extraído 12 meses y 24 horas.<br/>
                        Muestra: Ene H0: {profilePreview.eneH0} MW | Ene H12: {profilePreview.eneH12} MW | Ago H12: {profilePreview.agoH12} MW
                      </div>
                      <button 
                        type="button"
                        onClick={() => { setProfileData(null); setProfilePreview(null); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', padding: 0, marginTop: '8px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Subir otro archivo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </form>
        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px', borderRadius: '8px', background: 'transparent',
              border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            form="ppa-form"
            type="submit"
            disabled={loading || (formData.subtype === 'PERFIL_FIJO' && !profileData)}
            style={{
              padding: '10px 16px', borderRadius: '8px', background: 'var(--lime)',
              border: 'none', color: 'var(--bg-base)',
              fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Guardando...' : 'Guardar PPA'}
          </button>
        </div>
      </div>
    </div>
  );
}
