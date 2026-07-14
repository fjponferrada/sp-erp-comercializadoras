const fs = require('fs');

const FILE_PATH = 'src/app/(app)/contratos/[id]/ContractDetailClient.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// 1. Facturas mobile view
const facturasOriginal = `              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">NÚMERO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA EMISIÓN</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PERIODO (DISTRIBUIDORA)</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PERIODO (ENERGÍA)</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">TOTAL</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ESTADO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="py-3 px-4 font-mono text-sm text-gray-300">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-sm text-gray-300">{new Date(inv.issueDate).toLocaleDateString('es-ES')}</td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {inv.invoiceData?.Desde || inv.desde ? new Date(inv.invoiceData?.Desde || inv.desde).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.Hasta || inv.hasta ? new Date(inv.invoiceData?.Hasta || inv.hasta).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {inv.invoiceData?.['Desde(EA)'] || inv.desdeEA ? new Date(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA ? new Date(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-[var(--lime)]">€ {inv.totalAmount.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={\`px-2 py-1 rounded text-xs font-bold max-w-max \${
                            inv.status === 'PAGADA' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                            inv.status === 'PENDIENTE' ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400 border border-[rgba(234,179,8,0.3)]' :
                            'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                          }\`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a href={\`/facturas/\${inv.id}\`} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Ver Detalles</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>`;

const facturasReplacement = `              <>
              {/* Mobile View Facturas */}
              <div className="block md:hidden">
                <div className="flex flex-col gap-3">
                  {initialContract.invoices.map((inv: any) => (
                    <div key={inv.id} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-[var(--lime)] font-bold mb-1">{inv.invoiceNumber}</div>
                          <div className="text-sm text-gray-300">Emisión: {new Date(inv.issueDate).toLocaleDateString('es-ES')}</div>
                        </div>
                        <span className={\`px-2 py-1 rounded text-xs font-bold \${
                          inv.status === 'PAGADA' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                          inv.status === 'PENDIENTE' ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400 border border-[rgba(234,179,8,0.3)]' :
                          'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                        }\`}>
                          {inv.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1 text-xs">
                        <div className="text-gray-400"><span className="text-gray-500">Periodo (Dist):</span> {inv.invoiceData?.Desde || inv.desde ? new Date(inv.invoiceData?.Desde || inv.desde).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.Hasta || inv.hasta ? new Date(inv.invoiceData?.Hasta || inv.hasta).toLocaleDateString('es-ES') : '-'}</div>
                        <div className="text-gray-500"><span className="text-gray-600">Periodo (Energía):</span> {inv.invoiceData?.['Desde(EA)'] || inv.desdeEA ? new Date(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA ? new Date(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA).toLocaleDateString('es-ES') : '-'}</div>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-strong)]">
                        <div className="text-base font-bold text-[var(--lime)]">€ {inv.totalAmount.toFixed(2)}</div>
                        <a href={\`/facturas/\${inv.id}\`} className="bg-[rgba(255,255,255,0.05)] border border-[var(--border)] rounded px-3 py-1.5 text-xs text-white">Ver Detalles</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Desktop View Facturas */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">NÚMERO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA EMISIÓN</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PERIODO (DISTRIBUIDORA)</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PERIODO (ENERGÍA)</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">TOTAL</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ESTADO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                        <td className="py-3 px-4 font-mono text-sm text-gray-300">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-sm text-gray-300">{new Date(inv.issueDate).toLocaleDateString('es-ES')}</td>
                        <td className="py-3 px-4 text-sm text-gray-400">
                          {inv.invoiceData?.Desde || inv.desde ? new Date(inv.invoiceData?.Desde || inv.desde).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.Hasta || inv.hasta ? new Date(inv.invoiceData?.Hasta || inv.hasta).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {inv.invoiceData?.['Desde(EA)'] || inv.desdeEA ? new Date(inv.invoiceData?.['Desde(EA)'] || inv.desdeEA).toLocaleDateString('es-ES') : '-'} al {inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA ? new Date(inv.invoiceData?.['Hasta(EA)'] || inv.hastaEA).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-bold text-[var(--lime)]">€ {inv.totalAmount.toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span className={\`px-2 py-1 rounded text-xs font-bold max-w-max \${
                            inv.status === 'PAGADA' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                            inv.status === 'PENDIENTE' ? 'bg-[rgba(234,179,8,0.15)] text-yellow-400 border border-[rgba(234,179,8,0.3)]' :
                            'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                          }\`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <a href={\`/facturas/\${inv.id}\`} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Ver Detalles</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>`;


