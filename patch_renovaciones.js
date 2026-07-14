const fs = require('fs');

const FILE_PATH = 'src/app/(app)/renovaciones/RenovacionesClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /<div style=\{\{\s*overflowX:\s*'auto'\s*\}\}>\s*<table className="data-table">/;

const replaceStr = `{/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {displayedRenovaciones.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No hay contratos que venzan próximamente con los filtros actuales.
              </div>
            ) : (
              displayedRenovaciones.map((r) => {
                const renovado = renovados.includes(r.id);
                return (
                  <div key={r.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px', opacity: renovado ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, paddingRight: '8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{r.cliente}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{r.telefonoContacto}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {renovado ? (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>✅ Renovado</span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>Vence en {r.diasRestantes}d</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--lime)', border: '1px solid var(--border)' }}>
                        {r.tarifa}
                      </span>
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {r.canal} / {r.comercial}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <strong>CUPS:</strong> {r.cups}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Vence: {new Date(r.fechaFin).toLocaleDateString('es-ES')}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => window.location.href = \`/contratos/\${r.id}\`} className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}>
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table className="data-table">`;

if (regex.test(content)) {
    content = content.replace(regex, replaceStr);
    
    // Check missing icon import
    if (!content.includes("ExternalLink")) {
      content = content.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1, ExternalLink} from 'lucide-react';");
    }
    
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log('RenovacionesClient.tsx patched successfully.');
} else {
    console.log('Could not find target string in RenovacionesClient.tsx');
}
