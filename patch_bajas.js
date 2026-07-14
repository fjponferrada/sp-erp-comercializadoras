const fs = require('fs');

const FILE_PATH = 'src/app/(app)/bajas/BajasClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /<div style=\{\{\s*overflowX:\s*'auto'\s*\}\}>\s*<table className="data-table">/;

const replaceStr = `{/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {bajas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No se encontraron bajas con los filtros aplicados.
              </div>
            ) : (
              bajas.map((b) => (
                <div key={b.cups} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{b.cliente}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{b.telefono || '-'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-draft" style={{ fontSize: '0.72rem' }}>{b.tarifa}</span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {b.producto}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>CUPS:</strong> {b.cups}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600 }}>
                      Baja: {b.fechaBaja}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {b.telefono && (
                        <a href={\`tel:\${b.telefono}\`} className="action-icon" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: '6px', borderRadius: '6px' }} title="Llamar">
                          <Phone size={16} />
                        </a>
                      )}
                      {b.telefono && (
                        <a href={\`https://wa.me/\${b.telefono.replace(/\\s+/g, '')}\`} target="_blank" rel="noreferrer" className="action-icon" style={{ background: 'rgba(74, 222, 128, 0.1)', color: '#4ade80', padding: '6px', borderRadius: '6px' }} title="WhatsApp">
                          <MessageCircle size={16} />
                        </a>
                      )}
                      {b.email && (
                        <a href={\`mailto:\${b.email}\`} className="action-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '6px', borderRadius: '6px' }} title="Enviar Email">
                          <Mail size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="data-table">`;

if (regex.test(content)) {
    content = content.replace(regex, replaceStr);
    
    // Icon imports check
    // We used Phone, MessageCircle, Mail
    // Let's assume they are imported, if not add them
    if (!content.includes("Phone")) {
      content = content.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1, Phone} from 'lucide-react';");
    }
    if (!content.includes("MessageCircle")) {
      content = content.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1, MessageCircle} from 'lucide-react';");
    }
    if (!content.includes("Mail")) {
      content = content.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1, Mail} from 'lucide-react';");
    }

    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log('BajasClient.tsx patched successfully.');
} else {
    console.log('Could not find target string in BajasClient.tsx');
}