// 2. Reclamaciones mobile view
const reclamacionesOriginal = `              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. SOLICITUD</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. DISTRIBUIDORA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-center">DÍAS ABIERTA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO 01</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO 02</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">COMENTARIOS PASO 03</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">RESOLUCIÓN PASO 05</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.claims.map((claim: any) => (
                      <tr key={claim.codigoSolicitud} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                        <td className="py-3 px-4 font-mono text-gray-400">
                          <div className="flex items-center gap-2">
                            {claim.codigoSolicitud}
                            {claim.paso01?.xmlUrl && (
                              <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400">{claim.codigoReclamacion || '-'}</td>
                        <td className="py-3 px-4 font-bold text-center">
                          {claim.diasAbierta !== null ? claim.diasAbierta : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {claim.paso01?.fecha ? new Date(claim.paso01.fecha).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          <div className="flex items-center gap-2">
                            {claim.paso02?.fecha ? new Date(claim.paso02.fecha).toLocaleDateString('es-ES') : '-'}
                            {claim.paso02?.xmlUrl && (
                              <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-xs truncate" title={claim.paso03?.comentario || ''}>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{claim.paso03?.comentario || '-'}</span>
                            {claim.paso03?.xmlUrl && (
                              <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-xs truncate" title={claim.paso05?.comentario || ''}>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{claim.paso05?.comentario || '-'}</span>
                            {claim.paso05?.xmlUrl && (
                              <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>`;

const reclamacionesReplacement = `              <>
              {/* Mobile View Reclamaciones */}
              <div className="block md:hidden">
                <div className="flex flex-col gap-3">
                  {initialContract.claims.map((claim: any) => (
                    <div key={claim.codigoSolicitud} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-[var(--lime)] font-bold mb-1 flex items-center gap-2">
                            {claim.codigoSolicitud}
                            {claim.paso01?.xmlUrl && (
                              <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-400 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">Cód. Dist: <span className="font-mono text-gray-300">{claim.codigoReclamacion || '-'}</span></div>
                        </div>
                        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-center">
                          <div className="text-[10px] text-gray-500 uppercase">Días Abierta</div>
                          <div className="font-bold text-white">{claim.diasAbierta !== null ? claim.diasAbierta : '-'}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                        <div>
                          <div className="text-gray-500 mb-1">Paso 01</div>
                          <div className="text-gray-300">{claim.paso01?.fecha ? new Date(claim.paso01.fecha).toLocaleDateString('es-ES') : '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Paso 02</div>
                          <div className="text-gray-300 flex items-center gap-2">
                            {claim.paso02?.fecha ? new Date(claim.paso02.fecha).toLocaleDateString('es-ES') : '-'}
                            {claim.paso02?.xmlUrl && (
                              <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                        <div>
                          <div className="text-gray-500 mb-1">Paso 03 (Comentarios)</div>
                          <div className="text-gray-300 flex items-start justify-between gap-2">
                            <span className="italic">{claim.paso03?.comentario || '-'}</span>
                            {claim.paso03?.xmlUrl && (
                              <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0 mt-0.5">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Paso 05 (Resolución)</div>
                          <div className="text-gray-300 flex items-start justify-between gap-2">
                            <span className="italic">{claim.paso05?.comentario || '-'}</span>
                            {claim.paso05?.xmlUrl && (
                              <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0 mt-0.5">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Desktop View Reclamaciones */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. SOLICITUD</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. DISTRIBUIDORA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-center">DÍAS ABIERTA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO 01</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO 02</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">COMENTARIOS PASO 03</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">RESOLUCIÓN PASO 05</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.claims.map((claim: any) => (
                      <tr key={claim.codigoSolicitud} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                        <td className="py-3 px-4 font-mono text-gray-400">
                          <div className="flex items-center gap-2">
                            {claim.codigoSolicitud}
                            {claim.paso01?.xmlUrl && (
                              <a href={claim.paso01.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 01" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400">{claim.codigoReclamacion || '-'}</td>
                        <td className="py-3 px-4 font-bold text-center">
                          {claim.diasAbierta !== null ? claim.diasAbierta : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {claim.paso01?.fecha ? new Date(claim.paso01.fecha).toLocaleDateString('es-ES') : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          <div className="flex items-center gap-2">
                            {claim.paso02?.fecha ? new Date(claim.paso02.fecha).toLocaleDateString('es-ES') : '-'}
                            {claim.paso02?.xmlUrl && (
                              <a href={claim.paso02.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 02" className="text-gray-500 hover:text-[var(--lime)]">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-xs truncate" title={claim.paso03?.comentario || ''}>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{claim.paso03?.comentario || '-'}</span>
                            {claim.paso03?.xmlUrl && (
                              <a href={claim.paso03.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 03" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 max-w-xs truncate" title={claim.paso05?.comentario || ''}>
                          <div className="flex items-center gap-2">
                            <span className="truncate">{claim.paso05?.comentario || '-'}</span>
                            {claim.paso05?.xmlUrl && (
                              <a href={claim.paso05.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML Paso 05" className="text-gray-500 hover:text-[var(--lime)] shrink-0">
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>`;

if (!content.includes(facturasOriginal)) {
    console.log("Could not find Facturas original string.");
} else {
    content = content.replace(facturasOriginal, facturasReplacement);
    console.log("Facturas patched.");
}

if (!content.includes(reclamacionesOriginal)) {
    console.log("Could not find Reclamaciones original string.");
} else {
    content = content.replace(reclamacionesOriginal, reclamacionesReplacement);
    console.log("Reclamaciones patched.");
}

fs.writeFileSync(FILE_PATH, content);
