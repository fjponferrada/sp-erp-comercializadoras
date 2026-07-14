const fs = require('fs');
let f = 'src/app/(app)/contratos/[id]/ContractDetailClient.tsx';
let c = fs.readFileSync(f, 'utf8');

const regexSwitching = /<div className="overflow-x-auto">\s*<table className="w-full text-left border-collapse">[\s\S]*?<thead>\s*<tr className="border-b border-gray-800 text-left">\s*<th className="py-3 px-4 font-semibold text-gray-400">FECHA INTERCAMBIO<\/th>[\s\S]*?<\/tbody>\s*<\/table>\s*<\/div>/;

const switchingReplacement = `{/* Mobile View Switching */}
              <div className="block md:hidden">
                <div className="flex flex-col gap-3">
                  {initialContract.switchingEvents.map((ev: any) => (
                    <div key={ev.id} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-gray-400 mb-1">{ev.codigoSolicitud || '-'}</div>
                          <div className="text-xs text-gray-300">{ev.fechaSolicitud ? formatDateUTC(ev.fechaSolicitud) : (ev.fechaAviso ? formatDateUTC(ev.fechaAviso) : '-')}</div>
                        </div>
                        <span className={\`px-2 py-1 rounded text-xs font-bold \${
                          ev.estadoAR === 'ACEPTADO' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                          ev.estadoAR === 'RECHAZADO' ? 'bg-[rgba(239,68,68,0.15)] text-red-400 border border-[rgba(239,68,68,0.3)]' :
                          'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                        }\`}>
                          {ev.estadoAR || '-'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-gray-500">Proceso</div>
                          <div className="text-[var(--lime)] font-bold">{ev.proceso || '-'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Paso</div>
                          <div className="text-gray-300">{ev.paso || '-'}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        <strong>Obs:</strong> {ev.observaciones || '-'}
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-strong)]">
                        <div className="text-xs text-gray-400">Prev. Act: {ev.fechaPrevActivacion ? formatDateUTC(ev.fechaPrevActivacion) : '-'}</div>
                        {ev.xmlUrl ? (
                          <a href={ev.xmlUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--lime)] hover:text-white transition-colors" title="Descargar XML">
                            <Download size={14} /> XML
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop View Switching */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA INTERCAMBIO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">CÓD. SOLICITUD</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PROCESO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">PASO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ESTADO A/R</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA A/R</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">FECHA PREV. ACT.</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">OBSERVACIONES</th>
                      <th className="py-3 px-4 font-semibold text-gray-400">ARCHIVO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.switchingEvents.map((ev: any) => (
                      <tr key={ev.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                        <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                          {ev.fechaSolicitud ? formatDateUTC(ev.fechaSolicitud) : (ev.fechaAviso ? formatDateUTC(ev.fechaAviso) : '-')}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400">{ev.codigoSolicitud || '-'}</td>
                        <td className="py-3 px-4 text-[var(--lime)] font-bold">{ev.proceso || '-'}</td>
                        <td className="py-3 px-4 text-gray-300">{ev.paso || '-'}</td>
                        <td className="py-3 px-4">
                          {ev.estadoAR ? (
                            <span className={\`px-2 py-1 rounded text-xs font-bold max-w-max \${
                              ev.estadoAR === 'ACEPTADO' ? 'bg-[rgba(34,197,94,0.15)] text-green-400 border border-[rgba(34,197,94,0.3)]' :
                              ev.estadoAR === 'RECHAZADO' ? 'bg-[rgba(239,68,68,0.15)] text-red-400 border border-[rgba(239,68,68,0.3)]' :
                              'bg-[var(--bg-elevated)] border-[var(--border)] text-gray-400'
                            }\`}>
                              {ev.estadoAR}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-400">{ev.fechaAR ? formatDateUTC(ev.fechaAR) : '-'}</td>
                        <td className="py-3 px-4 text-gray-300 font-medium">{ev.fechaPrevActivacion ? formatDateUTC(ev.fechaPrevActivacion) : '-'}</td>
                        <td className="py-3 px-4 text-gray-500 max-w-[200px] truncate" title={ev.observaciones || ''}>{ev.observaciones || '-'}</td>
                        <td className="py-3 px-4">
                          {ev.xmlUrl ? (
                            <a href={ev.xmlUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[var(--lime)] hover:text-white transition-colors" title="Descargar XML Original">
                              <Download size={14} /> XML
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>`;

