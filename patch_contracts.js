const fs = require('fs');

const FILE_PATH = 'src/app/(app)/contratos/ContractsClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const mobileCardsStr = `
          {/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {paginated.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <FileText size={32} style={{ marginBottom: '8px', opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                    {isLoading ? "Cargando contratos..." : "No se encontraron contratos con los filtros aplicados."}
                </div>
            ) : paginated.map((c) => {
                const estUpper = String(c.estado).toUpperCase();
                const est = ESTADO_CONFIG[estUpper] || ESTADO_CONFIG[c.estado] || ESTADO_CONFIG.DEFAULT;
                return (
                    <div key={c.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ color: 'var(--lime)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>{truncateCups(c.cups)}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>{c.cliente}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.contractCode || \`ID: \${c.id}\`}</div>
                            </div>
                            <span className={est.badge} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor' }} />
                                {est.label}
                            </span>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{c.producto} - <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.tarifa}</span></div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Consumo: {formatMwh(c.consumoMwh)}</div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {formatDate(c.fechaAlta)} {c.fechaBaja && \` - \${formatDate(c.fechaBaja)}\`}
                            </div>
                            <button onClick={() => router.push(\`/contratos/\${c.id}\`)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                                Ver ficha
                            </button>
                        </div>
                    </div>
                );
            })}
          </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>`;

content = content.replace("<div style={{ overflowX: 'auto' }}>", mobileCardsStr);

// Now find the end of the table wrapper
content = content.replace(
    "          <PaginationFooter\n            currentPage={page}",
    "          </div>\n\n          <PaginationFooter\n            currentPage={page}"
);

fs.writeFileSync(FILE_PATH, content);
console.log('Successfully patched ContractsClient.tsx');
