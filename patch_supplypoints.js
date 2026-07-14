const fs = require('fs');

const FILE_PATH = 'src/app/(app)/puntos-suministro/SupplyPointsClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const mobileCardsStr = `
          {/* Mobile View (Cards) */}
          <div className="block md:hidden">
            {loading && supplyPoints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando puntos de suministro...</div>
            ) : supplyPoints.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron resultados</div>
            ) : (
                supplyPoints.map((sp) => (
                    <div key={sp.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                    <Zap size={14} color="var(--lime)" />
                                </div>
                                <div>
                                    <Link href={\`/puntos-suministro/\${sp.id}\`} style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em', textDecoration: 'none' }}>
                                        {sp.cups}
                                    </Link>
                                </div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                {sp.tariff || 'S/D'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Building2 size={12} color="var(--text-muted)" />
                                <Link href={\`/clientes/\${sp.clientId}\`} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}>
                                    {sp.client?.businessName || 'Desconocido'}
                                </Link>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                                <MapPin size={12} color="var(--text-muted)" style={{ marginTop: '3px', flexShrink: 0 }} />
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{sp.address}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sp.postalCode} - {sp.city} ({sp.province})</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                {sp.annualConsumption ? \`\${sp.annualConsumption} kWh\` : '-'}
                            </div>

                            {sp.contracts && sp.contracts.length > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ position: 'relative', display: 'flex', width: '8px', height: '8px' }}>
                                        <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: 'var(--lime)', opacity: 0.75 }}></span>
                                        <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', backgroundColor: 'var(--lime)' }}></span>
                                    </span>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--lime)' }}>Activo</span>
                                </div>
                            ) : (
                                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>Sin Contrato</span>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <Link href={\`/puntos-suministro/\${sp.id}\`} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                                <Eye size={12} /> Ver Detalle
                            </Link>
                            {['BACKOFFICE', 'COMPANYADMIN', 'SUPERADMIN'].includes(userRole) && (
                                <button onClick={() => handleEdit(sp)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 12px', fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Edit size={12} /> Editar
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
          </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>`;

content = content.replace("<div style={{ overflowX: 'auto' }}>", mobileCardsStr);

content = content.replace(
    "          <PaginationFooter \n            currentPage={page}",
    "          </div>\n\n          <PaginationFooter \n            currentPage={page}"
);
content = content.replace(
    "          <PaginationFooter\n            currentPage={page}",
    "          </div>\n\n          <PaginationFooter\n            currentPage={page}"
);

fs.writeFileSync(FILE_PATH, content);
console.log('Successfully patched SupplyPointsClient.tsx');
