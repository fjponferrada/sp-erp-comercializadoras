const fs = require('fs');

const FILE_PATH = 'src/app/(app)/clientes/ClientesClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const mobileCardsStr = `
          {/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {clientes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ marginBottom: 10, opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>{isLoading ? "Cargando clientes..." : "No se encontraron clientes con los filtros aplicados."}</p>
                </div>
            ) : (
                clientes.map((cliente) => (
                    <div key={cliente.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 8, background: cliente.tipo === 'Empresa' ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)', border: \`1px solid \${cliente.tipo === 'Empresa' ? 'rgba(59,130,246,0.25)' : 'rgba(168,85,247,0.25)'}\`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {cliente.tipo === 'Empresa' ? <Building2 size={13} color="#60A5FA" /> : <User size={13} color="#C084FC" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{cliente.nombre}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cliente.nif}</div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                {cliente.tipo === 'Empresa' ? (
                                    <span className="badge badge-process"><Building2 size={10} /> Empresa</span>
                                ) : (
                                    <span className="badge" style={{ background: 'rgba(168,85,247,0.15)', color: '#C084FC', display: 'inline-flex', alignItems: 'center', gap: 5 }}><User size={10} /> Particular</span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cliente.contratos}</span> Contratos
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: cliente.cupsActivos > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                <Zap size={12} /> <span style={{ fontWeight: 600 }}>{cliente.cupsActivos}</span> CUPS
                            </div>
                        </div>

                        {(cliente.email || cliente.telefono) && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {cliente.email && <div>{cliente.email}</div>}
                                {cliente.telefono && <div>{cliente.telefono}</div>}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button onClick={(e) => { e.stopPropagation(); router.push(\`/clientes/\${cliente.id}\`); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ExternalLink size={12} /> Ver ficha
                            </button>
                        </div>
                    </div>
                ))
            )}
          </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>`;

content = content.replace("<div style={{ overflowX: 'auto' }}>", mobileCardsStr);

content = content.replace(
    "          <PaginationFooter\n            currentPage={page}",
    "          </div>\n\n          <PaginationFooter\n            currentPage={page}"
);

fs.writeFileSync(FILE_PATH, content);
console.log('Successfully patched ClientesClient.tsx');
