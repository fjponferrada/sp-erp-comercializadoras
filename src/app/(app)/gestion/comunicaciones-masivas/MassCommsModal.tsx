'use client';

import React, { useState, useRef } from 'react';
import { X, Send, AlertTriangle, Bold } from 'lucide-react';
import { sendMassCommunication } from '@/app/actions/commsActions';
import toast from 'react-hot-toast';

const defaultBody = `
<div>Escribe aquí el cuerpo principal de tu comunicado. Ej: le contactamos en referencia a sus puntos de suministro: {{cups}}...</div>
<br/>
<div style="color: #6b7280; font-size: 13px; line-height: 1.5;">
  <p style="margin: 0 0 8px 0;">Para cualquier duda que tengas, puedes ponerte en contacto con nosotros respondiendo a este email, o en el 900525826 o por Whatsapp <a href="https://wa.me/34900525826" style="color: #0056b3; text-decoration: underline;">haciendo clic aquí</a>.</p>
  <p style="margin: 0;">Gracias por confiar en nosotros,</p>
  <p style="margin: 4px 0 0 0; font-weight: 600;">El Equipo AED Energía</p>
</div>
`;

export default function MassCommsModal({ 
  onClose, 
  selectedIds, 
  onSuccess 
}: { 
  onClose: () => void; 
  selectedIds: string[];
  onSuccess: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(defaultBody);
  const [isSending, setIsSending] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleBold = (e: React.MouseEvent) => {
    e.preventDefault(); // Evita perder el foco del texto seleccionado
    document.execCommand('bold', false, undefined);
  };

  const handleSend = async () => {
    const finalBody = editorRef.current?.innerHTML || '';
    if (!subject.trim() || !finalBody.trim()) {
      toast.error('El asunto y el mensaje son obligatorios.');
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres enviar este correo a ${selectedIds.length} puntos de suministro?`)) {
      return;
    }

    setIsSending(true);
    const result = await sendMassCommunication(subject, finalBody, selectedIds);
    setIsSending(false);

    if (result.success) {
      toast.success(`Comunicación masiva enviada correctamente (Procesados ${result.sentCount} emails)`);
      onSuccess();
    } else {
      toast.error(result.error || 'Error enviando comunicación masiva.');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        background: 'var(--bg-base)', borderRadius: '12px', width: '100%', maxWidth: '650px', border: '1px solid var(--border-strong)',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Redactar Comunicación Masiva</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ padding: '12px 16px', background: 'rgba(255, 171, 0, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 171, 0, 0.2)', display: 'flex', gap: '12px' }}>
            <AlertTriangle size={20} color="#FFAB00" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              <strong>Vas a enviar un correo masivo a los clientes de {selectedIds.length} Puntos de Suministro.</strong><br/>
              Si un mismo cliente tiene varios CUPS en la selección, el sistema agrupará los envíos para mandarle un único correo.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Asunto del Correo
            </label>
            <input 
              type="text" 
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej: Aviso importante sobre su suministro eléctrico"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Mensaje (Previsualización)
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Variables: <code style={{ background: 'var(--bg-base)', padding: '2px 4px', borderRadius: '4px' }}>{`{{cups}}`}</code>
              </span>
            </div>
            
            <div style={{ 
              padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', 
              border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' 
            }}>
              
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '4px' }}>
                <button
                  type="button"
                  onMouseDown={handleBold}
                  title="Negrita"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '6px', background: 'var(--bg-base)', border: '1px solid var(--border)', 
                    borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)'
                  }}
                >
                  <Bold size={16} strokeWidth={3} />
                </button>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', alignSelf: 'center', marginLeft: 'auto' }}>
                  Selecciona el texto y pulsa el botón para ponerlo en negrita.
                </span>
              </div>

              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Hola {'{{nombre_cliente}}'},
              </div>
              
              <div 
                ref={editorRef}
                contentEditable
                onInput={e => setBody(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: defaultBody }}
                style={{ 
                  width: '100%', minHeight: '180px', flex: 1, padding: '12px', borderRadius: '6px', 
                  border: '1px dashed var(--border-strong)', background: 'var(--bg-base)', color: 'var(--text-primary)', 
                  fontSize: '14px', fontFamily: 'Arial, sans-serif', overflowY: 'auto', outline: 'none'
                }}
              />
              
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-base)', borderRadius: '0 0 12px 12px' }}>
          <button 
            onClick={onClose}
            disabled={isSending}
            style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim()}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '6px', border: 'none', 
              background: 'var(--lime)', color: 'var(--bg-base)', fontWeight: 600, 
              cursor: (isSending || !subject.trim() || !body.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isSending || !subject.trim() || !body.trim()) ? 0.7 : 1
            }}
          >
            {isSending ? (
              <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
            ) : (
              <Send size={18} />
            )}
            {isSending ? 'Enviando...' : 'Enviar Masivo'}
          </button>
        </div>

      </div>
    </div>
  );
}
