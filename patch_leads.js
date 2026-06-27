const fs = require('fs');

const FILE_PATH = 'src/app/(app)/leads/LeadsClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const regex = /<div style=\{\{\s*overflowX:\s*'auto'\s*\}\}>\s*<table className="data-table">/;

const replaceStr = `{/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {leads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                {isLoading ? "Cargando leads..." : "No se encontraron leads."}
              </div>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: '8px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{lead.titular}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{lead.address || 'Pendiente'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-lime" style={{ fontSize: '0.72rem' }}>{lead.tarifa}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {lead.canal}
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {lead.comercial || '-'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>CUPS:</strong> {lead.cups || '-'}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(lead.fechaRegistro).toLocaleDateString('es-ES')}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => window.location.href = \`/leads/\${lead.id}\`} className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}>
                        <Search size={16} />
                      </button>
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
    
    // Add import for Search icon if missing
    if (!content.includes("Search }")) {
      content = content.replace(/import {([^}]+)} from 'lucide-react';/, "import {$1, Search} from 'lucide-react';");
    }
    
    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log('LeadsClient.tsx patched successfully.');
} else {
    console.log('Could not find target string in LeadsClient.tsx');
}
