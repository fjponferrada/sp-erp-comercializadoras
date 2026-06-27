const fs = require('fs');

let content = fs.readFileSync('src/app/(app)/facturas/FacturasClient.tsx', 'utf8');

// 1. Add isClientRole
if (!content.includes('const isClientRole')) {
    content = content.replace(
        "const showPaymentButtons = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);",
        "const showPaymentButtons = ['SUPERADMIN', 'COMPANYADMIN', 'BACKOFFICE'].includes(userRole);\n  const isClientRole = userRole === 'CLIENT' || userRole === 'CLIENTE';"
    );
}

// 2. Hide buttons for CLIENTE
// We hide Ver Ficha (Eye), WhatsApp (MessageCircle), and Llamar (Phone).
// The original: <button onClick={() => window.location.href = `/facturas/${invoice.id}`} className="action-icon" title="Ver Ficha">
content = content.replace(
    /<button onClick=\{\(\) => window\.location\.href = `\/facturas\/\$\{invoice\.id\}`\} className="action-icon" title="Ver Ficha">\s*<Eye size=\{16\} \/>\s*<\/button>/g,
    `{!isClientRole && (
                        <button onClick={() => window.location.href = \`/facturas/\${invoice.id}\`} className="action-icon" title="Ver Ficha">
                          <Eye size={16} />
                        </button>
                      )}`
);

content = content.replace(
    /\{invoice\.client\.contactPhone && \([\s\S]*?<\/>\s*\)}/g,
    `{!isClientRole && invoice.client.contactPhone && (
                        <>
                          <div style={{ height: '16px', width: '1px', background: 'var(--border)', margin: '0 4px' }}></div>
                          <a href={\`https://wa.me/34\${invoice.client.contactPhone.replace(/\\D/g, '')}\`} target="_blank" rel="noopener noreferrer" className="action-icon" title="Enviar WhatsApp">
                            <MessageCircle size={16} style={{ color: '#22c55e' }} />
                          </a>
                          <a href={\`tel:\${invoice.client.contactPhone.replace(/\\D/g, '')}\`} className="action-icon" title="Llamar">
                            <Phone size={16} style={{ color: '#60a5fa' }} />
                          </a>
                        </>
                      )}`
);

// 3. Add mobile view layout
// We replace: <div style={{ overflowX: 'auto' }}> with:
// <div className="block md:hidden"> ... </div>
// <div className="hidden md:block" style={{ overflowX: 'auto' }}>

const mobileCardsStr = `
        {/* Mobile View (Cards) */}
        <div className="block md:hidden">
          {invoices.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {isLoading ? "Cargando facturas..." : "No se encontraron facturas."}
            </div>
          )}
          {invoices.map((invoice) => (
            <div key={invoice.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{invoice.invoiceNumber}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{formatDateUTC(invoice.issueDate)}</div>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: invoice.invoiceType === 'Abono' ? '#fb7185' : '#34d399' }}>
                  {(invoice.invoiceType === 'Abono' ? -Math.abs(invoice.totalAmount) : invoice.totalAmount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ 
                  fontSize: '0.7rem', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '12px',
                  background: invoice.invoiceType === 'Normal' ? 'rgba(255,255,255,0.05)' : invoice.invoiceType === 'Abono' ? 'rgba(59,130,246,0.1)' : 'rgba(244,63,94,0.1)',
                  color: invoice.invoiceType === 'Normal' ? 'var(--text-muted)' : invoice.invoiceType === 'Abono' ? '#60a5fa' : '#fb7185',
                  border: \`1px solid \${invoice.invoiceType === 'Normal' ? 'var(--border)' : invoice.invoiceType === 'Abono' ? 'rgba(59,130,246,0.3)' : 'rgba(244,63,94,0.3)'}\`
                }}>
                  {invoice.invoiceType || 'Normal'}
                </span>
                {invoice.communicatedAt ? (
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>✅ Comunicada</span>
                ) : (
                  <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>⏳ Pte. Envío</span>
                )}
              </div>

              {!isClientRole && (
                <div style={{ fontSize: '0.9rem' }}>
                  <Link href={\`/clientes/\${invoice.clientId}\`} style={{ fontWeight: 600, color: 'var(--lime)', textDecoration: 'none' }}>
                    {invoice.client.businessName || \`\${invoice.client.firstName} \${invoice.client.lastName}\`}
                  </Link>
                </div>
              )}

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>CUPS:</strong> {invoice.supplyPoint?.cups || '-'}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {invoice.totalMWh ? \`\${(invoice.invoiceType === 'Abono' ? -Math.abs(invoice.totalMWh) : invoice.totalMWh).toLocaleString('es-ES')} kWh\` : '-'}
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!isClientRole && (
                    <button onClick={() => window.location.href = \`/facturas/\${invoice.id}\`} className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px' }}>
                      <Eye size={16} />
                    </button>
                  )}
                  {invoice.pdfUrl && (
                    <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="action-icon" style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '6px', color: 'var(--lime)' }}>
                      <Download size={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
`;

content = content.replace(
    "<div style={{ overflowX: 'auto' }}>",
    mobileCardsStr
);

// Add the closing div for Desktop View just before <PaginationFooter
content = content.replace(
    "        <PaginationFooter",
    "        </div>\n\n        <PaginationFooter"
);

fs.writeFileSync('src/app/(app)/facturas/FacturasClient.tsx', content);
console.log('Successfully patched FacturasClient.tsx');