c = c.replace(regexSwitching, switchingReplacement);

const regexF1 = /<div className="overflow-x-auto">\s*<table className="w-full text-left border-collapse">[\s\S]*?<thead>\s*<tr className="border-b border-\[var\(--border\)\] text-left">\s*<th className="py-3 px-4 font-semibold text-gray-400 text-xs">FECHA EMISIÓN<\/th>[\s\S]*?<\/tbody>\s*<\/table>\s*<\/div>/;

const f1Replacement = `{/* Mobile View F1s */}
              <div className="block md:hidden">
                <div className="flex flex-col gap-3">
                  {initialContract.f1Invoices.map((f1: any) => (
                    <div key={f1.id} className="p-4 border border-[var(--border)] rounded-lg bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-mono text-[var(--lime)] font-bold mb-1">{f1.numeroFactura || '-'}</div>
                          <div className="text-xs text-gray-300">{f1.fechaEmision ? formatDateUTC(f1.fechaEmision) : '-'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-bold">{f1.saldoFactura != null ? \`\${f1.saldoFactura.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €\` : '-'}</div>
                          <div className="text-xs text-gray-400">Total</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--border-strong)] pt-2">
                        <div>
                          <div className="text-gray-500">Periodo</div>
                          <div className="text-gray-300">
                            {f1.fechaInicio && f1.fechaFin ? \`\${formatDateUTC(f1.fechaInicio)} al \${formatDateUTC(f1.fechaFin)}\` : '-'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-gray-500">Base Imp.</div>
                          <div className="text-gray-300">{f1.baseImponible != null ? \`\${f1.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €\` : '-'}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-[var(--border-strong)]">
                        <div className="text-xs flex gap-2">
                          <div><span className="text-gray-500">Peajes:</span> {f1.totalPeajes != null ? f1.totalPeajes.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}</div>
                          <div><span className="text-gray-500">Cargos:</span> {f1.totalCargos != null ? f1.totalCargos.toLocaleString('es-ES', { minimumFractionDigits: 2 }) : '-'}</div>
                        </div>
                        {f1.xmlUrl ? (
                          <a href={f1.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML" className="flex items-center gap-1 text-[var(--lime)] hover:text-white transition-colors">
                            <Download size={14} /> XML
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop View F1s */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs">FECHA EMISIÓN</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs">Nº FACTURA</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs">PERIODO</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">BASE IMP.</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">PEAJES</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">CARGOS</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-right">TOTAL</th>
                      <th className="py-3 px-4 font-semibold text-gray-400 text-xs text-center">XML</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialContract.f1Invoices.map((f1: any) => (
                      <tr key={f1.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-sm">
                        <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                          {f1.fechaEmision ? formatDateUTC(f1.fechaEmision) : '-'}
                        </td>
                        <td className="py-3 px-4 font-mono text-[var(--lime)] font-bold">{f1.numeroFactura || '-'}</td>
                        <td className="py-3 px-4 text-gray-300 text-xs">
                          {f1.fechaInicio && f1.fechaFin 
                            ? \`\${formatDateUTC(f1.fechaInicio)} - \${formatDateUTC(f1.fechaFin)}\`
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-right">{f1.baseImponible != null ? \`\${f1.baseImponible.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €\` : '-'}</td>
                        <td className="py-3 px-4 text-gray-300 text-right">{f1.totalPeajes != null ? \`\${f1.totalPeajes.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €\` : '-'}</td>
                        <td className="py-3 px-4 text-gray-300 text-right">{f1.totalCargos != null ? \`\${f1.totalCargos.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €\` : '-'}</td>
                        <td className="py-3 px-4 text-white font-bold text-right">{f1.saldoFactura != null ? \`\${f1.saldoFactura.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €\` : '-'}</td>
                        <td className="py-3 px-4 text-center">
                          {f1.xmlUrl ? (
                            <a href={f1.xmlUrl} target="_blank" rel="noreferrer" title="Descargar XML" className="flex items-center justify-center gap-1 text-[var(--lime)] hover:text-white transition-colors">
                              <Download size={14} /> XML
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>`;

c = c.replace(regexF1, f1Replacement);

fs.writeFileSync(f, c, 'utf8');
console.log('ContractDetailClient patched.');
